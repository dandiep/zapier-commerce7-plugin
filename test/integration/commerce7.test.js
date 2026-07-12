const zapier = require('zapier-platform-core');

zapier.tools.env.inject();

const App = require('../../index');

const appTester = zapier.createAppTester(App);
const runIntegrationTests = process.env.RUN_C7_INTEGRATION === '1';
const describeIntegration = runIntegrationTests ? describe : describe.skip;

const API_ROOT = 'https://api.commerce7.com/v1';
const FIXTURE_PREFIX = 'zapier-integration-test';

describeIntegration('Commerce7 staging integration', () => {
    const tenantId =
        process.env.C7_TEST_TENANT_ID || process.env.authData_tenant_id;
    const bundle = {
        authData: {
            tenant_id: tenantId,
        },
    };

    let customer;
    let reservation;
    let createdAfter;
    let reservationCreatedAfter;

    const request = async (endpoint, { method = 'GET', params, body } = {}) => {
        const operation = async (z) => {
            const response = await z.request({
                url: `${API_ROOT}/${endpoint}`,
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                params,
                body,
            });

            if (response.status >= 300) {
                throw new Error(
                    `${method} /${endpoint} failed with status ${response.status}`,
                );
            }

            return response.status === 204 ? null : response.json;
        };

        return appTester(operation, bundle);
    };

    const getNextReservationDate = (reservationType) => {
        const availableDays = new Set(
            reservationType.timeSlots.map((slot) => slot.dayOfWeek),
        );
        const date = new Date();
        date.setUTCDate(date.getUTCDate() + 8);

        while (!availableDays.has(date.getUTCDay())) {
            date.setUTCDate(date.getUTCDate() + 1);
        }

        // 18:00 UTC is 11:00 in the tenant's Pacific timezone during daylight time.
        date.setUTCHours(18, 0, 0, 0);
        return date.toISOString();
    };

    beforeAll(async () => {
        if (
            !process.env.C7_API_USERNAME ||
            !process.env.C7_API_TOKEN ||
            !tenantId
        ) {
            throw new Error(
                'C7_API_USERNAME, C7_API_TOKEN, and C7_TEST_TENANT_ID are required',
            );
        }

        if (
            !tenantId.includes('staging') &&
            process.env.C7_ALLOW_NON_STAGING_INTEGRATION !== '1'
        ) {
            throw new Error(
                'Refusing to create fixtures outside a staging tenant. Set ' +
                    'C7_ALLOW_NON_STAGING_INTEGRATION=1 to override intentionally.',
            );
        }
    });

    it('authenticates the staging tenant through the plugin', async () => {
        await expect(
            appTester(App.authentication.test, bundle),
        ).resolves.toEqual({
            tenant_id: tenantId,
        });
    });

    describe('customer and reservation lifecycle', () => {
        beforeAll(async () => {
            const runId = `${Date.now()}-${process.pid}`;
            createdAfter = new Date(Date.now() - 5000).toISOString();

            try {
                customer = await request('customer', {
                    method: 'POST',
                    body: {
                        firstName: 'Zapier',
                        lastName: `Integration ${runId}`,
                        emails: [
                            { email: `${FIXTURE_PREFIX}+${runId}@example.com` },
                        ],
                        isSendTransactionEmail: false,
                    },
                });
            } catch (error) {
                if (String(error).includes('401')) {
                    throw new Error(
                        'The Commerce7 app needs Full Customer and Reservation access ' +
                            'to run fixture lifecycle tests.',
                    );
                }

                throw error;
            }
        });

        afterAll(async () => {
            if (reservation && reservation.id) {
                await request(`reservation/${reservation.id}`, {
                    method: 'DELETE',
                });
            }

            if (customer && customer.id) {
                await request(`customer/${customer.id}`, { method: 'DELETE' });
            }
        });

        it('emits a customer created in Commerce7', async () => {
            if (!customer) return;

            const results = await appTester(
                App.triggers.new_customer.operation.perform,
                {
                    ...bundle,
                    inputData: { after: createdAfter },
                },
            );
            const result = results.find((item) => item.id === customer.id);

            expect(result).toEqual(
                expect.objectContaining({
                    id: customer.id,
                    firstName: 'Zapier',
                    primaryEmail: customer.emails[0].email,
                }),
            );
        });

        it('emits a reservation and emits a new item ID after an update', async () => {
            if (!customer) return;

            const { reservationTypes } = await request('reservation-type', {
                params: { limit: 1 },
            });
            const reservationType = reservationTypes[0];

            if (
                !reservationType ||
                !reservationType.options ||
                !reservationType.options[0]
            ) {
                throw new Error(
                    'The staging tenant needs a reservation experience with an option',
                );
            }

            const reservationOption = reservationType.options[0];
            const reservationDate = getNextReservationDate(reservationType);
            const reservationCloseOutDate = new Date(
                new Date(reservationDate).getTime() +
                    reservationType.minutesAllotted * 60 * 1000,
            ).toISOString();

            reservationCreatedAfter = new Date(Date.now() - 5000).toISOString();
            reservation = await request('reservation', {
                method: 'POST',
                params: { isSendTransactionEmail: false },
                body: {
                    channel: 'Inbound',
                    externalReservationNumber: `zapier-${Date.now()}`,
                    externalReservationVendor: 'Zapier Integration Test',
                    customerId: customer.id,
                    reservationDate,
                    reservationCloseOutDate,
                    reservationTypeId: reservationType.id,
                    reservationTypeOptionId: reservationOption.id,
                    reservationLocationId:
                        reservationType.defaultReservationLocationId,
                    guestCount: 2,
                    status: 'Paid',
                    paymentStatus: 'Paid',
                    reservationPaidDate: new Date().toISOString(),
                    sku: reservationOption.sku,
                    price: reservationOption.price,
                    tenderType: 'Cash',
                    notes: FIXTURE_PREFIX,
                },
            });

            const firstResults = await appTester(
                App.triggers.new_reservation.operation.perform,
                {
                    ...bundle,
                    inputData: { after: reservationCreatedAfter },
                },
            );
            const first = firstResults.find(
                (item) => item.originalId === reservation.id,
            );

            expect(first).toEqual(
                expect.objectContaining({
                    originalId: reservation.id,
                    guestCount: 2,
                    notes: FIXTURE_PREFIX,
                }),
            );

            reservation = await request(`reservation/${reservation.id}`, {
                method: 'PUT',
                body: {
                    guestCount: 3,
                    notes: `${FIXTURE_PREFIX}-updated`,
                    isSendEmailConfirmation: false,
                },
            });

            const updatedResults = await appTester(
                App.triggers.new_reservation.operation.perform,
                {
                    ...bundle,
                    inputData: { after: reservationCreatedAfter },
                },
            );
            const updated = updatedResults.find(
                (item) => item.originalId === reservation.id,
            );

            expect(updated).toEqual(
                expect.objectContaining({
                    originalId: reservation.id,
                    guestCount: 3,
                    notes: `${FIXTURE_PREFIX}-updated`,
                }),
            );
            expect(updated.id).not.toBe(first.id);
        });

        it('emits the reservation after it is closed out', async () => {
            if (!reservation) return;

            const closeOutTime = new Date().toISOString();
            const closedAfter = new Date(Date.now() - 5000).toISOString();

            await request(`reservation/${reservation.id}/check-in`, {
                method: 'PUT',
                body: {
                    checkInTime: new Date(Date.now() - 1000).toISOString(),
                },
            });

            reservation = await request(`reservation/${reservation.id}/close-out`, {
                method: 'PUT',
                body: {
                    closeOutTime,
                },
            });

            const results = await appTester(
                App.triggers.closed_reservation.operation.perform,
                {
                    ...bundle,
                    inputData: { after: closedAfter },
                },
            );
            const result = results.find(
                (item) => item.originalId === reservation.id,
            );

            expect(result).toEqual(
                expect.objectContaining({
                    originalId: reservation.id,
                    status: 'Closed Out',
                    closeOutTime,
                }),
            );
        });
    });
});
