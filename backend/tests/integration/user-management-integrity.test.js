const request = require('supertest');

jest.mock('../../services/emailService', () => ({
    isEmailEnabled: () => true,
    initializeEmailService: () => {},
    verifyEmailConnection: async () => ({ success: true }),
    sendEmail: async () => ({ success: true, messageId: 'test' }),
}));

const app = require('../../app');
const {
    User,
    Role,
    Person,
    UserGroup,
    UserGroupMember,
    sequelize,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { eraseUserAccount } = require('../../services/accountErasureService');

const loginAgent = async (email, password = 'password123') => {
    const agent = request.agent(app);
    const res = await agent.post('/api/login').send({ email, password });
    expect(res.status).toBe(200);
    return agent;
};

// Fresh requests instead of a shared agent: a shared agent server resets
// concurrent requests.
const cookieFor = async (email) => {
    const res = await request(app)
        .post('/api/login')
        .send({ email, password: 'password123' });
    expect(res.status).toBe(200);
    return res.headers['set-cookie'];
};

const makeAdmin = async (user) => {
    await Role.destroy({ where: { user_id: user.id } });
    await Role.create({ user_id: user.id, role: 'admin', is_admin: true });
};

describe('User management integrity', () => {
    let admin, adminAgent, member;

    beforeEach(async () => {
        admin = await createTestUser({ email: 'admin@example.com' });
        member = await createTestUser({ email: 'member@example.com' });
        adminAgent = await loginAgent(admin.email);
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('sessions', () => {
        it('signs an account out everywhere when an admin sets a new password', async () => {
            const memberAgent = await loginAgent(member.email);
            expect((await memberAgent.get('/api/projects')).status).toBe(200);

            const res = await adminAgent
                .put(`/api/admin/users/${member.id}`)
                .send({ password: 'a-brand-new-password' });
            expect(res.status).toBe(200);

            expect((await memberAgent.get('/api/projects')).status).toBe(401);
            const again = await request(app).post('/api/login').send({
                email: member.email,
                password: 'a-brand-new-password',
            });
            expect(again.status).toBe(200);
        });

        it('keeps the admin signed in when they change their own password', async () => {
            const res = await adminAgent
                .put(`/api/admin/users/${admin.id}`)
                .send({ password: 'another-new-password' });
            expect(res.status).toBe(200);
            expect((await adminAgent.get('/api/admin/users')).status).toBe(200);
        });

        it('leaves other sessions alone when the password is not changed', async () => {
            const memberAgent = await loginAgent(member.email);
            await adminAgent
                .put(`/api/admin/users/${member.id}`)
                .send({ name: 'Renamed' });
            expect((await memberAgent.get('/api/projects')).status).toBe(200);
        });

        it('stops working for an account that was deleted', async () => {
            const memberAgent = await loginAgent(member.email);
            const del = await adminAgent.delete(
                `/api/admin/users/${member.id}`
            );
            expect(del.status).toBe(204);
            expect((await memberAgent.get('/api/projects')).status).toBe(401);
        });

        it('takes admin pages away from a demoted admin at once', async () => {
            const second = await createTestUser({
                email: 'second@example.com',
            });
            await makeAdmin(second);
            const secondAgent = await loginAgent(second.email);
            expect((await secondAgent.get('/api/admin/users')).status).toBe(
                200
            );

            const res = await adminAgent
                .put(`/api/admin/users/${second.id}`)
                .send({ role: 'user' });
            expect(res.status).toBe(200);

            expect((await secondAgent.get('/api/admin/users')).status).toBe(
                403
            );
            expect((await secondAgent.get('/api/admin/groups')).status).toBe(
                403
            );
        });

        it('takes a permission away from an account at once', async () => {
            const memberAgent = await loginAgent(member.email);
            const make = () =>
                memberAgent.post('/api/project').send({ name: 'Trip' });
            expect((await make()).status).toBe(201);

            await adminAgent
                .put(`/api/admin/users/${member.id}`)
                .send({ capabilities: { create_projects: false } });
            expect((await make()).status).toBe(403);
        });
    });

    describe('nobody can promote themselves', () => {
        it('refuses the admin pages to a plain account', async () => {
            const memberAgent = await loginAgent(member.email);
            for (const [method, path, body] of [
                ['get', '/api/admin/users'],
                ['put', `/api/admin/users/${member.id}`, { role: 'admin' }],
                [
                    'post',
                    '/api/admin/set-admin-role',
                    { user_id: member.id, is_admin: true },
                ],
                ['post', '/api/admin/groups', { name: 'X' }],
                ['delete', `/api/admin/users/${admin.id}`],
            ]) {
                const res = await memberAgent[method](path).send(body);
                expect([401, 403]).toContain(res.status);
            }
            expect(
                (await Role.findOne({ where: { user_id: member.id } }))
                    ?.is_admin
            ).not.toBe(true);
        });

        it('ignores role fields on the profile update', async () => {
            const memberAgent = await loginAgent(member.email);
            await memberAgent
                .patch('/api/profile')
                .send({ role: 'admin', is_admin: true, name: 'Sneaky' });
            await memberAgent
                .put('/api/profile')
                .send({ role: 'admin', is_admin: true, name: 'Sneaky' });
            const row = await Role.findOne({ where: { user_id: member.id } });
            expect(row?.is_admin).not.toBe(true);
            expect(row?.role ?? 'user').not.toBe('admin');
        });

        it('does not let a member with the invite permission create an admin', async () => {
            await adminAgent
                .put(`/api/admin/users/${member.id}`)
                .send({ capabilities: { invite_members: true } });
            const memberAgent = await loginAgent(member.email);
            const res = await memberAgent
                .post('/api/members')
                .send({ name: 'Boss', role: 'admin' });
            expect(res.status).toBe(403);
            const res2 = await memberAgent
                .post('/api/members')
                .send({ name: 'Boss', capabilities: { invite_members: true } });
            expect(res2.status).toBe(403);
        });
    });

    describe('the last admin', () => {
        it('cannot be demoted, deleted or renamed away by an update', async () => {
            const demote = await adminAgent
                .put(`/api/admin/users/${admin.id}`)
                .send({ name: 'Nobody', role: 'user' });
            expect(demote.status).toBe(400);
            expect((await User.findByPk(admin.id)).name).not.toBe('Nobody');

            const legacy = await adminAgent
                .post('/api/admin/set-admin-role')
                .send({ user_id: admin.id, is_admin: false });
            expect(legacy.status).toBe(400);

            const del = await adminAgent.delete(`/api/admin/users/${admin.id}`);
            expect(del.status).toBe(400);
            expect(await Role.count({ where: { is_admin: true } })).toBe(1);
        });

        it('cannot be deleted through the account deletion of the profile', async () => {
            const res = await adminAgent
                .delete('/api/profile/delete')
                .send({ password: 'password123' });
            expect([400, 404, 405]).toContain(res.status);
            expect(await User.findByPk(admin.id)).not.toBeNull();
        });

        it('is refused by the erasure itself, not only by the callers', async () => {
            await expect(eraseUserAccount(admin.id)).rejects.toThrow(
                /last remaining admin/
            );
            expect(await User.findByPk(admin.id)).not.toBeNull();
        });

        it('survives two admins demoting each other at the same moment', async () => {
            const second = await createTestUser({
                email: 'second@example.com',
            });
            await makeAdmin(second);
            const [c1, c2] = await Promise.all([
                cookieFor(admin.email),
                cookieFor(second.email),
            ]);

            await Promise.all([
                request(app)
                    .put(`/api/admin/users/${second.id}`)
                    .set('Cookie', c1)
                    .send({ role: 'user' }),
                request(app)
                    .put(`/api/admin/users/${admin.id}`)
                    .set('Cookie', c2)
                    .send({ role: 'user' }),
            ]);

            expect(
                await Role.count({ where: { is_admin: true } })
            ).toBeGreaterThan(0);
        });

        it('survives two admins deleting each other at the same moment', async () => {
            const second = await createTestUser({
                email: 'second@example.com',
            });
            await makeAdmin(second);
            const [c1, c2] = await Promise.all([
                cookieFor(admin.email),
                cookieFor(second.email),
            ]);

            await Promise.all([
                request(app)
                    .delete(`/api/admin/users/${second.id}`)
                    .set('Cookie', c1),
                request(app)
                    .delete(`/api/admin/users/${admin.id}`)
                    .set('Cookie', c2),
            ]);

            expect(
                await Role.count({ where: { is_admin: true } })
            ).toBeGreaterThan(0);
            expect(
                await User.count({ where: { id: [admin.id, second.id] } })
            ).toBeGreaterThan(0);
        });
    });

    describe('accounts without an email', () => {
        it('cannot sign in, however the request is written', async () => {
            const made = await adminAgent
                .post('/api/admin/users')
                .send({ name: 'Kid' });
            expect(made.status).toBe(201);
            for (const body of [
                { email: null, password: 'password123' },
                { email: '', password: 'password123' },
                { email: 'Kid', password: 'password123' },
                { email: null, password: null },
                {},
                { email: { $ne: null }, password: 'password123' },
                { email: ['a@b.c'], password: 'password123' },
            ]) {
                const res = await request(app).post('/api/login').send(body);
                expect([400, 401, 429]).toContain(res.status);
            }
        });

        it('cannot ask for a password reset either', async () => {
            const res = await request(app)
                .post('/api/forgot-password')
                .send({ email: null });
            expect(res.status).toBeLessThan(500);
        });
    });

    describe('converting a contact', () => {
        const makeContact = (owner, name = 'Plumber') =>
            Person.create({ user_id: owner.id, name });

        it('only lets one of two simultaneous requests win', async () => {
            const contact = await makeContact(admin);
            const cookie = await cookieFor(admin.email);
            const results = await Promise.all(
                [1, 2, 3].map((i) =>
                    request(app)
                        .post('/api/members')
                        .set('Cookie', cookie)
                        .send({ name: `Plumber${i}`, person_uid: contact.uid })
                )
            );

            expect(results.filter((r) => r.status === 201)).toHaveLength(1);
            for (const r of results.filter((r) => r.status !== 201)) {
                expect(r.status).toBeLessThan(500);
            }
            const accounts = await User.findAll({
                where: { created_by_user_id: admin.id },
            });
            expect(accounts).toHaveLength(1);
            const fresh = await Person.findOne({ where: { uid: contact.uid } });
            expect(fresh.linked_user_id).toBe(accounts[0].id);
            expect(
                await Person.count({
                    where: { linked_user_id: accounts[0].id },
                })
            ).toBe(1);
        });

        it('brings an archived contact back when it becomes a member', async () => {
            const contact = await Person.create({
                user_id: admin.id,
                name: 'Old Friend',
                archived: true,
            });
            const res = await adminAgent
                .post('/api/members')
                .send({ person_uid: contact.uid });
            expect(res.status).toBe(201);
            const fresh = await Person.findOne({ where: { uid: contact.uid } });
            expect(fresh.archived).toBe(false);
        });

        it('refuses a contact that belongs to someone else', async () => {
            const other = await makeContact(member, 'Not yours');
            const res = await adminAgent
                .post('/api/members')
                .send({ person_uid: other.uid });
            expect(res.status).toBe(404);
            expect((await Person.findByPk(other.id)).linked_user_id).toBeNull();
        });

        it('refuses a self person as the contact to convert', async () => {
            const self = await Person.findOne({
                where: { user_id: member.id, linked_user_id: member.id },
            });
            const res = await adminAgent
                .post('/api/members')
                .send({ person_uid: self ? self.uid : 'nope' });
            expect([404, 409]).toContain(res.status);
        });
    });

    describe('groups and deleted accounts', () => {
        it('drops a deleted account from its groups', async () => {
            const g = await adminAgent
                .post('/api/admin/groups')
                .send({ name: 'Family' });
            const uid = g.body.group.uid;
            await adminAgent
                .post(`/api/admin/groups/${uid}/members`)
                .send({ user_ids: [member.id] });

            await adminAgent.delete(`/api/admin/users/${member.id}`);

            const group = await UserGroup.findOne({ where: { uid } });
            expect(
                await UserGroupMember.count({ where: { group_id: group.id } })
            ).toBe(0);
            const detail = await adminAgent.get(`/api/admin/groups/${uid}`);
            expect(detail.status).toBe(200);
        });

        it('keeps the members when the group is deleted', async () => {
            const g = await adminAgent
                .post('/api/admin/groups')
                .send({ name: 'Family' });
            await adminAgent
                .post(`/api/admin/groups/${g.body.group.uid}/members`)
                .send({ user_ids: [member.id] });
            const del = await adminAgent.delete(
                `/api/admin/groups/${g.body.group.uid}`
            );
            expect(del.status).toBe(204);
            expect(await User.findByPk(member.id)).not.toBeNull();
        });

        it('takes concurrent adds of the same account without an error', async () => {
            const g = await adminAgent
                .post('/api/admin/groups')
                .send({ name: 'Family' });
            const uid = g.body.group.uid;
            const cookie = await cookieFor(admin.email);
            const results = await Promise.all(
                [1, 2, 3].map(() =>
                    request(app)
                        .post(`/api/admin/groups/${uid}/members`)
                        .set('Cookie', cookie)
                        .send({ user_ids: [member.id] })
                )
            );
            for (const r of results) expect(r.status).toBeLessThan(500);
            const group = await UserGroup.findOne({ where: { uid } });
            expect(
                await UserGroupMember.count({
                    where: { group_id: group.id, user_id: member.id },
                })
            ).toBe(1);
        });
    });

    describe('the People list at scale', () => {
        const countQueries = async (agent) => {
            let queries = 0;
            const previous = sequelize.options.logging;
            sequelize.options.logging = () => {
                queries += 1;
            };
            try {
                const res = await agent.get('/api/people');
                expect(res.status).toBe(200);
                return {
                    queries,
                    people: res.body.length ?? res.body.people?.length,
                };
            } finally {
                sequelize.options.logging = previous;
            }
        };

        const addMembers = async (count, from = 0) => {
            for (let i = from; i < from + count; i += 1) {
                const res = await adminAgent
                    .post('/api/members')
                    .send({ name: `Member${i}` });
                expect(res.status).toBe(201);
            }
        };

        it('answers with a number of queries that does not grow with the people', async () => {
            await addMembers(3);
            const small = await countQueries(adminAgent);
            await addMembers(30, 3);
            const large = await countQueries(adminAgent);

            expect(large.people).toBeGreaterThan(small.people);
            expect(large.queries).toBeLessThanOrEqual(small.queries + 2);
        });
    });
});
