const App = require('../index');

const makeZ = (...responses) => ({
    request: jest.fn(async () => ({ status: 200, json: responses.shift() })),
});

const bundle = (inputData) => ({ inputData, authData: { tenant_id: 'test' } });

describe('Commerce7 customer actions', () => {
    it('registers all requested actions', () => {
        expect(Object.keys(App.creates)).toEqual(
            expect.arrayContaining([
                'create_customer',
                'update_customer',
                'add_tag_to_customer',
                'remove_tag_from_customer',
                'add_customer_note',
                'update_customer_custom_fields',
            ]),
        );
    });

    it('creates a customer without transaction email', async () => {
        const z = makeZ({
            id: 'customer-1',
            emails: [{ email: 'ada@example.com' }],
            phones: [{ phone: '+15035550123' }],
        });

        const result = await App.creates.create_customer.operation.perform(
            z,
            bundle({
                firstName: 'Ada',
                lastName: 'Lovelace',
                email: 'ada@example.com',
                phone: '+15035550123',
                countryCode: 'US',
            }),
        );

        expect(z.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                params: { isSendTransactionEmail: false },
                body: expect.objectContaining({
                    firstName: 'Ada',
                    countryCode: 'US',
                    emails: [{ email: 'ada@example.com' }],
                    phones: [{ phone: '+15035550123' }],
                }),
            }),
        );
        expect(result.primaryEmail).toBe('ada@example.com');
    });

    it('updates primary email and phone while preserving secondary values', async () => {
        const z = makeZ(
            {
                id: 'customer-1',
                countryCode: 'US',
                emails: [
                    { id: 'email-1', email: 'old@example.com' },
                    { id: 'email-2', email: 'second@example.com' },
                ],
                phones: [{ id: 'phone-1', phone: '+15035550000' }],
            },
            {
                id: 'customer-1',
                emails: [{ email: 'new@example.com' }],
                phones: [{ phone: '+15035550123' }],
            },
        );

        await App.creates.update_customer.operation.perform(
            z,
            bundle({
                customer_id: 'customer-1',
                email: 'new@example.com',
                phone: '+15035550123',
            }),
        );

        expect(z.request.mock.calls[1][0].body).toEqual({
            countryCode: 'US',
            emails: [
                { id: 'email-1', email: 'new@example.com' },
                { id: 'email-2', email: 'second@example.com' },
            ],
            phones: [{ id: 'phone-1', phone: '+15035550123' }],
        });
    });

    it('adds and removes a customer tag without losing existing tags', async () => {
        const addZ = makeZ(
            { id: 'customer-1', tags: [{ id: 'tag-1' }] },
            { id: 'customer-1', tags: [{ id: 'tag-1' }, { id: 'tag-2' }] },
        );
        await App.creates.add_tag_to_customer.operation.perform(
            addZ,
            bundle({ customer_id: 'customer-1', tag_id: 'tag-2' }),
        );
        expect(addZ.request.mock.calls[1][0].body).toEqual({
            tags: [{ id: 'tag-1' }, { id: 'tag-2' }],
        });

        const removeZ = makeZ(
            { id: 'customer-1', tags: [{ id: 'tag-1' }, { id: 'tag-2' }] },
            { id: 'customer-1', tags: [{ id: 'tag-1' }] },
        );
        await App.creates.remove_tag_from_customer.operation.perform(
            removeZ,
            bundle({ customer_id: 'customer-1', tag_id: 'tag-2' }),
        );
        expect(removeZ.request.mock.calls[1][0].body).toEqual({
            tags: [{ id: 'tag-1' }],
        });
    });

    it('adds a customer note', async () => {
        const z = makeZ({ id: 'note-1', customerId: 'customer-1' });

        await App.creates.add_customer_note.operation.perform(
            z,
            bundle({ customer_id: 'customer-1', content: 'Call tomorrow' }),
        );

        expect(z.request.mock.calls[0][0]).toEqual(
            expect.objectContaining({
                url: 'https://api.commerce7.com/v1/note',
                method: 'POST',
                body: expect.objectContaining({
                    type: 'Note',
                    content: 'Call tomorrow',
                    customerId: 'customer-1',
                }),
            }),
        );
    });

    it('merges customer custom fields and rejects invalid JSON', async () => {
        const z = makeZ(
            { id: 'customer-1', metaData: { favoriteWine: 'Syrah' } },
            {
                id: 'customer-1',
                metaData: { favoriteWine: 'Pinot', vip: true },
            },
        );

        await App.creates.update_customer_custom_fields.operation.perform(
            z,
            bundle({
                customer_id: 'customer-1',
                custom_fields_json: '{"favoriteWine":"Pinot","vip":true}',
            }),
        );
        expect(z.request.mock.calls[1][0].body).toEqual({
            metaData: { favoriteWine: 'Pinot', vip: true },
        });

        await expect(
            App.creates.update_customer_custom_fields.operation.perform(
                makeZ(),
                bundle({
                    customer_id: 'customer-1',
                    custom_fields_json: 'nope',
                }),
            ),
        ).rejects.toThrow('Custom Fields JSON must be a valid JSON object');
    });
});
