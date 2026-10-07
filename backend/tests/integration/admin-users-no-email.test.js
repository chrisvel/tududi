const request = require('supertest');

const sentEmails = [];
jest.mock('../../services/emailService', () => ({
    isEmailEnabled: () => true,
    initializeEmailService: () => {},
    verifyEmailConnection: async () => ({ success: true }),
    sendEmail: async (message) => {
        sentEmails.push(message);
        return { success: true, messageId: 'test' };
    },
}));

const app = require('../../app');
const {
    User,
    Person,
    UserGroup,
    UserGroupMember,
    sequelize,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const rolesService = require('../../services/rolesService');

const loginAgent = async (email, password = 'password123') => {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
};

describe('Accounts without an email', () => {
    let admin, adminAgent;

    const createMember = (body) =>
        adminAgent.post('/api/admin/users').send(body);

    const listUsers = async () =>
        (await adminAgent.get('/api/admin/users')).body;

    beforeEach(async () => {
        sentEmails.length = 0;
        admin = await createTestUser({ email: 'admin@example.com' });
        adminAgent = await loginAgent(admin.email);
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('creating one', () => {
        it('needs only a name', async () => {
            const res = await createMember({ name: 'Emma' });

            expect(res.status).toBe(201);
            expect(res.body.email).toBeNull();
            expect(res.body.name).toBe('Emma');
            expect(res.body.role).toBe('user');
            expect(res.body.account_status).toBe('no_sign_in');
        });

        it('sends no invitation and no verification email', async () => {
            const res = await createMember({ name: 'Emma' });

            expect(res.body.invited).toBe(false);
            expect(res.body.email_sent).toBe(false);
            expect(sentEmails).toHaveLength(0);
        });

        it('stores no password and cannot sign in', async () => {
            const res = await createMember({ name: 'Emma' });

            const user = await User.findByPk(res.body.id);
            expect(user.email).toBeNull();
            expect(user.password_digest).toBeNull();
        });

        it('gets a person named after the account', async () => {
            const res = await createMember({
                name: 'Emma',
                surname: 'Veleris',
            });

            const person = await Person.findOne({
                where: { user_id: res.body.id, linked_user_id: res.body.id },
            });
            expect(person.name).toBe('Emma Veleris');
        });

        it('treats a blank email as no email', async () => {
            const res = await createMember({ name: 'Emma', email: '   ' });

            expect(res.status).toBe(201);
            expect(res.body.email).toBeNull();
        });

        it('allows several accounts without an email', async () => {
            const first = await createMember({ name: 'Emma' });
            const second = await createMember({ name: 'Noah' });

            expect(first.status).toBe(201);
            expect(second.status).toBe(201);
        });

        it('can be a guest with no permissions', async () => {
            const res = await createMember({ name: 'Emma', role: 'guest' });

            expect(res.status).toBe(201);
            expect(res.body.role).toBe('guest');
            expect(res.body.capabilities.create_projects).toBe(false);
        });

        it('needs a name when there is no email', async () => {
            const res = await createMember({ role: 'user' });

            expect(res.status).toBe(400);
            expect(sentEmails).toHaveLength(0);
        });

        it('cannot have a password without an email', async () => {
            const res = await createMember({
                name: 'Emma',
                password: 'Str0ng-passw0rd!',
            });

            expect(res.status).toBe(400);
            expect(await User.count({ where: { name: 'Emma' } })).toBe(0);
        });

        it('still rejects an email that is not valid', async () => {
            const res = await createMember({ name: 'Emma', email: 'nope' });

            expect(res.status).toBe(400);
        });

        it('is closed to anyone who is not an admin', async () => {
            await createTestUser({ email: 'member@example.com' });
            const memberAgent = await loginAgent('member@example.com');

            const res = await memberAgent
                .post('/api/admin/users')
                .send({ name: 'Emma' });

            expect(res.status).toBe(403);
        });

        it('does not change how an account with an email is created', async () => {
            const res = await createMember({
                email: 'wife@example.com',
                password: 'Str0ng-passw0rd!',
                name: 'Wife',
            });

            expect(res.status).toBe(201);
            expect(res.body.email).toBe('wife@example.com');
            expect(res.body.account_status).toBe('active');
        });
    });

    describe('what the admin sees', () => {
        it('lists each account with whether it can sign in', async () => {
            await createMember({ name: 'Emma' });
            await createMember({
                email: 'wife@example.com',
                password: 'Str0ng-passw0rd!',
            });
            await createMember({ email: 'invited@example.com' });

            const byName = (u) => u.name || u.email;
            const users = Object.fromEntries(
                (await listUsers()).map((u) => [byName(u), u])
            );

            expect(users.Emma.email).toBeNull();
            expect(users.Emma.account_status).toBe('no_sign_in');
            expect(users['wife@example.com'].account_status).toBe('active');
            expect(users['invited@example.com'].account_status).toBe('invited');
            expect(users['admin@example.com'].account_status).toBe('active');
        });

        it('counts an account that signs in through SSO as active', async () => {
            const { OIDCIdentity } = require('../../models');
            const sso = await createTestUser({
                email: 'sso@example.com',
                password_digest: null,
            });
            await OIDCIdentity.create({
                user_id: sso.id,
                provider_slug: 'test',
                subject: 'subject-1',
                email: 'sso@example.com',
            });

            const users = await listUsers();

            expect(
                users.find((u) => u.email === 'sso@example.com').account_status
            ).toBe('active');
        });
    });

    describe('changing one later', () => {
        it('can be given an email', async () => {
            const created = await createMember({ name: 'Emma' });

            const res = await adminAgent
                .put(`/api/admin/users/${created.body.id}`)
                .send({ email: 'emma@example.com' });

            expect(res.status).toBe(200);
            expect(res.body.email).toBe('emma@example.com');
            expect(res.body.account_status).toBe('no_sign_in');
        });

        it('copies that email onto the person', async () => {
            const created = await createMember({ name: 'Emma' });

            await adminAgent
                .put(`/api/admin/users/${created.body.id}`)
                .send({ email: 'emma@example.com' });

            const person = await Person.findOne({
                where: {
                    user_id: created.body.id,
                    linked_user_id: created.body.id,
                },
            });
            expect(person.email).toBe('emma@example.com');
        });

        it('cannot take an email that is already in use', async () => {
            const created = await createMember({ name: 'Emma' });

            const res = await adminAgent
                .put(`/api/admin/users/${created.body.id}`)
                .send({ email: admin.email });

            expect(res.status).toBe(409);
        });

        it('can sign in once it has an email and a password', async () => {
            const created = await createMember({ name: 'Emma' });

            const res = await adminAgent
                .put(`/api/admin/users/${created.body.id}`)
                .send({
                    email: 'emma@example.com',
                    password: 'Str0ng-passw0rd!',
                });
            expect(res.body.account_status).toBe('active');

            const login = await request(app).post('/api/login').send({
                email: 'emma@example.com',
                password: 'Str0ng-passw0rd!',
            });
            expect(login.status).toBe(200);
        });

        it('keeps its name when other details change', async () => {
            const created = await createMember({ name: 'Emma' });

            const res = await adminAgent
                .put(`/api/admin/users/${created.body.id}`)
                .send({ surname: 'Veleris' });

            expect(res.status).toBe(200);
            expect(res.body.email).toBeNull();
            expect(res.body.surname).toBe('Veleris');
        });

        it('can be deleted like any other account', async () => {
            const created = await createMember({ name: 'Emma' });

            const res = await adminAgent.delete(
                `/api/admin/users/${created.body.id}`
            );

            expect([200, 204]).toContain(res.status);
            expect(await User.findByPk(created.body.id)).toBeNull();
            expect(
                await Person.count({ where: { user_id: created.body.id } })
            ).toBe(0);
        });
    });

    describe('signing in', () => {
        it('is refused without an email, and does not fail', async () => {
            await createMember({ name: 'Emma' });

            for (const body of [
                { password: 'x' },
                { email: '', password: 'x' },
                { email: null, password: 'x' },
                { email: 'null', password: 'x' },
            ]) {
                const res = await request(app).post('/api/login').send(body);
                expect([400, 401]).toContain(res.status);
            }
        });

        it('cannot ask for a password reset', async () => {
            await createMember({ name: 'Emma' });

            const res = await request(app)
                .post('/api/forgot-password')
                .send({ email: '' });

            expect(res.status).toBeLessThan(500);
            expect(sentEmails).toHaveLength(0);
        });
    });

    describe('working with the rest of the family', () => {
        let wife, wifeAgent, emma, group;

        beforeEach(async () => {
            wife = await createTestUser({
                email: 'wife@example.com',
                name: 'Wife',
            });
            wifeAgent = await loginAgent(wife.email);
            emma = (await createMember({ name: 'Emma' })).body;
            group = await UserGroup.create({ name: 'Family' });
            await UserGroupMember.bulkCreate([
                { group_id: group.id, user_id: wife.id },
                { group_id: group.id, user_id: emma.id },
            ]);
        });

        it('can be a member of a group', async () => {
            const res = await adminAgent.get('/api/admin/groups');

            expect(res.status).toBe(200);
            const detail = await adminAgent.get(
                `/api/admin/groups/${res.body.groups[0].uid}`
            );
            const names = (
                detail.body.members ||
                detail.body.group?.members ||
                []
            ).map((m) => m.name);
            expect(names).toContain('Emma');
        });

        it('is offered when someone in the same group assigns a task', async () => {
            const res = await wifeAgent.get('/api/people/assignable');

            expect(res.status).toBe(200);
            const person = res.body.people.find((p) => p.name === 'Emma');
            expect(person).toBeDefined();
            expect(person.email).toBeUndefined();
        });

        it('can be assigned a task', async () => {
            const person = (
                await wifeAgent.get('/api/people/assignable')
            ).body.people.find((p) => p.name === 'Emma');

            const task = await wifeAgent.post('/api/task').send({
                name: 'Tidy the room',
                assigned_to: person.uid,
            });

            expect(task.status).toBe(201);
            expect(task.body.assigned_to).toBe(person.uid);
        });

        it('has a column on the Everyone board', async () => {
            const person = (
                await wifeAgent.get('/api/people/assignable')
            ).body.people.find((p) => p.name === 'Emma');
            await wifeAgent.post('/api/task').send({
                name: 'Tidy the room',
                assigned_to: person.uid,
                due_date: new Date().toISOString().slice(0, 10),
            });

            const res = await wifeAgent.get('/api/everyone');

            expect(res.status).toBe(200);
            const column = res.body.columns.find(
                (c) => c.person.name === 'Emma'
            );
            expect(column).toBeDefined();
            expect(column.counts.today + column.counts.overdue).toBeGreaterThan(
                0
            );
        });

        it('can be a guest and still be assigned a task', async () => {
            await rolesService.setRole(emma.id, 'guest');

            const res = await wifeAgent.get('/api/people/assignable');

            expect(res.body.people.map((p) => p.name)).toContain('Emma');
        });
    });
});
