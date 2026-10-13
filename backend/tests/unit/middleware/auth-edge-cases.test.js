jest.mock('../../../modules/oidc/service', () => ({
    ...jest.requireActual('../../../modules/oidc/service'),
    validateAccessToken: jest.fn(),
}));
jest.mock('../../../modules/users/apiTokenService', () => ({
    ...jest.requireActual('../../../modules/users/apiTokenService'),
    findValidTokenByValue: jest.fn(),
}));
jest.mock('lusca', () => {
    const handler = jest.fn((req, res, next) => next());
    return { csrf: jest.fn(() => handler), __handler: handler };
});

const { requireAuth } = require('../../../middleware/auth');
const { requireCapability } = require('../../../middleware/roles');
const {
    requireCaptcha,
    publicCaptchaConfig,
} = require('../../../middleware/captcha');
const { csrfProtection, generateToken } = require('../../../middleware/csrf');
const lusca = require('lusca');
const { validateAccessToken } = require('../../../modules/oidc/service');
const {
    findValidTokenByValue,
} = require('../../../modules/users/apiTokenService');
const providerConfig = require('../../../modules/oidc/providerConfig');
const { getConfig } = require('../../../config/config');
const { UnauthorizedError } = require('../../../shared/errors');

const response = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    set: jest.fn(),
});

// The rarely taken paths of the authentication middleware: a token whose
// account is gone, a failed bookkeeping write, providers without an issuer,
// the CSRF guard outside tests, and captcha answers that are not a yes.
describe('requireAuth edge cases', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('refuses an API token whose account no longer exists', async () => {
        findValidTokenByValue.mockResolvedValue({ user_id: 999999 });
        const res = response();
        const next = jest.fn();

        await requireAuth(
            {
                path: '/api/tasks',
                headers: { authorization: 'Bearer tt_gone' },
            },
            res,
            next
        );

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
        expect(next).not.toHaveBeenCalled();
    });

    it('still lets the request through when last_used_at cannot be saved', async () => {
        const { User } = require('../../../models');
        jest.spyOn(User, 'findByPk').mockResolvedValue({ id: 7 });
        const failure = new Error('disk full');
        let rejected;
        const update = jest.fn(() => {
            rejected = Promise.reject(failure);
            return rejected;
        });
        findValidTokenByValue.mockResolvedValue({
            user_id: 7,
            last_used_at: null,
            update,
        });
        const log = jest.spyOn(console, 'error').mockImplementation(() => {});
        const next = jest.fn();

        await requireAuth(
            {
                path: '/api/tasks',
                headers: { authorization: 'Bearer tt_live' },
            },
            response(),
            next
        );
        await rejected.catch(() => {});
        await new Promise((resolve) => setImmediate(resolve));

        expect(next).toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith(
            'Failed to update token last_used_at:',
            failure
        );
    });

    it('skips providers without an issuer when matching a bearer token', async () => {
        jest.replaceProperty(process, 'env', {
            ...process.env,
            OIDC_ENABLED: 'true',
        });
        validateAccessToken.mockResolvedValue({
            sub: 'someone',
            iss: 'https://id.example',
        });
        jest.spyOn(providerConfig, 'getAllProviders').mockResolvedValue([
            { slug: 'broken' },
        ]);
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const res = response();

        await requireAuth(
            {
                path: '/api/tasks',
                headers: { authorization: 'Bearer jwt.token.here' },
            },
            res,
            jest.fn()
        );

        expect(res.status).toHaveBeenCalledWith(401);
    });
});

describe('requireCapability', () => {
    it('answers unauthorized without a signed-in user', async () => {
        const next = jest.fn();

        await requireCapability('create_projects')({}, response(), next);

        expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });
});

describe('csrfProtection outside the test environment', () => {
    beforeEach(() => {
        jest.replaceProperty(process, 'env', {
            ...process.env,
            NODE_ENV: 'production',
        });
        lusca.__handler.mockReset();
        lusca.csrf.mockReset();
        lusca.csrf.mockImplementation(() => lusca.__handler);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('lets a passport-authenticated request through', () => {
        const next = jest.fn();
        csrfProtection({ user: { id: 1 }, headers: {} }, {}, next);
        expect(next).toHaveBeenCalled();
        expect(lusca.csrf).not.toHaveBeenCalled();
    });

    it('lets a bearer token request through', () => {
        const next = jest.fn();
        csrfProtection(
            { headers: { authorization: 'Bearer tt_abc' } },
            {},
            next
        );
        expect(next).toHaveBeenCalled();
        expect(lusca.csrf).not.toHaveBeenCalled();
    });

    it('checks the token on a session request', () => {
        const req = { headers: {} };
        const next = jest.fn();
        csrfProtection(req, {}, next);
        expect(lusca.csrf).toHaveBeenCalledWith({
            header: 'x-csrf-token',
            cookie: false,
        });
        expect(lusca.__handler).toHaveBeenCalledWith(req, {}, next);
    });

    it('skips the check in tests', () => {
        process.env.NODE_ENV = 'test';
        const next = jest.fn();
        csrfProtection({ headers: {} }, {}, next);
        expect(next).toHaveBeenCalled();
        expect(lusca.csrf).not.toHaveBeenCalled();
    });
});

describe('generateToken', () => {
    it('uses the request token when there is one', () => {
        expect(generateToken({ csrfToken: () => 'from-req' }, {})).toBe(
            'from-req'
        );
    });

    it('falls back to the token lusca left in locals', () => {
        expect(generateToken({}, { locals: { _csrf: 'from-locals' } })).toBe(
            'from-locals'
        );
    });

    it('answers an empty token when there is none', () => {
        expect(generateToken({}, { locals: {} })).toBe('');
    });
});

describe('requireCaptcha', () => {
    const config = getConfig();
    let saved;

    beforeEach(() => {
        saved = config.captcha;
        config.captcha = {
            siteKey: 'site',
            secretKey: 'secret',
            verifyUrl: 'https://verify.example',
        };
    });

    afterEach(() => {
        config.captcha = saved;
        jest.restoreAllMocks();
    });

    it('treats a missing captcha section as off', () => {
        config.captcha = undefined;
        const next = jest.fn();
        expect(publicCaptchaConfig()).toBeNull();
        requireCaptcha({ body: {}, headers: {} }, response(), next);
        expect(next).toHaveBeenCalled();
    });

    it('lets the request through when Cloudflare answers with an error', async () => {
        const fetch = jest
            .spyOn(global, 'fetch')
            .mockResolvedValue({ ok: false, status: 503 });
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const next = jest.fn();

        requireCaptcha(
            { body: {}, headers: { 'x-captcha-token': 'tok' } },
            response(),
            next
        );
        await new Promise((resolve) => setImmediate(resolve));
        await new Promise((resolve) => setImmediate(resolve));

        expect(fetch).toHaveBeenCalled();
        const body = fetch.mock.calls[0][1].body;
        expect(body.has('remoteip')).toBe(false);
        expect(next).toHaveBeenCalled();
    });
});
