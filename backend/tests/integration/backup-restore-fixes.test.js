const request = require('supertest');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');
const sqlite3 = require('sqlite3');
const app = require('../../app');
const { Backup, Project, Tag, User } = require('../../models');
const {
    compareVersions,
    checkVersionCompatibility,
    getBackupsDirectory,
} = require('../../services/backupService');
const {
    exportUserData,
    importUserData,
} = require('../../services/userDataTransfer');
const { createTestUser } = require('../helpers/testUtils');
const packageJson = require('../../../package.json');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

describe('backup version order', () => {
    it('compares numeric prerelease parts as numbers', () => {
        expect(compareVersions('v1.6.0-rc.10', 'v1.6.0-rc.9')).toBeGreaterThan(
            0
        );
        expect(compareVersions('v1.6.0-rc.5', 'v1.6.0-rc.10')).toBeLessThan(0);
        expect(compareVersions('v1.6.0-rc.5', 'v1.6.0-rc.5')).toBe(0);
        expect(compareVersions('v1.6.0-rc.5', 'v1.6.0')).toBeLessThan(0);
        expect(compareVersions('v1.6.0-rc.1', 'v1.6.0-beta.2')).toBeGreaterThan(
            0
        );
        expect(compareVersions('v1.6.0-rc', 'v1.6.0-rc.1')).toBeLessThan(0);
    });

    it('rejects a backup from a later prerelease with a two-digit number', () => {
        const [main, pre] = packageJson.version.replace(/^v/, '').split('-');
        const later = pre
            ? `v${main}-${pre.replace(/\d+$/, (n) => String(Number(n) + 10))}`
            : `v${main.replace(/\d+$/, (n) => String(Number(n) + 10))}`;
        expect(checkVersionCompatibility(later).compatible).toBe(false);
        expect(checkVersionCompatibility('v1.0.0-rc.10').compatible).toBe(true);
    });
});

describe('saved backup errors', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({ email: `bk_${Date.now()}@example.com` });
        agent = await login(user);
    });

    it('returns 404 for an unknown backup on restore and delete', async () => {
        const restore = await agent.post('/api/backup/nope/restore').send({});
        expect(restore.status).toBe(404);
        const del = await agent.delete('/api/backup/nope');
        expect(del.status).toBe(404);
    });

    it('returns 404 when the backup file is gone from disk', async () => {
        const created = await agent.post('/api/backup/export');
        expect(created.status).toBe(200);
        const { uid } = created.body.backup;
        const row = await Backup.findOne({ where: { uid } });
        fs.unlinkSync(path.join(await getBackupsDirectory(), row.file_path));

        const restore = await agent.post(`/api/backup/${uid}/restore`).send({});
        expect(restore.status).toBe(404);
        const download = await agent.get(`/api/backup/${uid}/download`);
        expect(download.status).toBe(404);
    });
});

describe('backup import keeps', () => {
    it('project templates, tag pins and keyboard shortcuts', async () => {
        const source = await createTestUser({
            email: `ks_${Date.now()}@example.com`,
        });
        const target = await createTestUser({
            email: `kt_${Date.now()}@example.com`,
        });
        await Project.create({
            name: 'Template',
            user_id: source.id,
            is_template: true,
            template_category: 'Work',
        });
        await Tag.create({ name: 'focus', user_id: source.id, pinned: true });
        await source.update({ keyboard_shortcuts: { newTask: 'n' } });

        const backup = await exportUserData(source.id);
        await importUserData(target.id, backup, { merge: true });

        const project = await Project.findOne({
            where: { user_id: target.id, name: 'Template' },
        });
        expect(project.is_template).toBe(true);
        expect(project.template_category).toBe('Work');
        const tag = await Tag.findOne({
            where: { user_id: target.id, name: 'focus' },
        });
        expect(tag.pinned).toBe(true);
        const reloaded = await User.findByPk(target.id);
        expect(reloaded.keyboard_shortcuts).toEqual({ newTask: 'n' });
    });
});

describe('sqlite-backup script', () => {
    const script = path.join(__dirname, '../../scripts/sqlite-backup.js');

    const count = (file) =>
        new Promise((resolve, reject) => {
            const db = new sqlite3.Database(file, (openError) => {
                if (openError) return reject(openError);
                db.get('SELECT COUNT(*) AS c FROM t', (error, row) =>
                    db.close(() => (error ? reject(error) : resolve(row.c)))
                );
            });
        });

    it('includes writes left in the -wal file by an unclean stop', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite-backup-'));
        const source = path.join(dir, 'live.sqlite3');
        const target = path.join(dir, 'backup.sqlite3');

        // Commit rows in WAL mode, then die without closing the database.
        const writer = `
            const sqlite3 = require(${JSON.stringify(require.resolve('sqlite3'))});
            const db = new sqlite3.Database(${JSON.stringify(source)});
            db.serialize(() => {
                db.run('PRAGMA journal_mode=WAL');
                db.run('CREATE TABLE t(x)');
                db.run('PRAGMA wal_checkpoint(TRUNCATE)');
                db.run('PRAGMA wal_autocheckpoint=0');
                for (let i = 0; i < 50; i++) db.run('INSERT INTO t VALUES (?)', i);
                db.get('SELECT 1', () => process.kill(process.pid, 'SIGKILL'));
            });`;
        spawnSync(process.execPath, ['-e', writer]);
        expect(fs.statSync(`${source}-wal`).size).toBeGreaterThan(0);

        execFileSync(process.execPath, [script, source, target]);
        expect(await count(target)).toBe(50);

        // Never overwrites an existing file
        const again = spawnSync(process.execPath, [script, source, target]);
        expect(again.status).toBe(1);

        fs.rmSync(dir, { recursive: true, force: true });
    });
});
