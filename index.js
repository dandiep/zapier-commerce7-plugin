const closedReservationTrigger = require('./triggers/closed_reservation');
const newReservationTrigger = require('./triggers/new_reservation');
const newCustomerTrigger = require('./triggers/new_customer');
const webhookTriggers = require('./triggers/webhook_triggers');
const searches = require('./searches');
const creates = require('./creates/customer');

const {
    config: authentication,
    befores = [],
    afters = [],
} = require('./authentication');

const App = {
    // This is just shorthand to reference the installed dependencies you have. Zapier will
    // need to know these before we can upload
    version: require('./package.json').version,
    platformVersion: require('zapier-platform-core').version,
    authentication: authentication,

    // beforeRequest & afterResponse are optional hooks into the provided HTTP client
    beforeRequest: [...befores],

    afterResponse: [...afters],

    // If you want to define optional resources to simplify creation of triggers, searches, creates - do that here!
    resources: {},

    // If you want your trigger to show up, you better include it here!
    triggers: {
        [closedReservationTrigger.key]: closedReservationTrigger,
        [newReservationTrigger.key]: newReservationTrigger,
        [newCustomerTrigger.key]: newCustomerTrigger,
        [webhookTriggers.customerCreated.key]: webhookTriggers.customerCreated,
        [webhookTriggers.customerUpdated.key]: webhookTriggers.customerUpdated,
        [webhookTriggers.clubPackageCreated.key]:
            webhookTriggers.clubPackageCreated,
        [webhookTriggers.reservationCancelledOrDeleted.key]:
            webhookTriggers.reservationCancelledOrDeleted,
    },

    // If you want your searches to show up, you better include it here!
    searches: {
        [searches.customerById.key]: searches.customerById,
        [searches.customerByEmail.key]: searches.customerByEmail,
        [searches.customerByPhone.key]: searches.customerByPhone,
        [searches.orderById.key]: searches.orderById,
        [searches.reservationById.key]: searches.reservationById,
        [searches.clubMembershipById.key]: searches.clubMembershipById,
        [searches.clubMembershipsByCustomer.key]:
            searches.clubMembershipsByCustomer,
        [searches.clubPackageById.key]: searches.clubPackageById,
    },

    // If you want your creates to show up, you better include it here!
    creates: {
        [creates.createCustomer.key]: creates.createCustomer,
        [creates.updateCustomer.key]: creates.updateCustomer,
        [creates.addTagToCustomer.key]: creates.addTagToCustomer,
        [creates.removeTagFromCustomer.key]: creates.removeTagFromCustomer,
        [creates.addCustomerNote.key]: creates.addCustomerNote,
        [creates.updateCustomerCustomFields.key]:
            creates.updateCustomerCustomFields,
    },
};

// Finally, export the app.
module.exports = App;
