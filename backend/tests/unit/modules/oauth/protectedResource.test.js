'use strict';

const {
    handleProtectedResource,
} = require('../../../../modules/oauth/protectedResource');

describe('handleProtectedResource', () => {
    let req, res;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            end: jest.fn(),
            json: jest.fn(),
        };
    });

    afterEach(() => {
        delete process.env.OIDC_ENABLED;
        delete process.env.OIDC_ISSUER_URL;
        delete process.env.BASE_URL;
    });

    it('returns 404 when OIDC_ENABLED is not set', () => {
        process.env.OIDC_ISSUER_URL = 'https://id.example.com';
        process.env.BASE_URL = 'https://app.example.com';
        handleProtectedResource(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.end).toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    });

    it('returns 404 when OIDC_ENABLED is false', () => {
        process.env.OIDC_ENABLED = 'false';
        process.env.OIDC_ISSUER_URL = 'https://id.example.com';
        process.env.BASE_URL = 'https://app.example.com';
        handleProtectedResource(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 404 when OIDC_ISSUER_URL is not set', () => {
        process.env.OIDC_ENABLED = 'true';
        process.env.BASE_URL = 'https://app.example.com';
        handleProtectedResource(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 404 when BASE_URL is not set', () => {
        process.env.OIDC_ENABLED = 'true';
        process.env.OIDC_ISSUER_URL = 'https://id.example.com';
        handleProtectedResource(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns RFC 9728 metadata when fully configured', () => {
        process.env.OIDC_ENABLED = 'true';
        process.env.OIDC_ISSUER_URL = 'https://id.example.com';
        process.env.BASE_URL = 'https://app.example.com';
        handleProtectedResource(req, res);
        expect(res.json).toHaveBeenCalledWith({
            resource: 'https://app.example.com',
            authorization_servers: ['https://id.example.com'],
            scopes_supported: ['openid', 'email', 'profile'],
        });
    });

    it('strips trailing slashes from BASE_URL and OIDC_ISSUER_URL', () => {
        process.env.OIDC_ENABLED = 'true';
        process.env.OIDC_ISSUER_URL = 'https://id.example.com/';
        process.env.BASE_URL = 'https://app.example.com/';
        handleProtectedResource(req, res);
        const body = res.json.mock.calls[0][0];
        expect(body.resource).toBe('https://app.example.com');
        expect(body.authorization_servers[0]).toBe('https://id.example.com');
    });
});
