const { makeRequest } = require('../utils/api');
const sample = require('../samples/sample_new_reservation');

// Get a list of reservations
const listReservations = (z, bundle) => {
    const params = {
        // limit: 100,
        // sort: 'createdAt:desc'
    };

    // If after is present, add it to the parameters
    if (bundle.inputData.after) {
        params.createdAt = `gt:${bundle.inputData.after}`;
    }

    return makeRequest(z, bundle, 'reservation', params)
        .then(response => {
            return response.reservations || [];
        });
};

module.exports = {
    key: 'new_reservation',
    noun: 'Reservation',

    display: {
        label: 'New Reservation',
        description: 'Triggers when a new reservation is created in Commerce7.'
    },

    operation: {
        type: 'polling',
        perform: listReservations,
        inputFields: [],
        sample,
        outputFields: [
            { key: 'id', label: 'ID', type: 'string', primary: true },
            { key: 'createdAt', label: 'Created At', type: 'datetime' },
            { key: 'updatedAt', label: 'Updated At', type: 'datetime' },
            { key: 'status', label: 'Status', type: 'string' },
            { key: 'customerName', label: 'Customer Name', type: 'string' },
            { key: 'reservationDate', label: 'Reservation Date', type: 'datetime' },
            { key: 'sku', label: 'SKU', type: 'datetime' },
            { key: 'guestCount', label: "Guest Count", type: 'number' },
            {
                key: 'customer', children: [
                    { key: 'firstName', label: 'First Name', type: 'string' },
                    { key: 'lastName', label: 'Last Name', type: 'string' },
                    { key: 'email', label: 'Email', type: 'string' },
                ]
            },
            {
                key: 'reservationType', children: [
                    { key: 'title', label: 'Reservation Type Title', type: 'string' },
                ]
            },
        ]
    },
};
