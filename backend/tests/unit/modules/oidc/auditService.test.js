const auditService = require('../../../../modules/oidc/auditService');
const { AuthAuditLog, User } = require('../../../../models');
const { sequelize } = require('../../../../models');
const bcrypt = require('bcrypt');

describe('OIDC Audit Service', () => {
    let mockReq;
    let testUser;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    beforeEach(async () => {
        await AuthAuditLog.destroy({ where: {}, truncate: true });
        await User.destroy({ where: {}, truncate: true });

        testUser = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });

        mockReq = {
            ip: '192.168.1.1',
            connection: { remoteAddress: '192.168.1.1' },
            get: jest.fn((header) => {
                if (header === 'user-agent') return 'Mozilla/5.0 Test Browser';
                return null;
            }),
        };
    });

    describe('EVENT_TYPES and AUTH_METHODS constants', () => {
        it('should export EVENT_TYPES', () => {
            expect(auditService.EVENT_TYPES).toBeDefined();
            expect(auditService.EVENT_TYPES.LOGIN_SUCCESS).toBe('login_success');
            expect(auditService.EVENT_TYPES.LOGIN_FAILED).toBe('login_failed');
            expect(auditService.EVENT_TYPES.OIDC_LINKED).toBe('oidc_linked');
        });

        it('should export AUTH_METHODS', () => {
            expect(auditService.AUTH_METHODS).toBeDefined();
            expect(auditService.AUTH_METHODS.EMAIL_PASSWORD).toBe('email_password');
            expect(auditService.AUTH_METHODS.OIDC).toBe('oidc');
            expect(auditService.AUTH_METHODS.API_TOKEN).toBe('api_token');
        });
    });

    describe('logEvent', () => {
        it('should create audit log entry', async () => {
            await auditService.logEvent({
                userId: testUser.id,
                eventType: 'login_success',
                authMethod: 'email_password',
                ipAddress: '192.168.1.1',
                userAgent: 'Test Browser',
            });

            const logs = await AuthAuditLog.findAll();
            expect(logs).toHaveLength(1);
            expect(logs[0].user_id).toBe(testUser.id);
            expect(logs[0].event_type).toBe('login_success');
            expect(logs[0].auth_method).toBe('email_password');
        });

        it('should store metadata as JSON string', async () => {
            await auditService.logEvent({
                userId: testUser.id,
                eventType: 'login_failed',
                authMethod: 'email_password',
                metadata: { email: 'test@example.com', reason: 'invalid_password' },
            });

            const log = await AuthAuditLog.findOne();
            expect(log.metadata).toBe('{"email":"test@example.com","reason":"invalid_password"}');
        });

        it('should handle null userId for failed login attempts', async () => {
            await auditService.logEvent({
                userId: null,
                eventType: 'login_failed',
                authMethod: 'email_password',
            });

            const log = await AuthAuditLog.findOne();
            expect(log.user_id).toBeNull();
        });

        it('should not throw on logging errors', async () => {
            await expect(
                auditService.logEvent({
                    userId: 999999,
                    eventType: null,
                    authMethod: null,
                })
            ).resolves.not.toThrow();
        });
    });

    describe('logLoginSuccess', () => {
        it('should log successful email/password login', async () => {
            await auditService.logLoginSuccess(
                testUser.id,
                auditService.AUTH_METHODS.EMAIL_PASSWORD,
                mockReq
            );

            const log = await AuthAuditLog.findOne();
            expect(log.user_id).toBe(testUser.id);
            expect(log.event_type).toBe('login_success');
            expect(log.auth_method).toBe('email_password');
            expect(log.ip_address).toBe('192.168.1.1');
            expect(log.user_agent).toBe('Mozilla/5.0 Test Browser');
            expect(log.provider_slug).toBeNull();
        });

        it('should log successful OIDC login with provider', async () => {
            await auditService.logLoginSuccess(
                testUser.id,
                auditService.AUTH_METHODS.OIDC,
                mockReq,
                'google'
            );

            const log = await AuthAuditLog.findOne();
            expect(log.user_id).toBe(testUser.id);
            expect(log.event_type).toBe('login_success');
            expect(log.auth_method).toBe('oidc');
            expect(log.provider_slug).toBe('google');
        });
    });

    describe('logLoginFailed', () => {
        it('should log failed login attempt with email', async () => {
            await auditService.logLoginFailed(
                'test@example.com',
                auditService.AUTH_METHODS.EMAIL_PASSWORD,
                mockReq,
                null,
                'invalid_password'
            );

            const log = await AuthAuditLog.findOne();
            expect(log.user_id).toBeNull();
            expect(log.event_type).toBe('login_failed');
            expect(log.auth_method).toBe('email_password');

            const metadata = JSON.parse(log.metadata);
            expect(metadata.email).toBe('test@example.com');
            expect(metadata.reason).toBe('invalid_password');
        });

        it('should log failed OIDC attempt', async () => {
            await auditService.logLoginFailed(
                'user@example.com',
                auditService.AUTH_METHODS.OIDC,
                mockReq,
                'google',
                'auto_provision_disabled'
            );

            const log = await AuthAuditLog.findOne();
            expect(log.provider_slug).toBe('google');
            expect(log.auth_method).toBe('oidc');
        });
    });

    describe('logLogout', () => {
        it('should log logout event', async () => {
            await auditService.logLogout(testUser.id, mockReq);

            const log = await AuthAuditLog.findOne();
            expect(log.user_id).toBe(testUser.id);
            expect(log.event_type).toBe('logout');
            expect(log.ip_address).toBe('192.168.1.1');
        });
    });

    describe('logOidcLinked', () => {
        it('should log OIDC account linking', async () => {
            await auditService.logOidcLinked(testUser.id, 'google', mockReq);

            const log = await AuthAuditLog.findOne();
            expect(log.user_id).toBe(testUser.id);
            expect(log.event_type).toBe('oidc_linked');
            expect(log.auth_method).toBe('oidc');
            expect(log.provider_slug).toBe('google');
        });
    });

    describe('logOidcUnlinked', () => {
        it('should log OIDC account unlinking', async () => {
            await auditService.logOidcUnlinked(testUser.id, 'okta', mockReq);

            const log = await AuthAuditLog.findOne();
            expect(log.user_id).toBe(testUser.id);
            expect(log.event_type).toBe('oidc_unlinked');
            expect(log.provider_slug).toBe('okta');
        });
    });

    describe('logOidcProvision', () => {
        it('should log new user provisioning', async () => {
            await auditService.logOidcProvision(testUser.id, 'google', mockReq, true);

            const log = await AuthAuditLog.findOne();
            expect(log.user_id).toBe(testUser.id);
            expect(log.event_type).toBe('oidc_provision');
            expect(log.provider_slug).toBe('google');

            const metadata = JSON.parse(log.metadata);
            expect(metadata.isNewUser).toBe(true);
        });

        it('should log existing user provisioning', async () => {
            await auditService.logOidcProvision(testUser.id, 'okta', mockReq, false);

            const log = await AuthAuditLog.findOne();
            const metadata = JSON.parse(log.metadata);
            expect(metadata.isNewUser).toBe(false);
        });
    });

    describe('getRecentEvents', () => {
        beforeEach(async () => {
            for (let i = 1; i <= 60; i++) {
                await auditService.logEvent({
                    userId: testUser.id,
                    eventType: 'login_success',
                    authMethod: 'email_password',
                });
            }
        });

        it('should return recent events for user', async () => {
            const events = await auditService.getRecentEvents(testUser.id);
            expect(events).toHaveLength(50);
        });

        it('should return events in descending order', async () => {
            const events = await auditService.getRecentEvents(testUser.id, 5);

            expect(events).toHaveLength(5);
            for (let i = 0; i < events.length - 1; i++) {
                expect(new Date(events[i].created_at) >= new Date(events[i + 1].created_at)).toBe(true);
            }
        });

        it('should respect custom limit', async () => {
            const events = await auditService.getRecentEvents(testUser.id, 10);
            expect(events).toHaveLength(10);
        });

        it('should return empty array for user with no events', async () => {
            const events = await auditService.getRecentEvents(999);
            expect(events).toHaveLength(0);
        });
    });

    describe('cleanupOldLogs', () => {
        beforeEach(async () => {
            await auditService.logEvent({
                userId: testUser.id,
                eventType: 'login_success',
                authMethod: 'email_password',
            });

            const oldLog = await AuthAuditLog.create({
                user_id: testUser.id,
                event_type: 'login_success',
                auth_method: 'email_password',
                created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
            });
        });

        it('should delete logs older than specified days', async () => {
            const deletedCount = await auditService.cleanupOldLogs(90);

            expect(deletedCount).toBe(1);

            const remaining = await AuthAuditLog.count();
            expect(remaining).toBe(1);
        });

        it('should not delete recent logs', async () => {
            const deletedCount = await auditService.cleanupOldLogs(200);

            expect(deletedCount).toBe(0);

            const remaining = await AuthAuditLog.count();
            expect(remaining).toBe(2);
        });

        it('should respect custom retention period', async () => {
            const deletedCount = await auditService.cleanupOldLogs(30);

            expect(deletedCount).toBe(1);
        });
    });

    describe('IP address handling', () => {
        it('should use req.ip if available', async () => {
            mockReq.ip = '10.0.0.1';
            await auditService.logLoginSuccess(testUser.id, 'email_password', mockReq);

            const log = await AuthAuditLog.findOne();
            expect(log.ip_address).toBe('10.0.0.1');
        });

        it('should fallback to req.connection.remoteAddress', async () => {
            mockReq.ip = null;
            mockReq.connection.remoteAddress = '172.16.0.1';

            await auditService.logLoginSuccess(testUser.id, 'email_password', mockReq);

            const log = await AuthAuditLog.findOne();
            expect(log.ip_address).toBe('172.16.0.1');
        });
    });
});
