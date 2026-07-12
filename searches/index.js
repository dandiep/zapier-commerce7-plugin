const { findWithCursor, getById, makeRequest } = require('../utils/api');
const {
    customerOutputFields,
    genericOutputFields,
    normalizeCustomer,
} = require('../utils/fields');

const customerSample = normalizeCustomer(
    require('../samples/sample_new_customer'),
);
const reservationSample = require('../samples/sample_new_reservation');
const orderSample = {
    id: 'f0c9c69c-17ef-4893-ab1d-ae496ca08f23',
    orderNumber: 1001,
    customerId: customerSample.id,
    total: 5000,
    createdAt: '2026-07-12T18:00:00.000Z',
    updatedAt: '2026-07-12T18:00:00.000Z',
};
const clubMembershipSample = {
    id: '28e4c85b-2834-4370-82d9-582cd0069250',
    customerId: customerSample.id,
    clubId: '76cd21a9-ab2b-4d77-8744-f138d0f613cf',
    status: 'Active',
    signupDate: '2026-07-12T18:00:00.000Z',
    createdAt: '2026-07-12T18:00:00.000Z',
    updatedAt: '2026-07-12T18:00:00.000Z',
};
const clubPackageSample = {
    id: '6d3df02f-60b1-4adf-8509-011fc879ef9e',
    clubId: clubMembershipSample.clubId,
    title: 'Fall Club Package',
    status: 'Draft',
    createdAt: '2026-07-12T18:00:00.000Z',
    updatedAt: '2026-07-12T18:00:00.000Z',
};

const idInputField = (label) => ({
    key: 'id',
    label: `${label} ID`,
    type: 'string',
    required: true,
});

const createIdSearch = ({
    key,
    noun,
    endpoint,
    outputFields = genericOutputFields,
    transform = (value) => value,
    sample,
}) => ({
    key,
    noun,
    display: {
        label: `Find ${noun} by ID`,
        description: `Finds a Commerce7 ${noun.toLowerCase()} by its ID.`,
    },
    operation: {
        inputFields: [idInputField(noun)],
        outputFields,
        sample,
        perform: async (z, bundle) => {
            const result = await getById(
                z,
                bundle,
                endpoint,
                bundle.inputData.id,
            );
            return result ? [transform(result)] : [];
        },
    },
});

const customerById = createIdSearch({
    key: 'find_customer_by_id',
    noun: 'Customer',
    endpoint: 'customer',
    outputFields: customerOutputFields,
    transform: normalizeCustomer,
    sample: customerSample,
});

const createCustomerFieldSearch = ({ key, label, inputKey, normalize }) => ({
    key,
    noun: 'Customer',
    display: {
        label: `Find Customer by ${label}`,
        description: `Finds a Commerce7 customer with an exact matching ${label.toLowerCase()}.`,
    },
    operation: {
        inputFields: [
            {
                key: inputKey,
                label,
                type: 'string',
                required: true,
            },
        ],
        outputFields: customerOutputFields,
        sample: customerSample,
        perform: async (z, bundle) => {
            const expected = normalize(bundle.inputData[inputKey]);
            const customer = await findWithCursor(
                z,
                bundle,
                'customer',
                'customers',
                (candidate) => {
                    const values = candidate[`${inputKey}s`] || [];
                    return values.some(
                        (item) => normalize(item[inputKey]) === expected,
                    );
                },
            );

            return customer ? [normalizeCustomer(customer)] : [];
        },
    },
});

const customerByEmail = createCustomerFieldSearch({
    key: 'find_customer_by_email',
    label: 'Email',
    inputKey: 'email',
    normalize: (value) =>
        String(value || '')
            .trim()
            .toLowerCase(),
});

const customerByPhone = createCustomerFieldSearch({
    key: 'find_customer_by_phone',
    label: 'Phone',
    inputKey: 'phone',
    normalize: (value) => String(value || '').replace(/\D/g, ''),
});

const orderById = createIdSearch({
    key: 'find_order_by_id',
    noun: 'Order',
    endpoint: 'order',
    outputFields: [
        ...genericOutputFields,
        { key: 'orderNumber', label: 'Order Number', type: 'integer' },
        { key: 'customerId', label: 'Customer ID', type: 'string' },
        { key: 'total', label: 'Total', type: 'integer' },
    ],
    sample: orderSample,
});

const reservationById = createIdSearch({
    key: 'find_reservation_by_id',
    noun: 'Reservation',
    endpoint: 'reservation',
    outputFields: [
        ...genericOutputFields,
        { key: 'customerId', label: 'Customer ID', type: 'string' },
        { key: 'status', label: 'Status', type: 'string' },
        { key: 'reservationDate', label: 'Reservation Date', type: 'datetime' },
    ],
    sample: reservationSample,
});

const clubMembershipOutputFields = [
    ...genericOutputFields,
    { key: 'customerId', label: 'Customer ID', type: 'string' },
    { key: 'clubId', label: 'Club ID', type: 'string' },
    { key: 'status', label: 'Status', type: 'string' },
    { key: 'signupDate', label: 'Signup Date', type: 'datetime' },
];

const clubMembershipById = createIdSearch({
    key: 'find_club_membership_by_id',
    noun: 'Club Membership',
    endpoint: 'club-membership',
    outputFields: clubMembershipOutputFields,
    sample: clubMembershipSample,
});

const clubMembershipsByCustomer = {
    key: 'find_club_memberships_by_customer',
    noun: 'Club Membership',
    display: {
        label: 'Find Club Memberships by Customer',
        description: 'Finds all Commerce7 club memberships for a customer.',
    },
    operation: {
        inputFields: [
            {
                key: 'customer_id',
                label: 'Customer ID',
                type: 'string',
                required: true,
            },
        ],
        outputFields: clubMembershipOutputFields,
        sample: clubMembershipSample,
        perform: async (z, bundle) => {
            const response = await makeRequest(z, bundle, 'club-membership', {
                customerId: bundle.inputData.customer_id,
                limit: 50,
            });
            return response.clubMemberships || [];
        },
    },
};

const clubPackageById = createIdSearch({
    key: 'find_club_package_by_id',
    noun: 'Club Package',
    endpoint: 'club-package',
    outputFields: [
        ...genericOutputFields,
        { key: 'clubId', label: 'Club ID', type: 'string' },
        { key: 'title', label: 'Title', type: 'string' },
        { key: 'status', label: 'Status', type: 'string' },
    ],
    sample: clubPackageSample,
});

module.exports = {
    clubMembershipById,
    clubMembershipsByCustomer,
    clubPackageById,
    customerByEmail,
    customerById,
    customerByPhone,
    orderById,
    reservationById,
};
