const request = require('supertest');
const app = require('../../app');
const { sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const rolesService = require('../../services/rolesService');

async function login(user) {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
}

describe('Roles and capabilities', () => {
    let admin, member, guest;
    let adminAgent, memberAgent, guestAgent;

    beforeEach(async () => {
        admin = await createTestUser({ email: 'admin@example.com' });
        member = await createTestUser({ email: 'member@example.com' });
        guest = await createTestUser({ email: 'guest@example.com' });
        await rolesService.setRole(guest.id, 'guest');

        adminAgent = await login(admin);
        memberAgent = await login(member);
        guestAgent = await login(guest);
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('current user', () => {
        it('reports the role and capabilities of an admin', async () => {
            const res = await adminAgent.get('/api/current_user');

            expect(res.status).toBe(200);
            expect(res.body.user.is_admin).toBe(true);
            expect(res.body.user.role).toBe('admin');
            expect(res.body.user.capabilities).toEqual({
                create_people: true,
                invite_members: true,
                create_projects: true,
            });
        });

        it('reports a user who cannot invite', async () => {
            const res = await memberAgent.get('/api/current_user');

            expect(res.body.user.is_admin).toBe(false);
            expect(res.body.user.role).toBe('user');
            expect(res.body.user.capabilities.invite_members).toBe(false);
        });

        it('reports a guest with nothing', async () => {
            const res = await guestAgent.get('/api/current_user');

            expect(res.body.user.role).toBe('guest');
            expect(res.body.user.capabilities).toEqual({
                create_people: false,
                invite_members: false,
                create_projects: false,
            });
        });

        it('reports the role at login too', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({ email: guest.email, password: 'password123' });

            expect(res.status).toBe(200);
            expect(res.body.user.role).toBe('guest');
        });
    });

    describe('GET /api/admin/roles', () => {
        it('lists the roles, their defaults and how many hold each', async () => {
            const res = await adminAgent.get('/api/admin/roles');

            expect(res.status).toBe(200);
            expect(res.body.capabilities).toEqual([
                'create_people',
                'invite_members',
                'create_projects',
            ]);
            expect(res.body.roles.map((r) => r.id)).toEqual([
                'admin',
                'user',
                'guest',
            ]);
            expect(
                Object.fromEntries(
                    res.body.roles.map((r) => [r.id, r.member_count])
                )
            ).toEqual({ admin: 1, user: 1, guest: 1 });
        });

        it('is closed to anyone who is not an admin', async () => {
            expect((await memberAgent.get('/api/admin/roles')).status).toBe(
                403
            );
            expect((await guestAgent.get('/api/admin/roles')).status).toBe(403);
        });

        it('requires a session', async () => {
            expect((await request(app).get('/api/admin/roles')).status).toBe(
                401
            );
        });
    });

    describe('what a guest may create', () => {
        it('cannot add a person', async () => {
            const res = await guestAgent
                .post('/api/people')
                .send({ name: 'Plumber' });

            expect(res.status).toBe(403);
        });

        it('cannot create a project, area or goal', async () => {
            expect(
                (await guestAgent.post('/api/project').send({ name: 'P' }))
                    .status
            ).toBe(403);
            expect(
                (await guestAgent.post('/api/areas').send({ name: 'A' })).status
            ).toBe(403);
            expect(
                (await guestAgent.post('/api/goals').send({ name: 'G' })).status
            ).toBe(403);
        });

        it('lets a user do all of it', async () => {
            expect(
                (
                    await memberAgent
                        .post('/api/people')
                        .send({ name: 'Plumber' })
                ).status
            ).toBe(201);
            expect(
                (await memberAgent.post('/api/project').send({ name: 'P' }))
                    .status
            ).toBe(201);
            expect(
                (await memberAgent.post('/api/areas').send({ name: 'A' }))
                    .status
            ).toBe(201);
        });

        it('follows a capability taken away from one user', async () => {
            await rolesService.setCapabilities(member.id, {
                create_projects: false,
            });

            expect(
                (await memberAgent.post('/api/project').send({ name: 'P' }))
                    .status
            ).toBe(403);
            expect(
                (await memberAgent.post('/api/people').send({ name: 'Ann' }))
                    .status
            ).toBe(201);
        });

        it('still reads what is shared with the guest', async () => {
            const res = await guestAgent.get('/api/projects');

            expect(res.status).toBe(200);
        });
    });

    describe('managing roles from the admin API', () => {
        it('lists each account with its role and capabilities', async () => {
            const res = await adminAgent.get('/api/admin/users');

            const byEmail = Object.fromEntries(
                res.body.map((u) => [u.email, u])
            );
            expect(byEmail['admin@example.com'].role).toBe('admin');
            expect(byEmail['member@example.com'].role).toBe('user');
            expect(byEmail['guest@example.com'].role).toBe('guest');
            expect(byEmail['member@example.com'].capabilities).toEqual({
                create_people: true,
                invite_members: false,
                create_projects: true,
            });
        });

        it('creates an account with the guest role', async () => {
            const res = await adminAgent.post('/api/admin/users').send({
                email: 'new-guest@example.com',
                password: 'Str0ng-passw0rd!',
                role: 'guest',
            });

            expect(res.status).toBe(201);
            expect(res.body.role).toBe('guest');
            expect(
                (await rolesService.getRoleInfo(res.body.id)).capabilities
                    .create_people
            ).toBe(false);
        });

        it('changes a role', async () => {
            const res = await adminAgent
                .put(`/api/admin/users/${member.id}`)
                .send({ role: 'guest' });

            expect(res.status).toBe(200);
            expect(res.body.role).toBe('guest');
            expect(await rolesService.isAdmin(member.id)).toBe(false);
        });

        it('lets one user invite others without changing their role', async () => {
            const res = await adminAgent
                .put(`/api/admin/users/${member.id}`)
                .send({
                    capabilities: {
                        create_people: true,
                        invite_members: true,
                        create_projects: true,
                    },
                });

            expect(res.status).toBe(200);
            expect(res.body.role).toBe('user');
            expect(res.body.capabilities.invite_members).toBe(true);

            const me = await memberAgent.get('/api/current_user');
            expect(me.body.user.capabilities.invite_members).toBe(true);
        });

        it('rejects a role that does not exist', async () => {
            const res = await adminAgent
                .put(`/api/admin/users/${member.id}`)
                .send({ role: 'owner' });

            expect(res.status).toBe(400);
        });

        it('rejects a capability that does not exist', async () => {
            const res = await adminAgent
                .put(`/api/admin/users/${member.id}`)
                .send({ capabilities: { fly: true } });

            expect(res.status).toBe(400);
        });

        it('does not let the last admin be demoted', async () => {
            const res = await adminAgent
                .put(`/api/admin/users/${admin.id}`)
                .send({ role: 'user' });

            expect(res.status).toBe(400);
            expect(await rolesService.isAdmin(admin.id)).toBe(true);
        });

        it('lets an admin be demoted once another admin exists', async () => {
            await rolesService.setRole(member.id, 'admin');

            const res = await adminAgent
                .put(`/api/admin/users/${admin.id}`)
                .send({ role: 'user' });

            expect(res.status).toBe(200);
            expect(await rolesService.isAdmin(admin.id)).toBe(false);
        });

        it('keeps roles closed to anyone who is not an admin', async () => {
            const res = await memberAgent
                .put(`/api/admin/users/${guest.id}`)
                .send({ role: 'admin' });

            expect(res.status).toBe(403);
            expect(await rolesService.isAdmin(guest.id)).toBe(false);
        });
    });
});
