const API_ROOT = 'https://api.commerce7.com/v1';
const PAGE_SIZE = 50;

const makeRequest = async (
    z,
    bundle,
    endpoint,
    params = {},
    method = 'GET',
    body,
) => {
    const response = await z.request({
        url: `${API_ROOT}/${endpoint}`,
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        params,
        body,
    });

    if (response.status >= 300) {
        throw new Error(
            `${method} /${endpoint} failed with status ${response.status}`,
        );
    }

    return response.status === 204 ? null : response.json;
};

const isNotFoundError = (error) =>
    error &&
    (error.status === 404 ||
        error.response?.status === 404 ||
        String(error).includes('"status":404'));

const getById = async (z, bundle, endpoint, id) => {
    try {
        return await makeRequest(z, bundle, `${endpoint}/${id}`);
    } catch (error) {
        if (isNotFoundError(error)) return null;
        throw error;
    }
};

const findWithCursor = async (
    z,
    bundle,
    endpoint,
    collectionKey,
    predicate,
) => {
    let cursor = 'start';

    do {
        const response = await makeRequest(z, bundle, endpoint, {
            cursor,
            limit: PAGE_SIZE,
        });
        const match = (response[collectionKey] || []).find(predicate);

        if (match) return match;
        cursor = response.cursor;
    } while (cursor);

    return null;
};

module.exports = {
    API_ROOT,
    PAGE_SIZE,
    findWithCursor,
    getById,
    makeRequest,
};
