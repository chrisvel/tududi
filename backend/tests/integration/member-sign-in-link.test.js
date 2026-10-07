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
    Role,
    MemberSignInLink,
    AuthAuditLog,
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

const tokenOf = (url) => new URL(url).searchParams.get('token');

describe('Sign-in link for a member without an email', () => {
    let admin, adminAgent, creator, creatorAgent, other, otherAgent;

    // A member made by an admin, and one made by the (non-admin) creator.
    const adminMember = async (name = 'Kid') =>
        (await adminAgent.post('/api/admin/users').send({ name })).body;
    const creatorMember = async (name = 'Little') =>
        (await creatorAgent.post('/api/members').send({ name })).body;

    const makeLink = async (agent, memberId) => {
        const res = await agent.post(`/api/members/${memberId}/sign-in-link`);
        expect(res.status).toBe(201);
        return { ...res.body, token: tokenOf(res.body.url) };
    };

    const redeem = (token, agent = request(app)) =>
        agent.post('/api/sign-in-link/redeem').send({ token });

    beforeEach(async () => {
        sentEmails.length = 0;
        admin = await createTestUser({ email: 'admin@example.com' });
        creator = await createTestUser({ email: 'creator@example.com' });
        other = await createTestUser({ email: 'other@example.com' });
        adminAgent = await loginAgent(admin.email);
        await adminAgent
            .put(`/api/admin/users/${creator.id}`)
            .send({ capabilities: { invite_members: true } });
        creatorAgent = await loginAgent(creator.email);
        otherAgent = await loginAgent(other.email);
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('creating one', () => {
        it('lets an admin create a link that lasts 24 hours', async () => {
            const kid = await adminMember();

            const link = await makeLink(adminAgent, kid.id);

            expect(link.url).toMatch(/\/sign-in-link\?token=[0-9a-f]{64}$/);
            expect(link.path).toMatch(/^\/sign-in-link\?token=[0-9a-f]{64}$/);
            expect(link.url.endsWith(link.path)).toBe(true);
            const hours =
                (new Date(link.expires_at) - Date.now()) / (60 * 60 * 1000);
            expect(hours).toBeGreaterThan(23.9);
            expect(hours).toBeLessThanOrEqual(24);
        });

        it('stores only a hash of the token', async () => {
            const kid = await adminMember();
            const link = await makeLink(adminAgent, kid.id);

            const rows = await MemberSignInLink.findAll({ raw: true });

            expect(rows).toHaveLength(1);
            expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
            expect(rows[0].token_hash).not.toBe(link.token);
            expect(JSON.stringify(rows[0])).not.toContain(link.token);
            expect(rows[0].used_at).toBeNull();
            expect(rows[0].created_by_user_id).toBe(admin.id);
        });

        it('lets the person who created the account create one', async () => {
            const kid = await creatorMember();

            const link = await makeLink(creatorAgent, kid.id);

            expect(link.url).toContain('/sign-in-link?token=');
        });

        it('replaces the earlier link, so only one is live', async () => {
            const kid = await adminMember();
            const first = await makeLink(adminAgent, kid.id);
            const second = await makeLink(adminAgent, kid.id);

            expect(await MemberSignInLink.count()).toBe(1);
            expect(
                (
                    await request(app)
                        .post('/api/sign-in-link/peek')
                        .send({ token: first.token })
                ).status
            ).toBe(404);
            expect(
                (
                    await request(app)
                        .post('/api/sign-in-link/peek')
                        .send({ token: second.token })
                ).status
            ).toBe(200);
        });

        it('leaves one live link when several are created at the same moment', async () => {
            const kid = await adminMember();
            const cookie = (
                await request(app)
                    .post('/api/login')
                    .send({ email: admin.email, password: 'password123' })
            ).headers['set-cookie'];

            const results = await Promise.all(
                [1, 2, 3, 4].map(() =>
                    request(app)
                        .post(`/api/members/${kid.id}/sign-in-link`)
                        .set('Cookie', cookie)
                )
            );

            expect(
                results.filter((r) => r.status === 201).length
            ).toBeGreaterThan(0);
            for (const r of results.filter((r) => r.status !== 201)) {
                expect(r.status).toBe(409);
            }
            expect(
                await MemberSignInLink.count({ where: { user_id: kid.id } })
            ).toBe(1);
        });

        it('does not send any email', async () => {
            const kid = await adminMember();
            await makeLink(adminAgent, kid.id);
            expect(sentEmails).toHaveLength(0);
        });

        it('is refused to anyone who did not create the account', async () => {
            const adminsKid = await adminMember();
            const creatorsKid = await creatorMember();

            for (const [agent, id] of [
                [otherAgent, adminsKid.id],
                [otherAgent, creatorsKid.id],
                [creatorAgent, adminsKid.id],
            ]) {
                const res = await agent.post(`/api/members/${id}/sign-in-link`);
                expect(res.status).toBe(404);
            }
            expect(await MemberSignInLink.count()).toBe(0);
        });

        it('is refused without signing in', async () => {
            const kid = await adminMember();
            const res = await request(app).post(
                `/api/members/${kid.id}/sign-in-link`
            );
            expect(res.status).toBe(401);
        });

        it('is refused to a creator who has since become a guest', async () => {
            const kid = await creatorMember();
            await adminAgent
                .put(`/api/admin/users/${creator.id}`)
                .send({ role: 'guest' });

            const res = await creatorAgent.post(
                `/api/members/${kid.id}/sign-in-link`
            );

            expect(res.status).toBe(403);
            expect(await MemberSignInLink.count()).toBe(0);
        });

        it('is refused for an account that has an email', async () => {
            const res = await adminAgent.post(
                `/api/members/${other.id}/sign-in-link`
            );
            expect(res.status).toBe(403);
        });

        it('is refused for an admin account', async () => {
            const kid = await adminMember();
            await adminAgent
                .put(`/api/admin/users/${kid.id}`)
                .send({ role: 'admin' });

            const res = await adminAgent.post(
                `/api/members/${kid.id}/sign-in-link`
            );

            expect(res.status).toBe(403);
        });

        it('is refused for your own account', async () => {
            const res = await adminAgent.post(
                `/api/members/${admin.id}/sign-in-link`
            );
            expect(res.status).toBe(404);
        });

        it('is refused to a creator when the member has permissions they lack', async () => {
            const kid = await creatorMember();
            await adminAgent.put(`/api/admin/users/${creator.id}`).send({
                capabilities: {
                    invite_members: true,
                    create_projects: false,
                },
            });

            const res = await creatorAgent.post(
                `/api/members/${kid.id}/sign-in-link`
            );

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/permissions you do not have/);
        });

        it('lets an admin do it whatever the permissions are', async () => {
            const kid = await creatorMember();
            await adminAgent
                .put(`/api/admin/users/${kid.id}`)
                .send({ capabilities: { invite_members: true } });

            const link = await makeLink(adminAgent, kid.id);

            expect(link.url).toContain('/sign-in-link?token=');
        });

        it.each(['12abc', '1e1', '0', '-1', '1.5'])(
            'refuses the id %s',
            async (id) => {
                const res = await adminAgent.post(
                    `/api/members/${id}/sign-in-link`
                );
                expect(res.status).toBe(400);
            }
        );

        it('answers 404 for an account that does not exist', async () => {
            const res = await adminAgent.post(
                '/api/members/99999999/sign-in-link'
            );
            expect(res.status).toBe(404);
        });
    });

    describe('looking at one', () => {
        const peek = (token) =>
            request(app).post('/api/sign-in-link/peek').send({ token });

        it('tells the page whose link it is, by first name only', async () => {
            const kid = await adminMember('Emma');
            const { token } = await makeLink(adminAgent, kid.id);

            const res = await peek(token);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ name: 'Emma' });
        });

        it('says the same for an unknown, used and expired link', async () => {
            const kid = await adminMember();
            const used = await makeLink(adminAgent, kid.id);
            await redeem(used.token);
            const kid2 = await adminMember('Two');
            const expired = await makeLink(adminAgent, kid2.id);
            await MemberSignInLink.update(
                { expires_at: new Date(Date.now() - 1000) },
                { where: { user_id: kid2.id } }
            );

            const answers = [];
            for (const token of [
                'f'.repeat(64),
                used.token,
                expired.token,
                undefined,
                null,
                42,
                { a: 1 },
                ['x'],
                '',
                'x'.repeat(5000),
            ]) {
                const res = await peek(token);
                answers.push([res.status, JSON.stringify(res.body)]);
            }

            for (const [status] of answers) expect(status).toBe(404);
            expect(new Set(answers.map(([, body]) => body)).size).toBe(1);
        });

        it('does not use the link up', async () => {
            const kid = await adminMember();
            const { token } = await makeLink(adminAgent, kid.id);

            await peek(token);
            await peek(token);

            expect((await redeem(token)).status).toBe(200);
        });
    });

    describe('using one', () => {
        it('signs the member in without an email or a password', async () => {
            const kid = await adminMember('Emma');
            const { token } = await makeLink(adminAgent, kid.id);
            const agent = request.agent(app);

            const res = await redeem(token, agent);

            expect(res.status).toBe(200);
            expect(res.body.user.name).toBe('Emma');
            expect(res.body.user.email).toBeNull();
            expect(res.body.user.role).toBe('user');
            expect(res.body.user.is_admin).toBe(false);

            const me = await agent.get('/api/current_user');
            expect(me.body.user.uid).toBe(res.body.user.uid);
            expect((await agent.get('/api/projects')).status).toBe(200);
        });

        it('keeps the session for 30 days', async () => {
            const kid = await adminMember();
            const { token } = await makeLink(adminAgent, kid.id);

            const res = await redeem(token);

            const cookie = res.headers['set-cookie'].join(';');
            const expires = new Date(/Expires=([^;]+)/.exec(cookie)[1]);
            const days = (expires - Date.now()) / (24 * 60 * 60 * 1000);
            expect(days).toBeGreaterThan(29.9);
            expect(days).toBeLessThanOrEqual(30);
        });

        it('works once', async () => {
            const kid = await adminMember();
            const { token } = await makeLink(adminAgent, kid.id);

            expect((await redeem(token)).status).toBe(200);
            const again = await redeem(token);

            expect(again.status).toBe(404);
            const row = await MemberSignInLink.findOne();
            expect(row.used_at).not.toBeNull();
        });

        it('does not work after it has expired', async () => {
            const kid = await adminMember();
            const { token } = await makeLink(adminAgent, kid.id);
            await MemberSignInLink.update(
                { expires_at: new Date(Date.now() - 1000) },
                { where: { user_id: kid.id } }
            );

            expect((await redeem(token)).status).toBe(404);
        });

        it('lets only one of several simultaneous uses in', async () => {
            const kid = await adminMember();
            const { token } = await makeLink(adminAgent, kid.id);

            const results = await Promise.all(
                [1, 2, 3, 4].map(() => redeem(token))
            );

            expect(results.filter((r) => r.status === 200)).toHaveLength(1);
            for (const r of results.filter((r) => r.status !== 200)) {
                expect(r.status).toBe(404);
            }
        });

        it('replaces whoever was signed in on that browser', async () => {
            const kid = await adminMember('Emma');
            const { token } = await makeLink(adminAgent, kid.id);
            const agent = await loginAgent(other.email);
            expect((await agent.get('/api/current_user')).body.user.uid).toBe(
                other.uid
            );

            const res = await redeem(token, agent);

            expect(res.status).toBe(200);
            const me = await agent.get('/api/current_user');
            expect(me.body.user.uid).toBe(res.body.user.uid);
            expect(me.body.user.uid).not.toBe(other.uid);
        });

        it('refuses a link whose member has since been given an email', async () => {
            const kid = await adminMember();
            const { token } = await makeLink(adminAgent, kid.id);
            await adminAgent
                .put(`/api/admin/users/${kid.id}`)
                .send({ email: 'now-has-email@example.com' });

            expect((await redeem(token)).status).toBe(404);
            expect(
                await MemberSignInLink.count({ where: { used_at: null } })
            ).toBe(1);
        });

        it('refuses a link whose member has since become an admin', async () => {
            const kid = await adminMember();
            const { token } = await makeLink(adminAgent, kid.id);
            await adminAgent
                .put(`/api/admin/users/${kid.id}`)
                .send({ role: 'admin' });

            expect((await redeem(token)).status).toBe(404);
        });

        it.each([undefined, null, 42, { a: 1 }, ['x'], '', 'nope'])(
            'refuses the token %p',
            async (token) => {
                const res = await redeem(token);
                expect(res.status).toBe(404);
            }
        );

        it('gives the member only what their role allows', async () => {
            const kid = await adminMember();
            await adminAgent
                .put(`/api/admin/users/${kid.id}`)
                .send({ role: 'guest' });
            const { token } = await makeLink(adminAgent, kid.id);
            const agent = request.agent(app);
            await redeem(token, agent);

            expect((await agent.get('/api/admin/users')).status).toBe(403);
            expect(
                (await agent.post('/api/project').send({ name: 'x' })).status
            ).toBe(403);
        });
    });

    describe('taking access back', () => {
        it('removes the link and signs the member out everywhere', async () => {
            const kid = await adminMember();
            const { token } = await makeLink(adminAgent, kid.id);
            const agent = request.agent(app);
            await redeem(token, agent);
            expect((await agent.get('/api/projects')).status).toBe(200);
            const second = await makeLink(adminAgent, kid.id);

            const res = await adminAgent.delete(
                `/api/members/${kid.id}/sign-in-link`
            );

            expect(res.status).toBe(204);
            expect((await agent.get('/api/projects')).status).toBe(401);
            expect(await MemberSignInLink.count()).toBe(0);
            expect((await redeem(second.token)).status).toBe(404);
        });

        it('lets the creator do it, and nobody else', async () => {
            const kid = await creatorMember();
            await makeLink(creatorAgent, kid.id);

            expect(
                (await otherAgent.delete(`/api/members/${kid.id}/sign-in-link`))
                    .status
            ).toBe(404);
            expect(
                (
                    await creatorAgent.delete(
                        `/api/members/${kid.id}/sign-in-link`
                    )
                ).status
            ).toBe(204);
        });

        it('still works when the member has since been given an email', async () => {
            const kid = await adminMember();
            await makeLink(adminAgent, kid.id);
            await adminAgent
                .put(`/api/admin/users/${kid.id}`)
                .send({ email: 'now-has-email@example.com' });

            const res = await adminAgent.delete(
                `/api/members/${kid.id}/sign-in-link`
            );

            expect(res.status).toBe(204);
            expect(await MemberSignInLink.count()).toBe(0);
        });
    });

    describe('the People list', () => {
        const entryFor = async (agent, name) => {
            const res = await agent.get('/api/people');
            const list = Array.isArray(res.body) ? res.body : res.body.people;
            return list.find((p) => p.name === name);
        };

        it('offers the button only where it will work', async () => {
            await adminMember('Kid');
            await creatorMember('Little');

            expect((await entryFor(adminAgent, 'Kid')).can_sign_in_link).toBe(
                true
            );
            expect(
                (await entryFor(creatorAgent, 'Little')).can_sign_in_link
            ).toBe(true);
        });

        it('does not offer it for an account with an email or for yourself', async () => {
            const res = await adminAgent.get('/api/people');
            const list = Array.isArray(res.body) ? res.body : res.body.people;
            for (const person of list.filter((p) => p.kind === 'member')) {
                expect(person.can_sign_in_link).toBe(false);
            }
        });

        it('does not offer it to someone who did not create the account', async () => {
            const kid = await creatorMember('Little');
            await adminAgent
                .post('/api/admin/groups')
                .send({ name: 'Family' })
                .then((g) =>
                    adminAgent
                        .post(`/api/admin/groups/${g.body.group.uid}/members`)
                        .send({ user_ids: [other.id, kid.id] })
                );

            const entry = await entryFor(otherAgent, 'Little');

            expect(entry).toBeDefined();
            expect(entry.can_sign_in_link).toBe(false);
        });
    });

    describe('the record of what happened', () => {
        it('notes who made the link, who took it back and when it was used', async () => {
            const kid = await adminMember();
            const { token } = await makeLink(adminAgent, kid.id);
            await redeem(token);
            await adminAgent.delete(`/api/members/${kid.id}/sign-in-link`);

            const events = await AuthAuditLog.findAll({
                where: { user_id: kid.id },
                order: [['id', 'ASC']],
            });
            const kinds = events.map((e) => e.event_type);

            expect(kinds).toEqual([
                'sign_in_link_created',
                'login_success',
                'sign_in_link_revoked',
            ]);
            for (const event of events) {
                expect(event.auth_method).toBe('sign_in_link');
            }
            expect(JSON.parse(events[0].metadata)).toEqual({
                issued_by: admin.id,
            });
            expect(JSON.parse(events[1].metadata)).toEqual({
                issued_by: admin.id,
            });
            expect(JSON.parse(events[2].metadata)).toEqual({
                revoked_by: admin.id,
            });
            expect(JSON.stringify(events)).not.toContain(token);
        });
    });

    describe('erasing accounts', () => {
        it('removes the links of an erased member', async () => {
            const kid = await adminMember();
            await makeLink(adminAgent, kid.id);

            await eraseUserAccount(kid.id);

            expect(await MemberSignInLink.count()).toBe(0);
        });

        it('removes the links an erased creator made and keeps the member', async () => {
            const kid = await creatorMember();
            await makeLink(creatorAgent, kid.id);

            await eraseUserAccount(creator.id);

            expect(await MemberSignInLink.count()).toBe(0);
            expect(await User.findByPk(kid.id)).not.toBeNull();
        });
    });
});
