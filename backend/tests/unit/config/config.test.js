describe('config backendUrl', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...ORIGINAL_ENV };
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it('uses BACKEND_URL when set', () => {
        process.env.BACKEND_URL = 'http://backend.example.com';
        process.env.BASE_URL = 'http://base.example.com';

        const { getConfig } = require('../../../config/config');

        expect(getConfig().backendUrl).toBe('http://backend.example.com');
    });

    it('falls back to BASE_URL when BACKEND_URL is not set', () => {
        delete process.env.BACKEND_URL;
        process.env.BASE_URL = 'http://10.10.10.10:3002';

        const { getConfig } = require('../../../config/config');

        expect(getConfig().backendUrl).toBe('http://10.10.10.10:3002');
    });

    it('falls back to the default when neither is set', () => {
        delete process.env.BACKEND_URL;
        delete process.env.BASE_URL;

        const { getConfig } = require('../../../config/config');

        expect(getConfig().backendUrl).toBe('http://localhost:3002');
    });
});

describe('config frontendUrl', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...ORIGINAL_ENV };
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it('uses FRONTEND_URL when set', () => {
        process.env.FRONTEND_URL = 'http://frontend.example.com';
        process.env.BASE_URL = 'http://base.example.com';

        const { getConfig } = require('../../../config/config');

        expect(getConfig().frontendUrl).toBe('http://frontend.example.com');
    });

    it('falls back to BASE_URL so email links use the public address', () => {
        delete process.env.FRONTEND_URL;
        process.env.BASE_URL = 'http://zima.local:3002';

        const { getConfig } = require('../../../config/config');

        expect(getConfig().frontendUrl).toBe('http://zima.local:3002');
    });

    it('falls back to the default when neither is set', () => {
        delete process.env.FRONTEND_URL;
        delete process.env.BASE_URL;

        const { getConfig } = require('../../../config/config');

        expect(getConfig().frontendUrl).toBe('http://localhost:8080');
    });
});
