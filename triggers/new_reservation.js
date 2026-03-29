const sample = require('../samples/sample_new_reservation');

const { createReservationTrigger } = require('./reservation_trigger');

module.exports = createReservationTrigger({
    key: 'new_reservation',
    label: 'New Reservation',
    description: 'Triggers when a reservation is created or updated in Commerce7.',
    sample,
});
