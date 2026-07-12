const zapier = require('zapier-platform-core');
const nock = require('nock');

const App = require('../index');

const appTester = zapier.createAppTester(App);

describe('Commerce7 authentication', () => {
    const bundle = {
        authData: {
            tenant_id: 'staging-test-tenant',
        },
    };

    beforeEach(() => {
        process.env.C7_API_USERNAME = 'test-app';
        process.env.C7_API_TOKEN = 'test-token';
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it('sends the app credentials and tenant header', async () => {
        const authorization = `Basic ${Buffer.from('test-app:test-token').toString('base64')}`;

        nock('https://api.commerce7.com', {
            reqheaders: {
                authorization,
                tenant: 'staging-test-tenant',
            },
        })
            .get('/v1')
            .reply(200, { 'Commerce7 API': 'OK' });

        const result = await appTester(App.authentication.test, bundle);

        expect(result).toEqual({ tenant_id: 'staging-test-tenant' });
    });

    it('rejects an invalid tenant or credentials', async () => {
        nock('https://api.commerce7.com')
            .get('/v1')
            .reply(401, { message: 'Unauthorized' });

        await expect(appTester(App.authentication.test, bundle)).rejects.toThrow();
    });

    it('fails clearly when the shared credentials are missing', async () => {
        delete process.env.C7_API_USERNAME;
        delete process.env.C7_API_TOKEN;

        await expect(appTester(App.authentication.test, bundle)).rejects.toThrow(
            'C7_API_USERNAME and C7_API_TOKEN must be configured'
        );
    });
});
