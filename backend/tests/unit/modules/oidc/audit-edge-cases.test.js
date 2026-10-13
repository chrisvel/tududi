const audit = require('../../../../modules/oidc/auditService');
const { AuthAuditLog } = require('../../../../models');
const { createTestUser } = require('../../../helpers/testUtils');

// A request without req.ip (behind some proxies only the socket knows the
// address), and the defaults of the event log helpers.
const socketOnlyRequest = {
    ip: undefined,
    connection: { remoteAddress: '10.9.8.7' },
    get: () => 'test-agent',
};

describe('auth audit log edge cases', () => {
    let user;

    beforeEach(async () => {
        user = await createTestUser({
            email: `audit-edge-${Date.now()}@example.com`,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const { AUTH_METHODS } = audit;
    it.each([
        [
            'logLoginSuccess',
            (u, req) =>
                audit.logLoginSuccess(u, AUTH_METHODS.EMAIL_PASSWORD, req),
        ],
        [
            'logLoginFailed',
            (u, req) =>
                audit.logLoginFailed('a@example.com', AUTH_METHODS.OIDC, req),
        ],
        ['logLogout', (u, req) => audit.logLogout(u, req)],
        ['logOidcLinked', (u, req) => audit.logOidcLinked(u, 'google', req)],
        [
            'logOidcUnlinked',
            (u, req) => audit.logOidcUnlinked(u, 'google', req),
        ],
        [
            'logOidcProvision',
            (u, req) => audit.logOidcProvision(u, 'google', req, true),
        ],
        [
            'logSignInLinkCreated',
            (u, req) => audit.logSignInLinkCreated(u, 1, req),
        ],
        [
            'logSignInLinkRevoked',
            (u, req) => audit.logSignInLinkRevoked(u, 1, req),
        ],
        ['logSignInLinkUsed', (u, req) => audit.logSignInLinkUsed(u, 1, req)],
    ])(
        '%s records the socket address when req.ip is missing',
        async (name, log) => {
            await log(user.id, socketOnlyRequest);

            const [row] = await AuthAuditLog.findAll({
                order: [['id', 'DESC']],
                limit: 1,
                raw: true,
            });
            expect(row.ip_address).toBe('10.9.8.7');
        }
    );

    it('logs an event with only its required fields', async () => {
        await audit.logEvent({
            eventType: audit.EVENT_TYPES.LOGOUT,
            authMethod: audit.AUTH_METHODS.EMAIL_PASSWORD,
        });
        const [row] = await AuthAuditLog.findAll({
            order: [['id', 'DESC']],
            limit: 1,
            raw: true,
        });
        expect(row.user_id).toBeNull();
        expect(row.provider_slug).toBeNull();
        expect(row.metadata).toBeNull();
    });

    it('lists recent events and cleans old ones with their defaults', async () => {
        await audit.logLogout(user.id, socketOnlyRequest);
        expect((await audit.getRecentEvents(user.id)).length).toBe(1);
        expect(await audit.cleanupOldLogs()).toBe(0);
    });
});
