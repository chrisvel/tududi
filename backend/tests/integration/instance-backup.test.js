const zlib = require('zlib');
const request = require('supertest');
const app = require('../../app');
const {
    Area,
    Project,
    Task,
    Person,
    Permission,
    Role,
    User,
    OIDCIdentity,
    UserGroup,
    UserGroupMember,
    GroupShare,
    GroupPermission,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { eraseUserAccount } = require('../../services/accountErasureService');

const login = async (email) => {
    const agent = request.agent(app);
    const res = await agent
        .post('/api/login')
        .send({ email, password: 'password123' });
    return { agent, status: res.status };
};

const makeAdmin = (user) =>
    Role.update(
        { role: 'admin', is_admin: true },
        { where: { user_id: user.id } }
    );

const binary = (res, callback) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
};

const download = async (agent) => {
    const res = await agent
        .get('/api/backup/instance/export')
        .buffer(true)
        .parse(binary);
    return res;
};

const selfPerson = (user) =>
    Person.findOne({ where: { user_id: user.id, linked_user_id: user.id } });

describe('Backup of all accounts (#1660, #1673)', () => {
    let admin, anna, ben;

    beforeEach(async () => {
        const stamp = Date.now();
        admin = await createTestUser({
            email: `admin_${stamp}@example.com`,
            name: 'Ada',
        });
        await makeAdmin(admin);
        anna = await createTestUser({
            email: `anna_${stamp}@example.com`,
            name: 'Anna',
        });
        ben = await createTestUser({ email: `ben_${stamp}@example.com` });
        await Role.update(
            { role: 'guest', is_admin: false },
            { where: { user_id: ben.id } }
        );
    });

    const seed = async () => {
        const area = await Area.create({ name: 'Home', user_id: admin.id });
        const project = await Project.create({
            name: 'Garden',
            user_id: admin.id,
            area_id: area.id,
        });
        const annaSelf = await selfPerson(anna);
        await Task.create({
            name: 'Plant tomatoes',
            user_id: admin.id,
            project_id: project.id,
            assigned_to: annaSelf.uid,
        });
        await Task.create({ name: 'Anna own task', user_id: anna.id });
        await Permission.create({
            user_id: anna.id,
            resource_type: 'project',
            resource_uid: project.uid,
            access_level: 'rw',
            propagation: 'direct',
            granted_by_user_id: admin.id,
        });
        const annaCard = await Person.create({
            name: 'Anna (card)',
            user_id: admin.id,
            linked_user_id: anna.id,
        });
        const group = await UserGroup.create({
            name: `Family ${Date.now()}`,
            created_by_user_id: admin.id,
        });
        await UserGroupMember.create({ group_id: group.id, user_id: ben.id });
        const groupShare = await GroupShare.create({
            group_id: group.id,
            resource_type: 'project',
            resource_uid: project.uid,
            access_level: 'ro',
            granted_by_user_id: admin.id,
        });
        await GroupPermission.create({
            group_share_id: groupShare.id,
            user_id: ben.id,
            resource_type: 'project',
            resource_uid: project.uid,
            access_level: 'ro',
            propagation: 'direct',
            granted_by_user_id: admin.id,
            status: 'accepted',
        });
        await OIDCIdentity.create({
            user_id: anna.id,
            provider_slug: 'authentik',
            subject: `anna-sub-${Date.now()}`,
            email: anna.email,
            first_login_at: new Date(),
            last_login_at: new Date(),
        });
        return { project, group, annaCard, annaSelf };
    };

    // What a reinstall looks like: every account gone, then a new admin
    // created with the same email as before.
    const reinstall = async (group) => {
        const temp = await createTestUser({
            email: `temp_${Date.now()}@example.com`,
        });
        await makeAdmin(temp);
        for (const user of [anna, ben, admin]) await eraseUserAccount(user.id);
        await GroupPermission.destroy({ where: {} });
        await GroupShare.destroy({ where: {} });
        await UserGroupMember.destroy({ where: {} });
        await UserGroup.destroy({ where: { id: group.id } });
        const fresh = await createTestUser({ email: admin.email });
        await makeAdmin(fresh);
        await eraseUserAccount(temp.id);
        return fresh;
    };

    it('brings back every account, their data, shares and groups', async () => {
        const { project, group, annaSelf } = await seed();
        const { agent } = await login(admin.email);

        const res = await download(agent);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/gzip/);
        const backup = JSON.parse(zlib.gunzipSync(res.body).toString());
        expect(backup.kind).toBe('instance');
        expect(backup.accounts).toHaveLength(3);

        const fresh = await reinstall(group);
        expect(await User.count({ where: { email: anna.email } })).toBe(0);

        const { agent: freshAgent } = await login(admin.email);
        const restore = await freshAgent
            .post('/api/backup/instance/import')
            .attach('backup', res.body, 'all.json.gz');
        expect(restore.status).toBe(200);
        const statuses = Object.fromEntries(
            restore.body.accounts.map((a) => [a.email, a.status])
        );
        expect(statuses[admin.email]).toBe('existing');
        expect(statuses[anna.email]).toBe('created');
        expect(statuses[ben.email]).toBe('created');

        // Members sign in with their old passwords and keep their roles
        const restoredAnna = await User.findOne({
            where: { email: anna.email },
        });
        const restoredBen = await User.findOne({ where: { email: ben.email } });
        expect(restoredAnna.uid).toBe(anna.uid);
        expect(restoredAnna.name).toBe('Anna');
        expect(
            (await Role.findOne({ where: { user_id: restoredBen.id } })).role
        ).toBe('guest');
        const { agent: annaAgent, status } = await login(anna.email);
        expect(status).toBe(200);

        // The admin's data is back in the fresh admin account
        const restoredProject = await Project.findOne({
            where: { user_id: fresh.id, name: 'Garden' },
        });
        expect(restoredProject.uid).toBe(project.uid);

        // Anna's own data, her share and the assignment to her person
        expect(
            await Task.count({
                where: { user_id: restoredAnna.id, name: 'Anna own task' },
            })
        ).toBe(1);
        const projects = await annaAgent.get('/api/projects');
        expect(projects.body.projects.map((p) => p.uid)).toContain(project.uid);
        const planted = await Task.findOne({
            where: { name: 'Plant tomatoes' },
        });
        expect(planted.assigned_to).toBe(annaSelf.uid);
        expect((await selfPerson(restoredAnna)).uid).toBe(annaSelf.uid);

        // The admin's card for Anna points at her account again
        const card = await Person.findOne({
            where: { user_id: fresh.id, name: 'Anna (card)' },
        });
        expect(card.linked_user_id).toBe(restoredAnna.id);

        // Group, its member and the group share
        const restoredGroup = await UserGroup.findOne({
            where: { uid: group.uid },
        });
        expect(restoredGroup).not.toBeNull();
        expect(
            await UserGroupMember.count({
                where: { group_id: restoredGroup.id, user_id: restoredBen.id },
            })
        ).toBe(1);
        expect(
            await GroupPermission.count({
                where: { user_id: restoredBen.id, resource_uid: project.uid },
            })
        ).toBe(1);

        // SSO link
        expect(
            await OIDCIdentity.count({ where: { user_id: restoredAnna.id } })
        ).toBe(1);

        // Running it again adds nothing
        const again = await freshAgent
            .post('/api/backup/instance/import')
            .attach('backup', res.body, 'all.json.gz');
        expect(again.status).toBe(200);
        expect(again.body.accounts.every((a) => a.status === 'existing')).toBe(
            true
        );
        expect(again.body.shares).toBe(0);
        expect(await Task.count({ where: { name: 'Plant tomatoes' } })).toBe(1);
        expect(await User.count({ where: { email: anna.email } })).toBe(1);
    });

    it('never changes an account that already exists', async () => {
        const { agent } = await login(admin.email);
        const res = await download(agent);

        await User.update(
            { name: 'Anna changed', password_digest: 'other-hash' },
            { where: { id: anna.id }, hooks: false }
        );
        const restore = await agent
            .post('/api/backup/instance/import')
            .attach('backup', res.body, 'all.json.gz');
        expect(restore.status).toBe(200);
        const current = await User.findByPk(anna.id);
        expect(current.name).toBe('Anna changed');
        expect(current.password_digest).toBe('other-hash');
    });

    it('is for admins only', async () => {
        const { agent } = await login(anna.email);
        expect((await agent.get('/api/backup/instance/export')).status).toBe(
            403
        );
        const upload = await agent
            .post('/api/backup/instance/import')
            .attach('backup', Buffer.from('{}'), 'all.json');
        expect(upload.status).toBe(403);
    });

    it('does not exist on a hosted instance', async () => {
        const config = require('../../config/config').getConfig();
        const original = config.hosted;
        config.hosted = { ...(original || {}), enabled: true };
        try {
            const { agent } = await login(admin.email);
            expect(
                (await agent.get('/api/backup/instance/export')).status
            ).toBe(404);
        } finally {
            config.hosted = original;
        }
    });

    it('refuses the wrong kind of file in each restore', async () => {
        const { agent } = await login(admin.email);
        const res = await download(agent);

        const single = await agent
            .post('/api/backup/import')
            .attach('backup', res.body, 'all.json.gz');
        expect(single.status).toBe(400);
        expect(single.body.error).toMatch(/all accounts/);

        const exported = await agent.post('/api/backup/export');
        const own = await agent
            .get(`/api/backup/${exported.body.backup.uid}/download`)
            .buffer(true)
            .parse(binary);
        const wrong = await agent
            .post('/api/backup/instance/import')
            .attach('backup', own.body, 'mine.json.gz');
        expect(wrong.status).toBe(400);
    });
});
