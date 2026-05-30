const sample = require('../samples/sample_closed_reservation');

const { createReservationTrigger } = require('./reservation_trigger');

const CLOSED_STATUS = 'Closed Out';
const MAX_CLOSED_LOOKBACK_HOURS = 24;
const HOUR_IN_MS = 60 * 60 * 1000;

const getCloseOutTimestamp = (reservation) => {
    const closeOutTimestamp = new Date(reservation.closeOutTime).getTime();

    if (Number.isNaN(closeOutTimestamp)) {
        return null;
    }

    return closeOutTimestamp;
};

module.exports = createReservationTrigger({
    key: 'closed_reservation',
    label: 'Closed Reservation',
    description: 'Triggers when a reservation is closed in Commerce7.',
    sample,
    filterReservation: (reservation, afterTimestamp, nowTimestamp) => {
        const closeOutTimestamp = getCloseOutTimestamp(reservation);
        const recentCloseOutCutoff = nowTimestamp - (MAX_CLOSED_LOOKBACK_HOURS * HOUR_IN_MS);

        return typeof reservation.status === 'string'
            && reservation.status === CLOSED_STATUS
            && closeOutTimestamp !== null
            && closeOutTimestamp > afterTimestamp
            && closeOutTimestamp > recentCloseOutCutoff;
    },
    makeId: (reservation) => `${reservation.id}-closed-${getCloseOutTimestamp(reservation)}`,
});
