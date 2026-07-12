const App = require('../index');

const makeZ = (...responses) => ({
    request: jest.fn(async () => {
        const response = responses.shift();
        if (response instanceof Error) throw response;
        return { status: 200, json: response };
    }),
});

const bundle = (inputData) => ({ inputData, authData: { tenant_id: 'test' } });

describe('Commerce7 searches', () => {
    it('registers all requested searches', () => {
        expect(Object.keys(App.searches)).toEqual(
            expect.arrayContaining([
                'find_customer_by_id',
                'find_customer_by_email',
                'find_customer_by_phone',
                'find_order_by_id',
                'find_reservation_by_id',
                'find_club_membership_by_id',
                'find_club_memberships_by_customer',
                'find_club_package_by_id',
            ]),
        );
    });

    it('finds a customer by ID and normalizes primary contact fields', async () => {
        const z = makeZ({
            id: 'customer-1',
            emails: [{ email: 'ada@example.com' }],
            phones: [{ phone: '+15035550123' }],
        });

        const results =
            await App.searches.find_customer_by_id.operation.perform(
                z,
                bundle({ id: 'customer-1' }),
            );

        expect(z.request).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'https://api.commerce7.com/v1/customer/customer-1',
            }),
        );
        expect(results[0]).toEqual(
            expect.objectContaining({
                id: 'customer-1',
                primaryEmail: 'ada@example.com',
                primaryPhone: '+15035550123',
            }),
        );
    });

    it('scans cursor pages for an exact case-insensitive email match', async () => {
        const z = makeZ(
            {
                customers: [
                    { id: 'other', emails: [{ email: 'other@example.com' }] },
                ],
                cursor: 'next-page',
            },
            {
                customers: [
                    { id: 'match', emails: [{ email: 'ADA@EXAMPLE.COM' }] },
                ],
            },
        );

        const results =
            await App.searches.find_customer_by_email.operation.perform(
                z,
                bundle({ email: 'ada@example.com' }),
            );

        expect(z.request).toHaveBeenCalledTimes(2);
        expect(z.request.mock.calls[1][0].params.cursor).toBe('next-page');
        expect(results[0].id).toBe('match');
    });

    it('normalizes punctuation when matching phone numbers', async () => {
        const z = makeZ({
            customers: [
                { id: 'match', phones: [{ phone: '+1 (503) 555-0123' }] },
            ],
        });

        const results =
            await App.searches.find_customer_by_phone.operation.perform(
                z,
                bundle({ phone: '1-503-555-0123' }),
            );

        expect(results[0].id).toBe('match');
    });

    it('finds all club memberships for a customer', async () => {
        const z = makeZ({ clubMemberships: [{ id: 'membership-1' }] });

        const results =
            await App.searches.find_club_memberships_by_customer.operation.perform(
                z,
                bundle({ customer_id: 'customer-1' }),
            );

        expect(z.request).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'https://api.commerce7.com/v1/club-membership',
                params: { customerId: 'customer-1', limit: 50 },
            }),
        );
        expect(results).toEqual([{ id: 'membership-1' }]);
    });
});
