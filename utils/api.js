const makeRequest = (z, bundle, endpoint, params = {}, method = 'GET') => {
    const options = {
        url: `https://api.commerce7.com/v1/${endpoint}`,
        method,
        headers: {
            'Content-Type': 'application/json'
        },
        params
    };

    return z.request(options)
        .then((response) => {
            if (response.status >= 300) {
                throw new Error(`Unexpected status code ${response.status}`);
            }
            return response.json;
        });
};

module.exports = {
    makeRequest
};
