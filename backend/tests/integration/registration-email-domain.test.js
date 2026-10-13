const dns = require('dns');
const request = require('supertest');

const mockSentEmails = [];
jest.mock('../../services/emailService', () => ({
    isEmailEnabled: () => true,
    initializeEmailService: () => {},
    verifyEmailConnection: async () => ({ success: true }),
    sendEmail: async (message) => {
        mockSentEmails.push(message);
        return { success: true, messageId: 'test' };
    },
}));

const app = require('../../app');
const { User, Setting } = require('../../models');
const { getConfig } = require('../../config/config');

const dnsError = (code) => Object.assign(new Error(code), { code });

const register = (email) =>
    request(app).post('/api/register').send({ email, password: 'password123' });

describe('Registration email domain checks', () => {
    beforeEach(async () => {
        mockSentEmails.length = 0;
        await Setting.upsert({ key: 'registration_enabled', value: 'true' });
    });

    it.each(['mailinator.com', 'yopmail.com', 'inbox.mailinator.com'])(
        'rejects a disposable address at %s',
        async (domain) => {
            const email = `throwaway_${Date.now()}@${domain}`;

            const res = await register(email);

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/permanent email address/);
            expect(await User.findOne({ where: { email } })).toBeNull();
            expect(mockSentEmails).toHaveLength(0);
        }
    );

    it('rejects a disposable domain regardless of case', async () => {
        const res = await register(`Shout_${Date.now()}@MAILINATOR.COM`);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/permanent email address/);
    });

    it.each(['a@a.a', 'a@a', 'a@.aa'])(
        'rejects the malformed address %s',
        async (email) => {
            const res = await register(email);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid email format');
        }
    );

    describe('with the MX check on', () => {
        let mx;
        let a;
        let aaaa;

        beforeEach(() => {
            getConfig().registrationConfig.mxCheck = true;
            mx = jest.spyOn(dns.promises.Resolver.prototype, 'resolveMx');
            a = jest.spyOn(dns.promises.Resolver.prototype, 'resolve4');
            aaaa = jest.spyOn(dns.promises.Resolver.prototype, 'resolve6');
        });

        afterEach(() => {
            getConfig().registrationConfig.mxCheck = false;
            jest.restoreAllMocks();
        });

        it('rejects a domain that does not exist, like a@a.aa', async () => {
            mx.mockRejectedValue(dnsError('ENOTFOUND'));
            a.mockRejectedValue(dnsError('ENOTFOUND'));
            aaaa.mockRejectedValue(dnsError('ENOTFOUND'));
            const email = `a_${Date.now()}@a.aa`;

            const res = await register(email);

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/cannot receive mail/);
            expect(await User.findOne({ where: { email } })).toBeNull();
        });

        it('rejects a domain with a null MX, like example.com', async () => {
            mx.mockResolvedValue([{ exchange: '', priority: 0 }]);

            const res = await register(`nullmx_${Date.now()}@example.com`);

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/cannot receive mail/);
        });

        it('registers an address whose domain takes mail', async () => {
            mx.mockResolvedValue([{ exchange: 'mx.real.dev', priority: 10 }]);

            const res = await register(`real_${Date.now()}@real-mail.dev`);

            expect(res.status).toBe(201);
            expect(mockSentEmails).toHaveLength(1);
        });

        it('fails open when DNS itself is unreachable', async () => {
            mx.mockRejectedValue(dnsError('ETIMEOUT'));

            const res = await register(`flaky_${Date.now()}@real-mail.dev`);

            expect(res.status).toBe(201);
        });
    });
});
