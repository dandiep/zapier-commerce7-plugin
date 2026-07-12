const App = require('../index');
const { listWebhooks, normalizeWebhookPayload } = require('../utils/webhooks');

const makeZ = (...responses) => ({
    request: jest.fn(async () => {
        const response = responses.shift();
        return {
            status: response?.status ?? 200,
            json: response?.json ?? response,
        };
    }),
});

const baseBundle = {
    authData: { tenant_id: 'test' },
    targetUrl: 'https://hooks.zapier.com/example',
};

describe('Commerce7 webhook triggers and internals', () => {
    it('registers all requested instant triggers', () => {
        expect(Object.keys(App.triggers)).toEqual(
            expect.arrayContaining([
                'customer_created',
                'customer_updated',
                'club_package_created',
                'reservation_cancelled_or_deleted',
            ]),
        );
    });

    it('subscribes and unsubscribes every webhook used by a trigger', async () => {
        const z = makeZ(
            { id: 'hook-1' },
            { id: 'hook-2' },
            { id: 'hook-3' },
            { id: 'hook-4' },
            { id: 'hook-5' },
        );
        const subscribed =
            await App.triggers.customer_updated.operation.performSubscribe(
                z,
                baseBundle,
            );

        expect(subscribed.webHookIds).toEqual([
            'hook-1',
            'hook-2',
            'hook-3',
            'hook-4',
            'hook-5',
        ]);
        expect(z.request.mock.calls.map(([options]) => options.body)).toEqual([
            {
                object: 'Customer',
                action: 'Update',
                url: baseBundle.targetUrl,
            },
            {
                object: 'Customer',
                action: 'Bulk Update',
                url: baseBundle.targetUrl,
            },
            {
                object: 'Customer Address',
                action: 'Create',
                url: baseBundle.targetUrl,
            },
            {
                object: 'Customer Address',
                action: 'Update',
                url: baseBundle.targetUrl,
            },
            {
                object: 'Customer Address',
                action: 'Delete',
                url: baseBundle.targetUrl,
            },
        ]);

        const unsubscribeZ = makeZ(
            { status: 204, json: null },
            { status: 204, json: null },
            { status: 204, json: null },
            { status: 204, json: null },
            { status: 204, json: null },
        );
        await App.triggers.customer_updated.operation.performUnsubscribe(
            unsubscribeZ,
            {
                ...baseBundle,
                subscribeData: subscribed,
            },
        );
        expect(
            unsubscribeZ.request.mock.calls.map(([options]) => options.url),
        ).toEqual([
            'https://api.commerce7.com/v1/web-hook/hook-1',
            'https://api.commerce7.com/v1/web-hook/hook-2',
            'https://api.commerce7.com/v1/web-hook/hook-3',
            'https://api.commerce7.com/v1/web-hook/hook-4',
            'https://api.commerce7.com/v1/web-hook/hook-5',
        ]);
    });

    it('normalizes wrapped webhook bodies', () => {
        expect(
            normalizeWebhookPayload({
                content: {
                    object: 'Customer',
                    action: 'Create',
                    tenantId: 'tenant',
                    payload: { id: 'customer-1' },
                },
            }),
        ).toEqual(
            expect.objectContaining({
                object: 'Customer',
                action: 'Create',
                tenantId: 'tenant',
                payload: { id: 'customer-1' },
            }),
        );
    });

    it('hydrates a customer update and gives each update a unique ID', async () => {
        const z = makeZ({
            id: 'customer-1',
            updatedAt: '2026-07-12T18:00:00.000Z',
            emails: [{ email: 'ada@example.com' }],
        });

        const results = await App.triggers.customer_updated.operation.perform(
            z,
            {
                ...baseBundle,
                cleanedRequest: {
                    object: 'Customer',
                    action: 'Update',
                    tenantId: 'tenant',
                    payload: { id: 'customer-1' },
                },
            },
        );

        expect(results[0]).toEqual(
            expect.objectContaining({
                id: 'customer-1-updated-customer-2026-07-12T18:00:00.000Z',
                originalId: 'customer-1',
                eventAction: 'Update',
            }),
        );
    });

    it('turns customer address changes into hydrated customer updates', async () => {
        const z = makeZ({
            id: 'customer-1',
            updatedAt: '2026-07-12T18:00:00.000Z',
            emails: [{ email: 'ada@example.com' }],
        });

        const results = await App.triggers.customer_updated.operation.perform(
            z,
            {
                ...baseBundle,
                cleanedRequest: {
                    object: 'Customer Address',
                    action: 'Update',
                    tenantId: 'tenant',
                    payload: {
                        id: 'address-1',
                        customerId: 'customer-1',
                        updatedAt: '2026-07-12T18:02:00.000Z',
                    },
                },
            },
        );

        expect(z.request.mock.calls[0][0].url).toBe(
            'https://api.commerce7.com/v1/customer/customer-1',
        );
        expect(results[0]).toEqual(
            expect.objectContaining({
                originalId: 'customer-1',
                eventObject: 'Customer Address',
                id: 'customer-1-updated-customer-address-2026-07-12T18:02:00.000Z',
            }),
        );
    });

    it('ignores ordinary reservation updates but emits cancellations and deletes', async () => {
        const trigger = App.triggers.reservation_cancelled_or_deleted.operation;
        const ordinary = await trigger.perform(makeZ(), {
            ...baseBundle,
            cleanedRequest: {
                object: 'Reservation',
                action: 'Update',
                payload: { id: 'reservation-1', status: 'Paid' },
            },
        });
        expect(ordinary).toEqual([]);

        const cancelledZ = makeZ({
            id: 'reservation-1',
            status: 'Cancelled',
            updatedAt: '2026-07-12T18:00:00.000Z',
        });
        const cancelled = await trigger.perform(cancelledZ, {
            ...baseBundle,
            cleanedRequest: {
                object: 'Reservation',
                action: 'Update',
                payload: { id: 'reservation-1', status: 'Cancelled' },
            },
        });
        expect(cancelled).toHaveLength(1);

        const deleted = await trigger.perform(makeZ(), {
            ...baseBundle,
            cleanedRequest: {
                object: 'Reservation',
                action: 'Delete',
                payload: {
                    id: 'reservation-1',
                    updatedAt: '2026-07-12T18:00:00.000Z',
                },
            },
        });
        expect(deleted[0]).toEqual(
            expect.objectContaining({
                originalId: 'reservation-1',
                eventAction: 'Delete',
            }),
        );
    });

    it('expands cursor-paginated bulk customer updates', async () => {
        const z = makeZ(
            {
                customers: [
                    { id: 'customer-1', updatedAt: '2026-07-12T18:00:00Z' },
                ],
                cursor: 'next',
            },
            {
                customers: [
                    { id: 'customer-2', updatedAt: '2026-07-12T18:01:00Z' },
                ],
            },
        );

        const results = await App.triggers.customer_updated.operation.perform(
            z,
            {
                ...baseBundle,
                cleanedRequest: {
                    object: 'Customer',
                    action: 'Bulk Update',
                    payload: {
                        callbackUrl:
                            'https://api.commerce7.com/v1/customer?tagId=tag-1&cursor=start',
                    },
                },
            },
        );

        expect(results.map((item) => item.originalId)).toEqual([
            'customer-1',
            'customer-2',
        ]);
        expect(z.request.mock.calls[1][0].url).toContain('cursor=next');
    });

    it('lists Commerce7 webhooks through the internal helper', async () => {
        const z = makeZ({ webHooks: [{ id: 'hook-1' }] });
        await expect(listWebhooks(z, baseBundle)).resolves.toEqual([
            { id: 'hook-1' },
        ]);
    });
});
