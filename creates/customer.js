const { getById, makeRequest } = require('../utils/api');
const {
    customerInputFields,
    customerOutputFields,
    genericOutputFields,
    normalizeCustomer,
} = require('../utils/fields');

const customerSample = normalizeCustomer(
    require('../samples/sample_new_customer'),
);
const noteSample = {
    id: 'd6a88d79-32cd-444d-a222-c9a19ce6c0cb',
    type: 'Note',
    content: 'Follow up after the tasting.',
    noteDate: '2026-07-12T18:00:00.000Z',
    customerId: customerSample.id,
    createdAt: '2026-07-12T18:00:00.000Z',
    updatedAt: '2026-07-12T18:00:00.000Z',
};

const hasInput = (bundle, key) =>
    Object.prototype.hasOwnProperty.call(bundle.inputData || {}, key) &&
    bundle.inputData[key] !== undefined &&
    bundle.inputData[key] !== null &&
    bundle.inputData[key] !== '';

const buildScalarFields = (bundle) => {
    const result = {};

    for (const field of customerInputFields) {
        if (field.key === 'email' || field.key === 'phone') continue;
        if (hasInput(bundle, field.key))
            result[field.key] = bundle.inputData[field.key];
    }

    return result;
};

const replacePrimary = (items, key, value) => {
    const existing = items || [];

    if (existing.length === 0) return [{ [key]: value }];

    return [
        {
            ...(existing[0].id ? { id: existing[0].id } : {}),
            [key]: value,
        },
        ...existing.slice(1).map((item) => ({
            ...(item.id ? { id: item.id } : {}),
            [key]: item[key],
        })),
    ];
};

const createCustomer = {
    key: 'create_customer',
    noun: 'Customer',
    display: {
        label: 'Create Customer',
        description: 'Creates a customer in Commerce7.',
    },
    operation: {
        inputFields: customerInputFields.map((field) => ({
            ...field,
            required: field.key === 'email',
        })),
        outputFields: customerOutputFields,
        sample: customerSample,
        perform: async (z, bundle) => {
            if (hasInput(bundle, 'phone') && !hasInput(bundle, 'countryCode')) {
                throw new Error(
                    'Country Code is required when Primary Phone is provided',
                );
            }

            const body = {
                ...buildScalarFields(bundle),
                emails: [{ email: bundle.inputData.email }],
            };

            if (hasInput(bundle, 'phone')) {
                body.phones = [{ phone: bundle.inputData.phone }];
            }

            const customer = await makeRequest(
                z,
                bundle,
                'customer',
                { isSendTransactionEmail: false },
                'POST',
                body,
            );
            return normalizeCustomer(customer);
        },
    },
};

const updateCustomer = {
    key: 'update_customer',
    noun: 'Customer',
    display: {
        label: 'Update Customer',
        description:
            'Updates customer contact and profile fields in Commerce7.',
    },
    operation: {
        inputFields: [
            {
                key: 'customer_id',
                label: 'Customer ID',
                type: 'string',
                required: true,
            },
            ...customerInputFields,
        ],
        outputFields: customerOutputFields,
        sample: customerSample,
        perform: async (z, bundle) => {
            const body = buildScalarFields(bundle);

            if (hasInput(bundle, 'email') || hasInput(bundle, 'phone')) {
                const current = await getById(
                    z,
                    bundle,
                    'customer',
                    bundle.inputData.customer_id,
                );

                if (hasInput(bundle, 'email')) {
                    body.emails = replacePrimary(
                        current.emails,
                        'email',
                        bundle.inputData.email,
                    );
                }

                if (hasInput(bundle, 'phone')) {
                    if (!body.countryCode && current.countryCode) {
                        body.countryCode = current.countryCode;
                    }
                    if (!body.countryCode) {
                        throw new Error(
                            'Country Code is required when Primary Phone is provided',
                        );
                    }
                    body.phones = replacePrimary(
                        current.phones,
                        'phone',
                        bundle.inputData.phone,
                    );
                }
            }

            if (Object.keys(body).length === 0) {
                throw new Error(
                    'Provide at least one customer field to update',
                );
            }

            const customer = await makeRequest(
                z,
                bundle,
                `customer/${bundle.inputData.customer_id}`,
                {},
                'PUT',
                body,
            );
            return normalizeCustomer(customer);
        },
    },
};

