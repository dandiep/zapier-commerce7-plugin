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
    let customerTag;
    let customerNote;
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

    const createReservationFixture = async ({ status = 'Paid' } = {}) => {
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

        return request('reservation', {
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
                status,
                paymentStatus: 'Paid',
                reservationPaidDate: new Date().toISOString(),
                sku: reservationOption.sku,
                price: reservationOption.price,
                tenderType: 'Cash',
                notes: FIXTURE_PREFIX,
            },
        });
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
                customer = await appTester(
                    App.creates.create_customer.operation.perform,
                    {
                        ...bundle,
                        inputData: {
                            firstName: 'Zapier',
                            lastName: `Integration ${runId}`,
                            email: `${FIXTURE_PREFIX}+${runId}@example.com`,
                            phone: '+15035550123',
                            countryCode: 'US',
                        },
                    },
                );
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
            if (customerNote && customerNote.id) {
                await request(`note/${customerNote.id}`, { method: 'DELETE' });
            }

            if (customerTag && customerTag.id) {
                await request(`tag/customer/${customerTag.id}`, {
                    method: 'DELETE',
                });
            }

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

        it('finds and updates the customer through Zapier operations', async () => {
            const byId = await appTester(
                App.searches.find_customer_by_id.operation.perform,
                { ...bundle, inputData: { id: customer.id } },
            );
            const byEmail = await appTester(
                App.searches.find_customer_by_email.operation.perform,
                {
                    ...bundle,
                    inputData: { email: customer.primaryEmail.toUpperCase() },
                },
            );
            const byPhone = await appTester(
                App.searches.find_customer_by_phone.operation.perform,
                { ...bundle, inputData: { phone: '+1 (503) 555-0123' } },
            );

            expect(byId[0].id).toBe(customer.id);
            expect(byEmail[0].id).toBe(customer.id);
            expect(byPhone[0].id).toBe(customer.id);

            customer = await appTester(
                App.creates.update_customer.operation.perform,
                {
                    ...bundle,
                    inputData: {
                        customer_id: customer.id,
                        lastName: 'Integration Updated',
                        email: `${FIXTURE_PREFIX}+updated-${Date.now()}@example.com`,
                        phone: '+15035550456',
                        city: 'Portland',
                        stateCode: 'OR',
                        zipCode: '97205',
                        countryCode: 'US',
                    },
                },
            );

            expect(customer).toEqual(
                expect.objectContaining({
                    lastName: 'Integration Updated',
                    city: 'Portland',
                    primaryPhone: '+15035550456',
                }),
            );

            customer = await appTester(
                App.creates.update_customer_custom_fields.operation.perform,
                {
                    ...bundle,
                    inputData: {
                        customer_id: customer.id,
                        custom_fields_json: '{}',
                    },
                },
            );
        });

        it('adds a note and adds then removes a customer tag', async () => {
            const tagRunId = `${Date.now()}-${process.pid}`;
            customerTag = await request('tag/customer', {
                method: 'POST',
                body: {
                    title: `Zapier Integration Test ${tagRunId}`,
                    type: 'Manual',
                },
            });

            customer = await appTester(
                App.creates.add_tag_to_customer.operation.perform,
                {
                    ...bundle,
                    inputData: {
                        customer_id: customer.id,
                        tag_id: customerTag.id,
                    },
                },
            );
            expect(customer.tags.some((tag) => tag.id === customerTag.id)).toBe(
                true,
            );

            customer = await appTester(
                App.creates.remove_tag_from_customer.operation.perform,
                {
                    ...bundle,
                    inputData: {
                        customer_id: customer.id,
                        tag_id: customerTag.id,
                    },
                },
            );
            expect(customer.tags.some((tag) => tag.id === customerTag.id)).toBe(
                false,
            );

            customerNote = await appTester(
                App.creates.add_customer_note.operation.perform,
                {
                    ...bundle,
                    inputData: {
                        customer_id: customer.id,
                        content: FIXTURE_PREFIX,
                    },
                },
            );
            expect(customerNote).toEqual(
                expect.objectContaining({
                    customerId: customer.id,
                    content: FIXTURE_PREFIX,
                }),
            );
        });

        it('handles empty order, club membership, and club package searches', async () => {
            const missingId = '00000000-0000-0000-0000-000000000000';
            const searches = [
                ['find_order_by_id', { id: missingId }],
                ['find_club_membership_by_id', { id: missingId }],
                ['find_club_package_by_id', { id: missingId }],
                [
                    'find_club_memberships_by_customer',
                    { customer_id: customer.id },
                ],
            ];

            for (const [key, inputData] of searches) {
                const results = await appTester(
                    App.searches[key].operation.perform,
                    {
                        ...bundle,
                        inputData,
                    },
                );
                expect(results).toEqual([]);
            }

            const clubPackageSamples = await appTester(
                App.triggers.club_package_created.operation.performList,
                bundle,
            );
            expect(clubPackageSamples).toHaveLength(1);
        });

        it('emits a reservation and emits a new item ID after an update', async () => {
            if (!customer) return;

            reservationCreatedAfter = new Date(Date.now() - 5000).toISOString();
            reservation = await createReservationFixture();

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

            const reservationSearch = await appTester(
                App.searches.find_reservation_by_id.operation.perform,
                { ...bundle, inputData: { id: reservation.id } },
            );
            expect(reservationSearch[0].id).toBe(reservation.id);

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

            reservation = await request(
                `reservation/${reservation.id}/close-out`,
                {
                    method: 'PUT',
                    body: {
                        closeOutTime,
                    },
                },
            );

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

        it('emits a cancelled reservation update from Commerce7', async () => {
            const cancelledReservation = await createReservationFixture({
                status: 'Cancelled',
            });

            try {
                expect(cancelledReservation.status).toBe('Cancelled');

                const events = await appTester(
                    App.triggers.reservation_cancelled_or_deleted.operation
                        .perform,
                    {
                        ...bundle,
                        cleanedRequest: {
                            object: 'Reservation',
                            action: 'Update',
                            tenantId,
                            payload: cancelledReservation,
                        },
                    },
                );
                expect(events[0]).toEqual(
                    expect.objectContaining({
                        originalId: cancelledReservation.id,
                        status: 'Cancelled',
                        eventAction: 'Update',
                    }),
                );
            } finally {
                await request(`reservation/${cancelledReservation.id}`, {
                    method: 'DELETE',
                });
            }

            const deletedEvents = await appTester(
                App.triggers.reservation_cancelled_or_deleted.operation.perform,
                {
                    ...bundle,
                    cleanedRequest: {
                        object: 'Reservation',
                        action: 'Delete',
                        tenantId,
                        payload: cancelledReservation,
                    },
                },
            );
            expect(deletedEvents[0]).toEqual(
                expect.objectContaining({
                    originalId: cancelledReservation.id,
                    eventAction: 'Delete',
                }),
            );
        });

        it('subscribes, lists, and unsubscribes a Commerce7 webhook', async () => {
            const operation = App.triggers.customer_created.operation;
            const subscribeData = await appTester(operation.performSubscribe, {
                ...bundle,
                targetUrl:
                    'https://example.com/zapier-commerce7-integration-test',
            });

            const webHooks = await request('web-hook', {
                params: { limit: 50 },
            });
            expect(
                webHooks.webHooks.some((hook) =>
                    subscribeData.webHookIds.includes(hook.id),
                ),
            ).toBe(true);

            await appTester(operation.performUnsubscribe, {
                ...bundle,
                subscribeData,
            });

            const afterDelete = await request('web-hook', {
                params: { limit: 50 },
            });
            expect(
                afterDelete.webHooks.some((hook) =>
                    subscribeData.webHookIds.includes(hook.id),
                ),
            ).toBe(false);
        });
    });
});
