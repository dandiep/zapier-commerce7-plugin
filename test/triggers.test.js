const closedReservationTrigger = require('../triggers/closed_reservation');
const newCustomerTrigger = require('../triggers/new_customer');
const newReservationTrigger = require('../triggers/new_reservation');
const App = require('../index');

const buildBundle = (after) => ({
    inputData: after ? { after } : {},
    authData: {
        tenant_id: 'tenant-id',
    },
});

const buildZ = (reservations, requestSpy) => ({
    request: (options) => {
        requestSpy(options);

        return Promise.resolve({
            status: 200,
            json: {
                reservations,
            },
        });
    },
});

const buildCustomerZ = (customers, requestSpy) => ({
    request: (options) => {
        requestSpy(options);

        return Promise.resolve({
            status: 200,
            json: {
                customers,
            },
        });
    },
});

describe('reservation triggers', () => {
    const now = new Date('2026-03-28T19:00:00.000Z').getTime();

    beforeEach(() => {
        jest.spyOn(Date, 'now').mockReturnValue(now);
    });

    afterEach(() => {
        Date.now.mockRestore();
    });

    it('registers the closed reservation trigger with the app', () => {
        expect(App.triggers.closed_reservation).toBe(closedReservationTrigger);
    });

    it('returns only closed reservations for the closed trigger', async () => {
        const requestSpy = jest.fn();
        const reservations = [
            {
                id: 'reservation-1',
                status: 'Closed Out',
                guestCount: 2,
                reservationDate: '2026-03-28T19:00:00.000Z',
                closeOutTime: '2026-03-28T18:00:00.000Z',
                notes: 'Window seat',
                updatedAt: '2026-03-28T18:00:00.000Z',
            },
            {
                id: 'reservation-2',
                status: 'Paid',
                guestCount: 4,
                reservationDate: '2026-03-28T20:00:00.000Z',
                notes: '',
                updatedAt: '2026-03-28T18:05:00.000Z',
            },
        ];

        const result = await closedReservationTrigger.operation.perform(
            buildZ(reservations, requestSpy),
            buildBundle('2026-03-28T17:00:00.000Z')
        );

        expect(requestSpy).toHaveBeenCalledWith(expect.objectContaining({
            params: {
                updatedAt: 'gt:2026-03-28T17:00:00.000Z',
            },
        }));
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(expect.objectContaining({
            id: `reservation-1-closed-${new Date('2026-03-28T18:00:00.000Z').getTime()}`,
            originalId: 'reservation-1',
            status: 'Closed Out',
            _meta: {
                after: new Date('2026-03-28T18:05:00.000Z').getTime(),
            },
        }));
    });

    it('does not return old closed reservations that were updated for unrelated reasons', async () => {
        const requestSpy = jest.fn();
        const reservations = [
            {
                id: 'reservation-old',
                status: 'Closed Out',
                guestCount: 2,
                reservationDate: '2026-03-27T19:00:00.000Z',
                closeOutTime: '2026-03-27T18:00:00.000Z',
                notes: 'Closed more than a day ago',
                updatedAt: '2026-03-28T18:00:00.000Z',
            },
            {
                id: 'reservation-new',
                status: 'Closed Out',
                guestCount: 4,
                reservationDate: '2026-03-28T17:30:00.000Z',
                closeOutTime: '2026-03-28T18:02:00.000Z',
                notes: '',
                updatedAt: '2026-03-28T18:03:00.000Z',
            },
        ];

        const result = await closedReservationTrigger.operation.perform(
            buildZ(reservations, requestSpy),
            buildBundle('2026-03-28T17:00:00.000Z')
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(expect.objectContaining({
            id: `reservation-new-closed-${new Date('2026-03-28T18:02:00.000Z').getTime()}`,
            originalId: 'reservation-new',
        }));
        expect(result[0]._meta.after).toBe(new Date('2026-03-28T18:03:00.000Z').getTime());
    });

    it('uses a hashed id for the reservation trigger so updates emit as new items', async () => {
        const requestSpy = jest.fn();
        const reservations = [
            {
                id: 'reservation-3',
                status: 'Paid',
                guestCount: 6,
                reservationDate: '2026-03-28T21:00:00.000Z',
                notes: 'Birthday',
                updatedAt: '2026-03-28T18:10:00.000Z',
            },
        ];

        const result = await newReservationTrigger.operation.perform(
            buildZ(reservations, requestSpy),
            buildBundle()
        );

        expect(requestSpy).toHaveBeenCalled();
        expect(result).toHaveLength(1);
        expect(result[0].id).toMatch(/^reservation-3-[a-f0-9]{32}$/);
        expect(result[0].originalId).toBe('reservation-3');
    });
});

describe('customer trigger', () => {
    it('registers the new customer trigger with the app', () => {
        expect(App.triggers.new_customer).toBe(newCustomerTrigger);
    });

    it('requests customers created after the cursor and returns the latest cursor', async () => {
        const requestSpy = jest.fn();
        const customers = [
            {
                id: 'customer-1',
                firstName: 'Ada',
                lastName: 'Lovelace',
                createdAt: '2026-03-28T18:00:00.000Z',
                updatedAt: '2026-03-28T18:00:00.000Z',
                emails: [{ email: 'ada@example.com' }],
            },
            {
                id: 'customer-2',
                firstName: 'Grace',
                lastName: 'Hopper',
                createdAt: '2026-03-28T18:05:00.000Z',
                updatedAt: '2026-03-28T18:05:00.000Z',
                emails: [{ email: 'grace@example.com' }],
            },
        ];

        const result = await newCustomerTrigger.operation.perform(
            buildCustomerZ(customers, requestSpy),
            buildBundle('2026-03-28T17:00:00.000Z')
        );

        expect(requestSpy).toHaveBeenCalledWith(expect.objectContaining({
            params: {
                createdAt: 'gt:2026-03-28T17:00:00.000Z',
            },
        }));
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(expect.objectContaining({
            id: 'customer-1',
            firstName: 'Ada',
            lastName: 'Lovelace',
            primaryEmail: 'ada@example.com',
            _meta: {
                after: new Date('2026-03-28T18:05:00.000Z').getTime(),
            },
        }));
    });

    it('falls back to an empty primary email when a customer has no emails', async () => {
        const requestSpy = jest.fn();
        const customers = [
            {
                id: 'customer-3',
                firstName: 'No',
                lastName: 'Email',
                createdAt: '2026-03-28T18:10:00.000Z',
                updatedAt: '2026-03-28T18:10:00.000Z',
                emails: [],
            },
        ];

        const result = await newCustomerTrigger.operation.perform(
            buildCustomerZ(customers, requestSpy),
            buildBundle('2026-03-28T17:00:00.000Z')
        );

        expect(result[0].primaryEmail).toBe('');
    });
});
