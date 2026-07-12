const customerOutputFields = [
    { key: 'id', label: 'Customer ID', type: 'string', primary: true },
    { key: 'createdAt', label: 'Created At', type: 'datetime' },
    { key: 'updatedAt', label: 'Updated At', type: 'datetime' },
    { key: 'firstName', label: 'First Name', type: 'string' },
    { key: 'lastName', label: 'Last Name', type: 'string' },
    { key: 'primaryEmail', label: 'Primary Email', type: 'string' },
    { key: 'primaryPhone', label: 'Primary Phone', type: 'string' },
    {
        key: 'emailMarketingStatus',
        label: 'Email Marketing Status',
        type: 'string',
    },
    { key: 'city', label: 'City', type: 'string' },
    { key: 'stateCode', label: 'State/Province', type: 'string' },
    { key: 'zipCode', label: 'Postal Code', type: 'string' },
    { key: 'countryCode', label: 'Country', type: 'string' },
];

const customerInputFields = [
    { key: 'firstName', label: 'First Name', type: 'string' },
    { key: 'lastName', label: 'Last Name', type: 'string' },
    { key: 'email', label: 'Primary Email', type: 'string' },
    { key: 'phone', label: 'Primary Phone', type: 'string' },
    { key: 'birthDate', label: 'Birth Date', type: 'string' },
    { key: 'city', label: 'City', type: 'string' },
    { key: 'stateCode', label: 'State/Province Code', type: 'string' },
    { key: 'zipCode', label: 'Postal Code', type: 'string' },
    { key: 'countryCode', label: 'Country Code', type: 'string' },
    {
        key: 'emailMarketingStatus',
        label: 'Email Marketing Status',
        type: 'string',
        choices: ['Subscribed', 'Unsubscribed'],
    },
];

const normalizeCustomer = (customer) => ({
    ...customer,
    primaryEmail: customer.emails?.[0]?.email || '',
    primaryPhone: customer.phones?.[0]?.phone || '',
});

const genericOutputFields = [
    { key: 'id', label: 'ID', type: 'string', primary: true },
    { key: 'createdAt', label: 'Created At', type: 'datetime' },
    { key: 'updatedAt', label: 'Updated At', type: 'datetime' },
];

module.exports = {
    customerInputFields,
    customerOutputFields,
    genericOutputFields,
    normalizeCustomer,
};