const createCustomerTagAction = ({ key, label, remove }) => ({
    key,
    noun: 'Customer',
    display: {
        label,
        description: `${remove ? 'Removes' : 'Adds'} a manual tag ${
            remove ? 'from' : 'to'
        } a Commerce7 customer.`,
    },
    operation: {
        inputFields: [
            {
                key: 'customer_id',
                label: 'Customer ID',
                type: 'string',
                required: true,
            },
            {
                key: 'tag_id',
                label: 'Tag ID',
                type: 'string',
                required: true,
            },
        ],
        outputFields: customerOutputFields,
        sample: customerSample,
        perform: async (z, bundle) => {
            const current = await getById(
                z,
                bundle,
                'customer',
                bundle.inputData.customer_id,
            );
            const tagIds = (current.tags || []).map((tag) => tag.id);
            const nextTagIds = remove
                ? tagIds.filter((id) => id !== bundle.inputData.tag_id)
                : [...new Set([...tagIds, bundle.inputData.tag_id])];
            const customer = await makeRequest(
                z,
                bundle,
                `customer/${bundle.inputData.customer_id}`,
                {},
                'PUT',
                { tags: nextTagIds.map((id) => ({ id })) },
            );
            return normalizeCustomer(customer);
        },
    },
});

const addTagToCustomer = createCustomerTagAction({
    key: 'add_tag_to_customer',
    label: 'Add Tag to Customer',
    remove: false,
});

const removeTagFromCustomer = createCustomerTagAction({
    key: 'remove_tag_from_customer',
    label: 'Remove Tag From Customer',
    remove: true,
});

const addCustomerNote = {
    key: 'add_customer_note',
    noun: 'Note',
    display: {
        label: 'Add Customer Note',
        description: 'Adds a note to a Commerce7 customer.',
    },
    operation: {
        inputFields: [
            {
                key: 'customer_id',
                label: 'Customer ID',
                type: 'string',
                required: true,
            },
            {
                key: 'content',
                label: 'Note',
                type: 'text',
                required: true,
            },
            {
                key: 'note_date',
                label: 'Note Date',
                type: 'datetime',
                required: false,
            },
        ],
        outputFields: [
            ...genericOutputFields,
            { key: 'customerId', label: 'Customer ID', type: 'string' },
            { key: 'content', label: 'Note', type: 'string' },
            { key: 'noteDate', label: 'Note Date', type: 'datetime' },
        ],
        sample: noteSample,
        perform: (z, bundle) =>
            makeRequest(z, bundle, 'note', {}, 'POST', {
                type: 'Note',
                content: bundle.inputData.content,
                noteDate:
                    bundle.inputData.note_date || new Date().toISOString(),
                customerId: bundle.inputData.customer_id,
            }),
    },
};

const updateCustomerCustomFields = {
    key: 'update_customer_custom_fields',
    noun: 'Customer',
    display: {
        label: 'Update Customer Custom Fields',
        description:
            'Merges custom field values into a Commerce7 customer profile.',
    },
    operation: {
        inputFields: [
            {
                key: 'customer_id',
                label: 'Customer ID',
                type: 'string',
                required: true,
            },
            {
                key: 'custom_fields_json',
                label: 'Custom Fields JSON',
                type: 'text',
                required: true,
                helpText:
                    'A JSON object keyed by the Commerce7 custom field code.',
            },
        ],
        outputFields: customerOutputFields,
        sample: customerSample,
        perform: async (z, bundle) => {
            let updates;

            try {
                updates = JSON.parse(bundle.inputData.custom_fields_json);
            } catch (error) {
                throw new Error(
                    'Custom Fields JSON must be a valid JSON object',
                );
            }

            if (
                !updates ||
                Array.isArray(updates) ||
                typeof updates !== 'object'
            ) {
                throw new Error(
                    'Custom Fields JSON must be a valid JSON object',
                );
            }

            const current = await getById(
                z,
                bundle,
                'customer',
                bundle.inputData.customer_id,
            );
            const customer = await makeRequest(
                z,
                bundle,
                `customer/${bundle.inputData.customer_id}`,
                {},
                'PUT',
                { metaData: { ...(current.metaData || {}), ...updates } },
            );
            return normalizeCustomer(customer);
        },
    },
};

module.exports = {
    addCustomerNote,
    addTagToCustomer,
    createCustomer,
    removeTagFromCustomer,
    updateCustomer,
    updateCustomerCustomFields,
};
