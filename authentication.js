const API_ROOT = 'https://api.commerce7.com/v1';

const addHttpHeaders = (request, z, bundle) => {
    const username = process.env.C7_API_USERNAME;
    const token = process.env.C7_API_TOKEN;

    if (!username || !token) {
        throw new Error('C7_API_USERNAME and C7_API_TOKEN must be configured');
    }

    request.headers = request.headers || {};
    request.headers.Authorization = `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`;
    request.headers.Tenant = bundle.authData.tenant_id;

    return request;
};

const testAuth = async (z, bundle) => {
    const response = await z.request({
        url: API_ROOT,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (response.status >= 300) {
        throw new Error(`Commerce7 authentication failed with status ${response.status}`);
    }

    return {
        tenant_id: bundle.authData.tenant_id,
    };
};

module.exports = {
    config: {
        type: 'custom',
        test: testAuth,
        fields: [
            {
                key: 'tenant_id',
                label: 'Tenant ID',
                required: true,
                type: 'string',
                helpText: 'Your Commerce7 tenant ID. You can usually find it in your Commerce7 admin URL or account settings. See https://documentation.commerce7.com/ for account details.',
            },
        ],
        connectionLabel: '{{tenant_id}}',
    },

    befores: [addHttpHeaders],
    afters: [],
};
