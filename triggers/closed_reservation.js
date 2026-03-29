const sample = require('../samples/sample_closed_reservation');

const { createReservationTrigger } = require('./reservation_trigger');

module.exports = createReservationTrigger({
    key: 'closed_reservation',
    label: 'Closed Reservation',
    description: 'Triggers when a reservation is closed in Commerce7.',
    sample,
    filterReservation: (reservation) => {
        return typeof reservation.status === 'string'
            && reservation.status === "Closed Out";
    },
    makeId: (reservation) => `${reservation.id}-closed`,
});