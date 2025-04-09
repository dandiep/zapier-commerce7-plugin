

// This function runs before every outbound request. You can have as many as you
// need. They'll need to each be registered in your index.js file.
const addHttpHeaders = (request, z, bundle) => {
    const username_pw = process.env.C7_API_USERNAME + ':' + process.env.C7_API_TOKEN
    const base64 = Buffer.from(username_pw).toString('base64');

    request.headers.Authorization = `Basic ${base64}`;

    request.headers.Tenant = bundle.authData.tenant_id;
    z.console.log("adding request headers", request);

    return request;
};

const testAuth = (z, bundle) => {
    // Make a request to Commerce7 API to validate credentials
    const options = {
        url: 'https://api.commerce7.com/v1',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${base64}`,
        },
    };

    z = addHttpHeaders(options, z, bundle);

    return z.request(options)
        .then((response) => {
            if (response.status === 401) {
                throw new Error('The Tenant ID you supplied is invalid');
            }
            return response.json;
        });
};

module.exports = {
    config: {
        type: 'custom',
        test: {
            method: "GET",
            url: "https://api.commerce7.com/v1",
        },
        fields: [
            {
                key: 'tenant_id',
                label: 'Tenant ID',
                required: true,
                type: 'string',
                helpText: 'Your Commerce7 Tenant ID'
            }
        ],
        connectionLabel: '{{tenant_id}}',
    },

    befores: [addHttpHeaders],
    afters: [],
};