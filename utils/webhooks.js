const { getById, makeRequest } = require('./api');

const OBJECT_ENDPOINTS = {
    Customer: 'customer',
    'Club Package': 'club-package',
    Reservation: 'reservation',
};

const OBJECT_COLLECTIONS = {
    Customer: 'customers',
    'Club Package': 'clubPackages',
    Reservation: 'reservations',
};

const subscribeWebhook = async (z, bundle, events) => {
    const webHooks = [];

    try {
        for (const event of events) {
            const webHook = await makeRequest(
                z,
                bundle,
                'web-hook',
                {},
                'POST',
                {
                    object: event.object,
                    action: event.action,
                    url: bundle.targetUrl,
                },
            );
            webHooks.push(webHook);
        }
    } catch (error) {
        await Promise.all(
            webHooks.map((webHook) =>
                makeRequest(z, bundle, `web-hook/${webHook.id}`, {}, 'DELETE'),
            ),
        );
        throw error;
    }

    return {
        webHookIds: webHooks.map((webHook) => webHook.id),
        webHooks,
    };
};

const unsubscribeWebhook = async (z, bundle) => {
    const ids =
        bundle.subscribeData?.webHookIds ||
        (bundle.subscribeData?.id ? [bundle.subscribeData.id] : []);

    await Promise.all(
        ids.map((id) => makeRequest(z, bundle, `web-hook/${id}`, {}, 'DELETE')),
    );

    return {};
};

const listWebhooks = async (z, bundle) => {
    const response = await makeRequest(z, bundle, 'web-hook', { limit: 50 });
    return response.webHooks || [];
};

const normalizeWebhookPayload = (request) => {
    const body =
        request?.content && typeof request.content === 'object'
            ? request.content
            : request || {};
    const payload =
        body.payload && typeof body.payload === 'object' ? body.payload : body;

    return {
        object: body.object,
        action: body.action,
        payload,
        tenantId: body.tenantId,
        user: body.user,
    };
};

const fetchFullObjectById = async (z, bundle, object, id) => {
    const endpoint = OBJECT_ENDPOINTS[object];
    if (!endpoint || !id) return null;
    return getById(z, bundle, endpoint, id);
};

const fetchBulkObjects = async (z, event) => {
    const collectionKey = OBJECT_COLLECTIONS[event.object];
    if (!collectionKey || !event.payload.callbackUrl) return [];

    const objects = [];
    let url = event.payload.callbackUrl;

    while (url) {
        const response = await z.request({ url, method: 'GET' });
        objects.push(...(response.json[collectionKey] || []));

        if (!response.json.cursor) {
            url = null;
        } else {
            const nextUrl = new URL(url);
            nextUrl.searchParams.set('cursor', response.json.cursor);
            url = nextUrl.toString();
        }
    }

    return objects;
};

const createWebhookPerform =
    ({
        filter = () => true,
        makeEventId,
        resolveObject,
        transform = (object) => object,
    }) =>
    async (z, bundle) => {
        const event = normalizeWebhookPayload(bundle.cleanedRequest);

        if (!filter(event)) return [];

        const decorate = (source) => {
            const object = transform(source);
            const originalId = object.id;
            return {
                ...object,
                id: makeEventId ? makeEventId(object, event) : object.id,
                originalId,
                eventAction: event.action,
                eventObject: event.object,
                eventTenantId: event.tenantId,
            };
        };

        if (event.action === 'Bulk Update') {
            const objects = await fetchBulkObjects(z, event);
            return objects.map(decorate);
        }

        let object = resolveObject
            ? (await resolveObject(z, bundle, event)) || event.payload
            : event.payload;
        if (!resolveObject && event.action !== 'Delete' && object.id) {
            const fullObject = await fetchFullObjectById(
                z,
                bundle,
                event.object,
                object.id,
            );
            if (fullObject) object = fullObject;
        }

        return [decorate(object)];
    };

module.exports = {
    createWebhookPerform,
    fetchFullObjectById,
    fetchBulkObjects,
    listWebhooks,
    normalizeWebhookPayload,
    subscribeWebhook,
    unsubscribeWebhook,
};
