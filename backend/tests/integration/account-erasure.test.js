const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;
const app = require('../../app');
const {
    User,
    Role,
    Project,
    Task,
    Note,
    Goal,
    Person,
    TaskAttachment,
    Backup,
    OIDCIdentity,
    AuthAuditLog,
    CalDAVCalendar,
    CalDAVSyncState,
    CalendarToken,
    Permission,
    sequelize,
} = require('../../models');
const { getConfig } = require('../../config/config');
const { getBackupsDirectory } = require('../../services/backupService');
const { createTestUser } = require('../helpers/testUtils');

const config = getConfig();

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

// Creates one row of everything that hangs off a user, plus the files on
// disk that some of those rows point at.
async function seedEverything(user, other) {
    const project = await Project.create({
        name: 'Erase me',
        user_id: user.id,
    });
    const task = await Task.create({
        name: 'Erase me too',
        user_id: user.id,
        project_id: project.id,
    });
    await Note.create({ title: 'n', content: 'c', user_id: user.id });
    await Goal.create({ title: 'g', user_id: user.id });
    await Person.create({ name: 'Contact', user_id: user.id });

    // Another user's contact card linked to this account
    const theirCard = await Person.create({
        name: 'Me as seen by other',
        user_id: other.id,
        linked_user_id: user.id,
    });

    const tasksDir = path.join(config.uploadPath, 'tasks');
    await fs.mkdir(tasksDir, { recursive: true });
    const attachmentName = `erase-${Date.now()}.txt`;
    await fs.writeFile(path.join(tasksDir, attachmentName), 'bytes');
    await TaskAttachment.create({
        task_id: task.id,
        user_id: user.id,
        original_filename: 'a.txt',
        stored_filename: attachmentName,
        file_path: `tasks/${attachmentName}`,
        file_size: 5,
        mime_type: 'text/plain',
    });

    const backupsDir = await getBackupsDirectory();
    const backupName = `backup-user-${user.id}-${Date.now()}.json.gz`;
    await fs.writeFile(path.join(backupsDir, backupName), 'gz');
    await Backup.create({
        user_id: user.id,
        file_path: backupName,
        file_size: 2,
        version: '1.0',
        item_counts: {},
    });

    await OIDCIdentity.create({
        user_id: user.id,
        provider_slug: 'test',
        subject: `sub-${user.id}`,
        email: user.email,
        first_login_at: new Date(),
        last_login_at: new Date(),
    });
    await AuthAuditLog.create({
        user_id: user.id,
        event_type: 'login_success',
        auth_method: 'email_password',
    });
    const calendar = await CalDAVCalendar.create({
        user_id: user.id,
        name: 'cal',
        url: 'https://example.com/cal',
        username: 'u',
        password_encrypted: 'x',
    });
    await CalDAVSyncState.create({
        calendar_id: calendar.id,
        task_id: task.id,
        remote_uid: 'r',
        remote_href: '/r.ics',
        etag: 'etag',
        last_modified: new Date(),
    });
    await CalendarToken.create({
        user_id: user.id,
        provider: 'google',
        access_token: 'a',
        refresh_token: 'r',
    });
    await Permission.create({
        user_id: other.id,
        resource_type: 'project',
        resource_uid: project.uid,
        access_level: 'ro',
        propagation: 'direct',
        granted_by_user_id: user.id,
    });

    return {
        attachmentPath: path.join(tasksDir, attachmentName),
        backupPath: path.join(backupsDir, backupName),
        theirCardId: theirCard.id,
        calendarId: calendar.id,
    };
}

const exists = (p) =>
    fs
        .access(p)
        .then(() => true)
        .catch(() => false);

