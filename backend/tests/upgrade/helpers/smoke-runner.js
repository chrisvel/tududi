#!/usr/bin/env node

// Boots the application against DB_FILE in a fresh process (exactly like
// production does) and exercises the API paths that matter after an upgrade.
// Prints a JSON report to stdout; the Jest suite spawns this script once per
// fixture so the app is never loaded twice in one module registry.
//
// Usage: DB_FILE=/path.sqlite3 node tests/upgrade/helpers/smoke-runner.js

process.env.NODE_ENV = 'test';
process.env.DISABLE_SCHEDULER = 'true';
process.env.DISABLE_TELEGRAM = 'true';
process.env.SEQUELIZE_LOGGING = 'false';
delete process.env.DATABASE_URL;
delete process.env.DB_DIALECT;

const path = require('path');
const request = require('supertest');

const BACKEND_DIR = path.join(__dirname, '..', '..', '..');
const models = require(path.join(BACKEND_DIR, 'models'));
const app = require(path.join(BACKEND_DIR, 'app'));

const ALICE = 'alice.legacy@example.com';
const ALICE_MIXED = 'Alice.Legacy@Example.COM';
const BOB = 'bob@example.com';
const PASSWORD = 'password123';

const READ_PATHS = [
    '/api/tasks/metrics',
    '/api/tasks?type=today',
    '/api/tasks?type=today&include_lists=true',
    '/api/tasks?type=upcoming',
    '/api/tasks?type=next',
    '/api/tasks?type=inbox',
    '/api/tasks?type=someday',
    '/api/tasks?type=waiting',
    '/api/tasks?type=all',
    '/api/tasks?type=all&status=done',
    '/api/tasks?type=all&status=active',
    '/api/tasks?type=all&status=all',
    '/api/tasks?tag=urgent',
    '/api/projects',
    '/api/projects?status=all',
    '/api/search?q=review',
    '/api/tags',
    '/api/notes',
    '/api/inbox',
    '/api/goals',
    '/api/people',
    '/api/views',
    '/api/areas',
    '/api/profile',
];

function login(agent, email) {
    return agent.post('/api/login').send({ email, password: PASSWORD });
}

function bodyOf(res) {
    return res.body && typeof res.body === 'object' ? res.body : {};
}

async function main() {
    const { sequelize, User, Person, Project } = models;
    const report = {
        modelTables: Object.values(models)
            .filter((model) => model && model.getTableName)
            .map((model) => String(model.getTableName()))
            .sort(),
        login: {},
        reads: [],
        projectStatuses: [],
        bogusProjectStatus: null,
        tagCountTypes: [],
        allTasksCount: null,
        write: {},
        errors: [],
    };

    // Logins as stored. The mixed-case one documents the pre-fix behaviour.
    report.login.bob = (await login(request.agent(app), BOB)).status;
    report.login.aliceLower = (await login(request.agent(app), ALICE)).status;
    report.login.aliceMixed = (
        await login(request.agent(app), ALICE_MIXED)
    ).status;

    // Reads run as the admin, whose stored email is normalised here the same
    // way the follow-up data migration will do it for real.
    const alice = await User.findOne({ where: { email: ALICE_MIXED } });
    if (alice) {
        await sequelize.query(
            'UPDATE users SET email = :lower WHERE id = :id',
            {
                replacements: { lower: ALICE, id: alice.id },
            }
        );
    }
    const admin = request.agent(app);
    report.login.aliceAfterNormalise = (await login(admin, ALICE)).status;

    for (const url of READ_PATHS) {
        const res = await admin.get(url);
        const entry = { path: url, status: res.status };
        if (res.status >= 400) entry.body = bodyOf(res);
        report.reads.push(entry);
    }

    for (const status of Project.rawAttributes.status.type.values) {
        const res = await admin.get(`/api/projects?status=${status}`);
        report.projectStatuses.push({ status, code: res.status });
    }
    report.bogusProjectStatus = (
        await admin.get('/api/projects?status=bogus')
    ).status;

    const tags = await admin.get('/api/tags');
    const tagList = Array.isArray(tags.body) ? tags.body : tags.body.tags || [];
    for (const tag of tagList) {
        for (const key of Object.keys(tag)) {
            if (/_count$/.test(key)) {
                report.tagCountTypes.push({ key, type: typeof tag[key] });
            }
        }
    }

    const all = await admin.get('/api/tasks?type=all');
    const list = Array.isArray(all.body) ? all.body : all.body.tasks || [];
    report.allTasksCount = list.length;

    // Writes as a regular user: exercises task hooks and the self-person sync.
    const bobAgent = request.agent(app);
    await login(bobAgent, BOB);
    const created = await bobAgent
        .post('/api/task')
        .send({ name: 'Post-upgrade task', priority: 1 });
    report.write.create = created.status;
    const uid = bodyOf(created).uid;
    if (uid) {
        report.write.patch = (
            await bobAgent.patch(`/api/task/${uid}`).send({ status: 2 })
        ).status;
        report.write.delete = (
            await bobAgent.delete(`/api/task/${uid}`)
        ).status;
    }
    report.write.profile = (
        await bobAgent.patch('/api/profile').send({ name: 'Robert' })
    ).status;
    // External databases (LEGACY_FIXTURE_DIR) have no seeded accounts; the
    // write section then just records the failed logins.
    const bob = await User.findOne({ where: { email: BOB } });
    const selfPerson = bob
        ? await Person.findOne({
              where: { user_id: bob.id, linked_user_id: bob.id },
          })
        : null;
    report.write.selfPersonName = selfPerson ? selfPerson.name : null;

    await sequelize.close();
    process.stdout.write(JSON.stringify(report) + '\n');
}

main().catch(async (error) => {
    console.error(error);
    try {
        await models.sequelize.close();
    } catch (_) {
        // ignore
    }
    process.exit(1);
});
