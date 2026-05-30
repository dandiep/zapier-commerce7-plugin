const crypto = require('crypto');

const { makeRequest } = require('../utils/api');

const DEFAULT_LOOKBACK_HOURS = 1;

const buildDefaultId = (reservation) => {
    const input = `${reservation.guestCount}${reservation.reservationDate}${reservation.notes || ''}${reservation.status}`;
    const hash = crypto.createHash('md5').update(input).digest('hex');

    return `${reservation.id}-${hash}`;
};

const getAfterTimestamp = (bundle, defaultLookbackHours = DEFAULT_LOOKBACK_HOURS) => {
    const inputData = bundle.inputData || {};
    const afterValue = inputData.after;

    if (afterValue) {
        const afterTimestamp = new Date(afterValue).getTime();

        if (!Number.isNaN(afterTimestamp)) {
            return afterTimestamp;
        }
    }

    const after = new Date(Date.now());
    after.setHours(after.getHours() - defaultLookbackHours);
    return after.getTime();
};

const reservationOutputFields = [
    { key: 'id', label: 'ID', type: 'string', primary: true },
    { key: 'createdAt', label: 'Created At', type: 'datetime' },
    { key: 'updatedAt', label: 'Updated At', type: 'datetime' },
    { key: 'closeOutTime', label: 'Close Out Time', type: 'datetime' },
    { key: 'reservationCloseOutDate', label: 'Reservation Close Out Date', type: 'datetime' },
    { key: 'status', label: 'Status', type: 'string' },
    { key: 'customerName', label: 'Customer Name', type: 'string' },
    { key: 'reservationDate', label: 'Reservation Date', type: 'datetime' },
    { key: 'sku', label: 'SKU', type: 'string' },
    { key: 'guestCount', label: 'Guest Count', type: 'number' },
    {
        key: 'customer', children: [
            { key: 'firstName', label: 'First Name', type: 'string' },
            { key: 'lastName', label: 'Last Name', type: 'string' },
            { key: 'email', label: 'Email', type: 'string' },
        ]
    },
    {
        key: 'reservation', children: [
            { key: 'title', label: 'Reservation Type Title', type: 'string' },
        ]
    },
];

const createPerform = ({
    filterReservation = () => true,
    makeId = buildDefaultId,
    defaultLookbackHours = DEFAULT_LOOKBACK_HOURS,
}) => {
    return (z, bundle) => {
        const afterTimestamp = getAfterTimestamp(bundle, defaultLookbackHours);
        const nowTimestamp = Date.now();
        const params = {
            updatedAt: `gt:${new Date(afterTimestamp).toISOString()}`,
        };

        return makeRequest(z, bundle, 'reservation', params)
            .then((response) => {
                const reservations = response.reservations || [];
                const matchingReservations = reservations.filter((reservation) => (
                    filterReservation(reservation, afterTimestamp, nowTimestamp)
                ));

                const highestUpdatedAt = reservations.reduce((highest, reservation) => {
                    const updatedAt = new Date(reservation.updatedAt).getTime();

                    if (Number.isNaN(updatedAt)) {
                        return highest;
                    }

                    return Math.max(highest, updatedAt);
                }, afterTimestamp);

                return matchingReservations.map((reservation) => ({
                    ...reservation,
                    id: makeId(reservation),
                    originalId: reservation.id,
                    _meta: {
                        after: highestUpdatedAt,
                    },
                }));
            });
    };
};

const createReservationTrigger = ({
    key,
    label,
    description,
    sample,
    filterReservation,
    makeId,
    defaultLookbackHours,
}) => ({
    key,
    noun: 'Reservation',

    display: {
        label,
        description,
    },

    operation: {
        type: 'polling',
        perform: createPerform({ filterReservation, makeId, defaultLookbackHours }),
        inputFields: [],
        sample,
        outputFields: reservationOutputFields,
    },
});

module.exports = {
    buildDefaultId,
    createReservationTrigger,
    reservationOutputFields,
};
