const request = require('supertest');

jest.mock('../../services/emailService', () => ({
    isEmailEnabled: () => true,
    initializeEmailService: () => {},
    verifyEmailConnection: async () => ({ success: true }),
    sendEmail: async () => ({ success: true, messageId: 'test' }),
}));

const app = require('../../app');
const { User, Person, sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const loginAgent = async (email, password = 'password123') => {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
};

// Odd input must be refused with a 4xx, never crash into a 500 or be stored.
describe('User management input hardening', () => {
    let admin, adminAgent, target;

    beforeEach(async () => {
        admin = await createTestUser({ email: 'admin@example.com' });
        target = await createTestUser({ email: 'target@example.com' });
        adminAgent = await loginAgent(admin.email);
    });

    afterAll(async () => {
        await sequelize.close();
    });

    const isRefused = (res) => res.status >= 400 && res.status < 500;

    describe('creating an account', () => {
        const weirdText = [
            ['a number', 42],
            ['an object', { a: 1 }],
            ['an array', ['x']],
            ['a boolean', true],
        ];

        it.each(weirdText)('refuses a name that is %s', async (_l, name) => {
            const res = await adminAgent
                .post('/api/admin/users')
                .send({ email: 'n@example.com', name });
            expect(isRefused(res)).toBe(true);
        });

        it.each(weirdText)('refuses a surname that is %s', async (_l, s) => {
            const res = await adminAgent
                .post('/api/admin/users')
                .send({ email: 's@example.com', name: 'Ok', surname: s });
            expect(isRefused(res)).toBe(true);
        });

        it.each(weirdText)('refuses an email that is %s', async (_l, e) => {
            const res = await adminAgent
                .post('/api/admin/users')
                .send({ email: e, name: 'Ok' });
            expect(isRefused(res)).toBe(true);
        });

        it('refuses a password that is not text', async () => {
            const res = await adminAgent
                .post('/api/admin/users')
                .send({ email: 'p@example.com', password: 12345678 });
            expect(isRefused(res)).toBe(true);
        });

        it('refuses a very long name', async () => {
            const res = await adminAgent
                .post('/api/admin/users')
                .send({ email: 'long@example.com', name: 'a'.repeat(5000) });
            expect(isRefused(res)).toBe(true);
            expect(
                await User.findOne({ where: { email: 'long@example.com' } })
            ).toBeNull();
        });

        it('refuses a name containing a NUL byte', async () => {
            const res = await adminAgent
                .post('/api/admin/users')
                .send({ email: 'nul@example.com', name: 'bad\u0000name' });
            expect(isRefused(res)).toBe(true);
        });

        it('refuses a whitespace only name without an email', async () => {
            const res = await adminAgent
                .post('/api/admin/users')
                .send({ name: '   ' });
            expect(res.status).toBe(400);
        });

        it('refuses an over long email', async () => {
            const res = await adminAgent
                .post('/api/admin/users')
                .send({ email: `${'a'.repeat(400)}@example.com` });
            expect(isRefused(res)).toBe(true);
        });

        it('refuses an email that is only an at sign', async () => {
            const res = await adminAgent
                .post('/api/admin/users')
                .send({ email: '@', name: 'Ok' });
            expect(isRefused(res)).toBe(true);
        });

        it('stores the email lowercased so it cannot be duplicated by case', async () => {
            await adminAgent
                .post('/api/admin/users')
                .send({ email: 'Case@Example.com', name: 'A' });
            const again = await adminAgent
                .post('/api/admin/users')
                .send({ email: 'case@example.com', name: 'B' });
            expect(again.status).toBe(409);
        });

        it.each([
            ['a number', 7],
            ['an object', { a: 1 }],
            ['a list', ['admin']],
        ])('refuses a role that is %s', async (_l, role) => {
            const res = await adminAgent
                .post('/api/admin/users')
                .send({ email: 'r@example.com', name: 'R', role });
            expect(isRefused(res)).toBe(true);
        });

        it('refuses capabilities with an unknown key', async () => {
            const res = await adminAgent.post('/api/admin/users').send({
                email: 'c@example.com',
                capabilities: { fly: true },
            });
            expect(res.status).toBe(400);
        });

        it('does not let prototype keys through as capabilities', async () => {
            const res = await adminAgent
                .post('/api/admin/users')
                .set('Content-Type', 'application/json')
                .send(
                    '{"email":"proto@example.com","capabilities":{"__proto__":{"admin":true}}}'
                );
            expect(isRefused(res)).toBe(true);
            const made = await User.findOne({
                where: { email: 'proto@example.com' },
            });
            const list = await adminAgent.get('/api/admin/users');
            const row = made && list.body.find((u) => u.id === made.id);
            expect(row ? row.role : 'not created').not.toBe('admin');
        });
    });

    describe('updating an account', () => {
        const put = (id, body) =>
            adminAgent.put(`/api/admin/users/${id}`).send(body);

        it('refuses a password that is not text', async () => {
            const res = await put(target.id, { password: 12345678 });
            expect(isRefused(res)).toBe(true);
        });

        it('refuses a password that is an object', async () => {
            const res = await put(target.id, { password: { a: 1 } });
            expect(isRefused(res)).toBe(true);
        });

        it('refuses a name that is an object', async () => {
            const res = await put(target.id, { name: { a: 1 } });
            expect(isRefused(res)).toBe(true);
            const fresh = await User.findByPk(target.id);
            expect(typeof fresh.name === 'string' || fresh.name === null).toBe(
                true
            );
        });

        it('refuses a very long name', async () => {
            const res = await put(target.id, { name: 'a'.repeat(5000) });
            expect(isRefused(res)).toBe(true);
        });

        it('refuses an email that is an array', async () => {
            const res = await put(target.id, { email: ['a@b.c'] });
            expect(isRefused(res)).toBe(true);
        });

        it('refuses an unknown role without changing anything else', async () => {
            const res = await put(target.id, { name: 'Renamed', role: 'root' });
            expect(res.status).toBe(400);
            const fresh = await User.findByPk(target.id);
            expect(fresh.name).not.toBe('Renamed');
        });

        it('refuses an unknown capability without changing anything else', async () => {
            const res = await put(target.id, {
                name: 'Renamed',
                capabilities: { fly: true },
            });
            expect(res.status).toBe(400);
            const fresh = await User.findByPk(target.id);
            expect(fresh.name).not.toBe('Renamed');
        });

        it('cannot take away the last admin and still rename them', async () => {
            const res = await put(admin.id, { name: 'Renamed', role: 'user' });
            expect(res.status).toBeGreaterThanOrEqual(400);
            const fresh = await User.findByPk(admin.id);
            expect(fresh.name).not.toBe('Renamed');
        });

        it('cannot change the email to one that is taken and change the role', async () => {
            const res = await put(target.id, {
                email: 'admin@example.com',
                role: 'guest',
            });
            expect(res.status).toBe(409);
            const info = await adminAgent.get('/api/admin/users');
            const row = info.body.find((u) => u.id === target.id);
            expect(row.role).toBe('user');
        });

        it('refuses to take an email away by sending an empty string', async () => {
            const res = await put(target.id, { email: '' });
            expect(res.status).toBe(200);
            const fresh = await User.findByPk(target.id);
            expect(fresh.email).toBe('target@example.com');
        });
    });

    describe('ids in the path', () => {
        it.each([
            ['trailing letters', '12abc'],
            ['exponent notation', '1e1'],
            ['a fraction', '1.5'],
            ['a negative number', '-1'],
            ['zero', '0'],
            ['a hex number', '0x10'],
        ])('refuses %s when updating', async (_l, id) => {
            const res = await adminAgent
                .put(`/api/admin/users/${id}`)
                .send({ name: 'X' });
            expect([400, 404]).toContain(res.status);
        });

        it('does not treat 12abc as user 12', async () => {
            const victim = await createTestUser({
                email: `v${Date.now()}@example.com`,
            });
            const res = await adminAgent.delete(
                `/api/admin/users/${victim.id}abc`
            );
            expect([400, 404]).toContain(res.status);
            expect(await User.findByPk(victim.id)).not.toBeNull();
        });

        it('answers 404 for an account that does not exist', async () => {
            const res = await adminAgent
                .put('/api/admin/users/99999999')
                .send({ name: 'X' });
            expect(res.status).toBe(404);
        });

        it('refuses a huge id without a server error', async () => {
            const res = await adminAgent
                .put(`/api/admin/users/${'9'.repeat(40)}`)
                .send({ name: 'X' });
            expect(isRefused(res)).toBe(true);
        });
    });

    describe('members', () => {
        it.each([
            ['a number', 42],
            ['an object', { a: 1 }],
        ])('refuses a name that is %s', async (_l, name) => {
            const res = await adminAgent.post('/api/members').send({ name });
            expect(isRefused(res)).toBe(true);
        });

        it.each([
            ['a number', 5],
            ['an object', { a: 1 }],
            ['an array', ['x']],
        ])('refuses a person_uid that is %s', async (_l, person_uid) => {
            const res = await adminAgent
                .post('/api/members')
                .send({ name: 'Convert', person_uid });
            expect(isRefused(res)).toBe(true);
        });

        it('refuses a role that is an object', async () => {
            const res = await adminAgent
                .post('/api/members')
                .send({ name: 'Convert', role: { a: 1 } });
            expect(isRefused(res)).toBe(true);
        });

        it('does not leave a person behind when the account is refused', async () => {
            const before = await Person.count();
            const res = await adminAgent
                .post('/api/members')
                .send({ email: 'not-an-email', name: 'Nobody' });
            expect(isRefused(res)).toBe(true);
            expect(await Person.count()).toBe(before);
        });
    });

    describe('groups', () => {
        it.each([
            ['a number', 5],
            ['an object', { a: 1 }],
            ['blank', '   '],
        ])('refuses a group name that is %s', async (_l, name) => {
            const res = await adminAgent
                .post('/api/admin/groups')
                .send({ name });
            expect(res.status).toBe(400);
        });

        it('refuses user ids that are strings', async () => {
            const g = await adminAgent
                .post('/api/admin/groups')
                .send({ name: 'Family' });
            const res = await adminAgent
                .post(`/api/admin/groups/${g.body.group.uid}/members`)
                .send({ user_ids: [String(target.id)] });
            expect(res.status).toBe(400);
        });

        it('refuses to add an account that does not exist', async () => {
            const g = await adminAgent
                .post('/api/admin/groups')
                .send({ name: 'Family' });
            const res = await adminAgent
                .post(`/api/admin/groups/${g.body.group.uid}/members`)
                .send({ user_ids: [99999999] });
            expect(isRefused(res)).toBe(true);
        });

        it('does not create two groups whose names differ only by case', async () => {
            await adminAgent.post('/api/admin/groups').send({ name: 'Family' });
            const again = await adminAgent
                .post('/api/admin/groups')
                .send({ name: 'family' });
            expect([409, 400]).toContain(again.status);
        });
    });
});
