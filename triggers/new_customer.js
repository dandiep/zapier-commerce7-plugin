const sample = require('../samples/sample_new_customer');

const { makeRequest } = require('../utils/api');

const DEFAULT_LOOKBACK_HOURS = 1;

const getAfterTimestamp = (bundle) => {
    const inputData = bundle.inputData || {};
    const afterValue = inputData.after;

    if (afterValue) {
        const afterTimestamp = new Date(afterValue).getTime();

        if (!Number.isNaN(afterTimestamp)) {
            return afterTimestamp;
        }
    }

    const after = new Date();
    after.setHours(after.getHours() - DEFAULT_LOOKBACK_HOURS);
    return after.getTime();
};

const customerOutputFields = [
    { key: 'id', label: 'ID', type: 'string', primary: true },
    { key: 'createdAt', label: 'Created At', type: 'datetime' },
    { key: 'updatedAt', label: 'Updated At', type: 'datetime' },
    { key: 'firstName', label: 'First Name', type: 'string' },
    { key: 'lastName', label: 'Last Name', type: 'string' },
    { key: 'primaryEmail', label: 'Primary Email', type: 'string' },
    { key: 'emailMarketingStatus', label: 'Email Marketing Status', type: 'string' },
    { key: 'city', label: 'City', type: 'string' },
    { key: 'stateCode', label: 'State/Province', type: 'string' },
    { key: 'countryCode', label: 'Country', type: 'string' },
    { key: 'hasAccount', label: 'Has Account', type: 'boolean' },
    {
        key: 'emails',
        label: 'Emails',
        list: true,
        children: [
            { key: 'email', label: 'Email', type: 'string' },
            { key: 'status', label: 'Status', type: 'string' },
        ]
    },
    {
        key: 'phones',
        label: 'Phones',
        list: true,
        children: [
            { key: 'phone', label: 'Phone', type: 'string' },
        ]
    },
];

const perform = (z, bundle) => {
    const afterTimestamp = getAfterTimestamp(bundle);
    const params = {
        createdAt: `gt:${new Date(afterTimestamp).toISOString()}`,
    };

    return makeRequest(z, bundle, 'customer', params)
        .then((response) => {
            const customers = response.customers || [];
            const highestCreatedAt = customers.reduce((highest, customer) => {
                const createdAt = new Date(customer.createdAt).getTime();

                if (Number.isNaN(createdAt)) {
                    return highest;
                }

                return Math.max(highest, createdAt);
            }, afterTimestamp);

            return customers.map((customer) => ({
                ...customer,
                primaryEmail: customer.emails && customer.emails.length > 0
                    ? customer.emails[0].email || ''
                    : '',
                _meta: {
                    after: highestCreatedAt,
                },
            }));
        });
};

module.exports = {
    key: 'new_customer',
    noun: 'Customer',

    display: {
        label: 'New Customer',
        description: 'Triggers when a customer is created in Commerce7.',
    },

    operation: {
        type: 'polling',
        perform,
        inputFields: [],
        sample,
        outputFields: customerOutputFields,
    },
};