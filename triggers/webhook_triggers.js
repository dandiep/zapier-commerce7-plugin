const { getById, makeRequest } = require('../utils/api');
const {
    customerOutputFields,
    genericOutputFields,
    normalizeCustomer,
} = require('../utils/fields');
const {
    createWebhookPerform,
    subscribeWebhook,
    unsubscribeWebhook,
} = require('../utils/webhooks');

const customerSample = normalizeCustomer(
    require('../samples/sample_new_customer'),
);
const reservationSample = require('../samples/sample_new_reservation');
const clubPackageSample = {
    id: '6d3df02f-60b1-4adf-8509-011fc879ef9e',
    clubId: '76cd21a9-ab2b-4d77-8744-f138d0f613cf',
    title: 'Fall Club Package',
    status: 'Draft',
    createdAt: '2026-07-12T18:00:00.000Z',
    updatedAt: '2026-07-12T18:00:00.000Z',
};

const withEventFields = (fields) => [
    ...fields,
    { key: 'originalId', label: 'Original Commerce7 ID', type: 'string' },
    { key: 'eventAction', label: 'Webhook Action', type: 'string' },
    { key: 'eventObject', label: 'Webhook Object', type: 'string' },
    { key: 'eventTenantId', label: 'Webhook Tenant ID', type: 'string' },
];

const performList = async (
    z,
    bundle,
    endpoint,
    collectionKey,
    sample,
    params = {},
) => {
    const response = await makeRequest(z, bundle, endpoint, {
        limit: 1,
        ...params,
    });
    return response[collectionKey]?.length ? response[collectionKey] : [sample];
};

const createHookTrigger = ({
    key,
    noun,
    label,
    description,
    events,
    sample,
    outputFields,
    list,
    filter,
    makeEventId,
    resolveObject,
    transform,
}) => ({
    key,
    noun,
    display: { label, description },
    operation: {
        type: 'hook',
        performSubscribe: (z, bundle) => subscribeWebhook(z, bundle, events),
        performUnsubscribe: unsubscribeWebhook,
        perform: createWebhookPerform({
            filter,
            makeEventId,
            resolveObject,
            transform,
        }),
        performList: list,
        sample,
        outputFields: withEventFields(outputFields),
    },
});

const customerCreated = createHookTrigger({
    key: 'customer_created',
    noun: 'Customer',
    label: 'Customer Created',
    description: 'Triggers when a customer is created in Commerce7.',
    events: [{ object: 'Customer', action: 'Create' }],
    sample: customerSample,
    outputFields: customerOutputFields,
    transform: normalizeCustomer,
    list: async (z, bundle) =>
        (
            await performList(
                z,
                bundle,
                'customer',
                'customers',
                customerSample,
            )
        ).map(normalizeCustomer),
});

const customerUpdated = createHookTrigger({
    key: 'customer_updated',
    noun: 'Customer',
    label: 'Customer Updated',
    description: 'Triggers when a customer is updated in Commerce7.',
    events: [
        { object: 'Customer', action: 'Update' },
        { object: 'Customer', action: 'Bulk Update' },
        { object: 'Customer Address', action: 'Create' },
        { object: 'Customer Address', action: 'Update' },
        { object: 'Customer Address', action: 'Delete' },
    ],
    sample: customerSample,
    outputFields: customerOutputFields,
    transform: normalizeCustomer,
    list: async (z, bundle) =>
        (
            await performList(
                z,
                bundle,
                'customer',
                'customers',
                customerSample,
            )
        ).map(normalizeCustomer),
    resolveObject: (z, bundle, event) =>
        getById(
            z,
            bundle,
            'customer',
            event.object === 'Customer Address'
                ? event.payload.customerId
                : event.payload.id,
        ),
    makeEventId: (customer, event) =>
        `${customer.id}-updated-${event.object.replace(/\s/g, '-').toLowerCase()}-${
            event.payload.updatedAt || customer.updatedAt
        }`,
});

const clubPackageCreated = createHookTrigger({
    key: 'club_package_created',
    noun: 'Club Package',
    label: 'Club Package Created',
    description: 'Triggers when a club package is created in Commerce7.',
    events: [{ object: 'Club Package', action: 'Create' }],
    sample: clubPackageSample,
    outputFields: [
        ...genericOutputFields,
        { key: 'clubId', label: 'Club ID', type: 'string' },
        { key: 'title', label: 'Title', type: 'string' },
        { key: 'status', label: 'Status', type: 'string' },
    ],
    list: (z, bundle) =>
        performList(
            z,
            bundle,
            'club-package',
            'clubPackages',
            clubPackageSample,
        ),
});

const reservationCancelledOrDeleted = createHookTrigger({
    key: 'reservation_cancelled_or_deleted',
    noun: 'Reservation',
    label: 'Reservation Cancelled or Deleted',
    description:
        'Triggers when a reservation is cancelled or deleted in Commerce7.',
    events: [
        { object: 'Reservation', action: 'Update' },
        { object: 'Reservation', action: 'Delete' },
    ],
    sample: { ...reservationSample, status: 'Cancelled' },
    outputFields: [
        ...genericOutputFields,
        { key: 'customerId', label: 'Customer ID', type: 'string' },
        { key: 'status', label: 'Status', type: 'string' },
        { key: 'reservationDate', label: 'Reservation Date', type: 'datetime' },
    ],
    list: (z, bundle) =>
        performList(
            z,
            bundle,
            'reservation',
            'reservations',
            { ...reservationSample, status: 'Cancelled' },
            { status: 'Cancelled' },
        ),
    filter: (event) =>
        event.action === 'Delete' ||
        (event.action === 'Update' && event.payload.status === 'Cancelled'),
    makeEventId: (reservation, event) =>
        `${reservation.id}-${event.action.toLowerCase()}-${
            reservation.updatedAt || Date.now()
        }`,
});

module.exports = {
    clubPackageCreated,
    customerCreated,
    customerUpdated,
    reservationCancelledOrDeleted,
};