describe('Account erasure', () => {
    let admin, user, other;

    beforeEach(async () => {
        admin = await createTestUser({
            email: `admin_${Date.now()}@example.com`,
        });
        await Role.update({ is_admin: true }, { where: { user_id: admin.id } });
        user = await createTestUser({
            email: `victim_${Date.now()}@example.com`,
        });
        other = await createTestUser({
            email: `other_${Date.now()}@example.com`,
        });
    });

    const expectFullyErased = async (seeded) => {
        expect(await User.findByPk(user.id)).toBeNull();
        for (const [Model, label] of [
            [Task, 'tasks'],
            [Note, 'notes'],
            [Project, 'projects'],
            [Goal, 'goals'],
            [Person, 'people'],
            [TaskAttachment, 'attachments'],
            [Backup, 'backups'],
            [OIDCIdentity, 'oidc identities'],
            [AuthAuditLog, 'audit log'],
            [CalDAVCalendar, 'caldav calendars'],
            [CalendarToken, 'calendar tokens'],
            [Role, 'roles'],
        ]) {
            const count = await Model.count({ where: { user_id: user.id } });
            expect({ [label]: count }).toEqual({ [label]: 0 });
        }
        expect(
            await CalDAVSyncState.count({
                where: { calendar_id: seeded.calendarId },
            })
        ).toBe(0);
        expect(
            await Permission.count({ where: { granted_by_user_id: user.id } })
        ).toBe(0);

        const theirCard = await Person.findByPk(seeded.theirCardId);
        expect(theirCard).not.toBeNull();
        expect(theirCard.linked_user_id).toBeNull();

        expect(await exists(seeded.attachmentPath)).toBe(false);
        expect(await exists(seeded.backupPath)).toBe(false);
    };

    it('admin deletion removes every row and file of the user', async () => {
        const seeded = await seedEverything(user, other);
        const adminAgent = await login(admin);

        const res = await adminAgent.delete(`/api/admin/users/${user.id}`);
        expect(res.status).toBe(204);

        await expectFullyErased(seeded);
    });

    it('self-service deletion requires the password and ends the session', async () => {
        const seeded = await seedEverything(user, other);
        const agent = await login(user);

        const wrong = await agent
            .delete('/api/profile')
            .send({ password: 'not-it' });
        expect(wrong.status).toBe(400);
        expect(await User.findByPk(user.id)).not.toBeNull();

        const missing = await agent.delete('/api/profile').send({});
        expect(missing.status).toBe(400);

        const ok = await agent
            .delete('/api/profile')
            .send({ password: 'password123' });
        expect(ok.status).toBe(204);

        await expectFullyErased(seeded);

        const after = await agent.get('/api/current_user');
        expect(after.body.user).toBeNull();
    });

    it('a passwordless account confirms with its email address', async () => {
        const sso = await User.create({
            email: `sso_${Date.now()}@example.com`,
            password_digest: null,
        });
        const Session = sequelize.models.Session;
        expect(Session).toBeDefined();

        // No password to log in with, so drive the endpoint through a
        // session row written directly.
        const agent = request.agent(app);
        const csrf = await agent.get('/api/csrf-token');
        expect(csrf.status).toBe(200);
        const sid = csrf.headers['set-cookie']
            ?.find((c) => c.startsWith('connect.sid'))
            ?.split(';')[0]
            .split('=')[1];
        const rawSid = decodeURIComponent(sid).slice(2).split('.')[0];
        const row = await Session.findByPk(rawSid);
        const data = JSON.parse(row.data);
        data.userId = sso.id;
        await row.update({ data: JSON.stringify(data) });

        const wrong = await agent
            .delete('/api/profile')
            .send({ confirm_email: 'someone-else@example.com' });
        expect(wrong.status).toBe(400);

        const ok = await agent
            .delete('/api/profile')
            .send({ confirm_email: sso.email.toUpperCase() });
        expect(ok.status).toBe(204);
        expect(await User.findByPk(sso.id)).toBeNull();
    });

    it('the last admin cannot delete their own account', async () => {
        const adminAgent = await login(admin);

        const res = await adminAgent
            .delete('/api/profile')
            .send({ password: 'password123' });
        expect(res.status).toBe(400);
        expect(await User.findByPk(admin.id)).not.toBeNull();
    });
});
