const request = require('supertest');

jest.mock('../../services/emailService', () => ({
    isEmailEnabled: () => true,
    initializeEmailService: () => {},
    verifyEmailConnection: async () => ({ success: true }),
    sendEmail: async () => ({ success: true, messageId: 'test' }),
}));
jest.mock('../../modules/oidc/providerConfig');

const app = require('../../app');
const { getConfig } = require('../../config/config');
const plans = require('../../config/plans');
const providerConfig = require('../../modules/oidc/providerConfig');
const provisioningService = require('../../modules/oidc/provisioningService');
const {
    Account,
    Area,
    BillingAccount,
    Goal,
    InboxItem,
    Note,
    Person,
    Project,
    Role,
    Setting,
    Tag,
    Task,
    User,
    View,
    sequelize,
} = require('../../models');
const entitlements = require('../../services/entitlementsService');
const { createApiToken } = require('../../modules/users/apiTokenService');
const { createTestUser } = require('../helpers/testUtils');

// Every customer on tududi Cloud gets an account of its own, however it
// signed up, and nothing one account owns can be read, changed or deleted
// from another account: not through the REST API and not through MCP. Inside
// an account, admins manage members but do not see their private items.

const config = getConfig();

const realFetch = global.fetch;
const mockFetch = async (url, init = {}) => {
    const match = String(url).match(/\/subscription-items\/([^/]+)$/);
    if (match && init.method === 'PATCH') {
        const { quantity } = JSON.parse(init.body).data.attributes;
        return new Response(
            JSON.stringify({
                data: {
                    type: 'subscription-items',
                    id: match[1],
                    attributes: { quantity },
                },
            }),
            { status: 200 }
        );
    }
    return new Response('not found', { status: 404 });
};

const enableHosted = () => {
    config.hosted.enabled = true;
    config.hosted.billing.provider = 'lemonsqueezy';
    config.hosted.lemonsqueezy.apiKey = 'ls_test_key';
    config.hosted.lemonsqueezy.storeId = '1';
    config.hosted.lemonsqueezy.webhookSecret = 'secret';
    config.hosted.lemonsqueezy.variants.proMonthly = '100';
    plans._resetCache();
    entitlements.invalidate();
};

const disableHosted = () => {
    config.hosted.enabled = false;
    config.hosted.billing.provider = 'stripe';
    config.hosted.lemonsqueezy.apiKey = undefined;
    config.hosted.lemonsqueezy.storeId = undefined;
    config.hosted.lemonsqueezy.webhookSecret = undefined;
    config.hosted.lemonsqueezy.variants.proMonthly = undefined;
    plans._resetCache();
    entitlements.invalidate();
};

const login = async (email, password = 'password123') => {
    const agent = request.agent(app);
    const res = await agent.post('/api/login').send({ email, password });
    if (res.status !== 200) {
        throw new Error(
            `could not sign in ${email}: ${res.status} ${JSON.stringify(res.body)}`
        );
    }
    return agent;
};

const subscribe = (userId) =>
    BillingAccount.create({
        user_id: userId,
        provider: 'lemonsqueezy',
        provider_subscription_id: `sub_${userId}`,
        provider_subscription_item_id: `item_${userId}`,
        seat_quantity: 1,
        status: 'active',
        plan: 'pro',
    });

const tokenFor = async (userId) =>
    (
        await createApiToken({
            userId,
            name: 'isolation test',
            expiresAt: null,
        })
    ).rawToken;

// search echoes the query back, which is not a leak.
const scrubQuery = (text) => text.replace(/"query":\s*"[^"]*"/g, '');

function mcpText(response) {
    for (const line of response.text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const rpc = JSON.parse(line.slice(6));
        if (rpc.error) return { isError: true, text: JSON.stringify(rpc) };
        const content = rpc.result?.content?.[0]?.text || '';
        return {
            isError: rpc.result?.isError === true,
            text: scrubQuery(content),
        };
    }
    return { isError: true, text: response.text };
}

const callTool = async (token, name, args = {}) =>
    mcpText(
        await request(app)
            .post('/api/mcp')
            .set('Authorization', `Bearer ${token}`)
            .set('Content-Type', 'application/json')
            .set('Accept', 'application/json, text/event-stream')
            .send({
                jsonrpc: '2.0',
                method: 'tools/call',
                params: { name, arguments: args },
                id: 1,
            })
    );

// Everything a user can own, created straight in the database and named with
// a marker that must never show up anywhere it does not belong.
async function seedItems(user, marker) {
    const area = await Area.create({
        name: `${marker} area`,
        user_id: user.id,
    });
    const goal = await Goal.create({
        title: `${marker} goal`,
        user_id: user.id,
        area_id: area.id,
    });
    const project = await Project.create({
        name: `${marker} project`,
        user_id: user.id,
        area_id: area.id,
    });
    const task = await Task.create({
        name: `${marker} task`,
        note: `${marker} task note`,
        user_id: user.id,
        project_id: project.id,
    });
    const note = await Note.create({
        title: `${marker} note`,
        content: `${marker} note body`,
        user_id: user.id,
    });
    const tag = await Tag.create({ name: `${marker}tag`, user_id: user.id });
    const habit = await Task.create({
        name: `${marker} habit`,
        user_id: user.id,
        habit_mode: true,
    });
    const person = await Person.create({
        name: `${marker} contact`,
        notes: `${marker} private notes`,
        user_id: user.id,
    });
    const inbox = await InboxItem.create({
        content: `${marker} inbox`,
        source: 'web',
        user_id: user.id,
    });
    const view = await View.create({
        name: `${marker} view`,
        user_id: user.id,
        search_query: marker,
    });
    return { area, goal, project, task, note, tag, habit, person, inbox, view };
}

// The same item, read again, still has the name it was created with.
async function expectUntouched(items, marker) {
    expect((await Area.findByPk(items.area.id))?.name).toBe(`${marker} area`);
    expect((await Goal.findByPk(items.goal.id))?.title).toBe(`${marker} goal`);
    expect((await Project.findByPk(items.project.id))?.name).toBe(
        `${marker} project`
    );
    expect((await Task.findByPk(items.task.id))?.name).toBe(`${marker} task`);
    expect((await Note.findByPk(items.note.id))?.title).toBe(`${marker} note`);
    expect((await Tag.findByPk(items.tag.id))?.name).toBe(`${marker}tag`);
    expect((await Task.findByPk(items.habit.id))?.name).toBe(`${marker} habit`);
    expect((await Person.findByPk(items.person.id))?.name).toBe(
        `${marker} contact`
    );
    expect((await InboxItem.findByPk(items.inbox.id))?.content).toBe(
        `${marker} inbox`
    );
    expect((await View.findByPk(items.view.id))?.name).toBe(`${marker} view`);
}

const singleReads = (items) => [
    `/api/areas/${items.area.uid}`,
    `/api/goals/${items.goal.uid}`,
    `/api/project/${items.project.uid}`,
    `/api/task/${items.task.uid}`,
    `/api/task/${items.task.uid}/subtasks`,
    `/api/note/${items.note.uid}`,
    `/api/tag?uid=${items.tag.uid}`,
    `/api/habits/${items.habit.uid}`,
    `/api/habits/${items.habit.uid}/stats`,
    `/api/people/${items.person.uid}`,
    `/api/inbox/${items.inbox.uid}`,
    `/api/views/${items.view.uid}`,
];

const singleWrites = (items) => [
    ['patch', `/api/areas/${items.area.uid}`, { name: 'pwned' }],
    ['patch', `/api/goals/${items.goal.uid}`, { title: 'pwned' }],
    ['patch', `/api/project/${items.project.uid}`, { name: 'pwned' }],
    ['patch', `/api/task/${items.task.uid}`, { name: 'pwned' }],
    ['patch', `/api/note/${items.note.uid}`, { title: 'pwned' }],
    ['patch', `/api/tag/${items.tag.uid}`, { name: 'pwned' }],
    ['put', `/api/habits/${items.habit.uid}`, { name: 'pwned' }],
    ['patch', `/api/people/${items.person.uid}`, { name: 'pwned' }],
    ['patch', `/api/inbox/${items.inbox.uid}`, { content: 'pwned' }],
    ['patch', `/api/views/${items.view.uid}`, { name: 'pwned' }],
    ['delete', `/api/areas/${items.area.uid}`],
    ['delete', `/api/goals/${items.goal.uid}`],
    ['delete', `/api/project/${items.project.uid}`],
    ['delete', `/api/task/${items.task.uid}`],
    ['delete', `/api/note/${items.note.uid}`],
    ['delete', `/api/tag/${items.tag.uid}`],
    ['delete', `/api/habits/${items.habit.uid}`],
    ['delete', `/api/people/${items.person.uid}`],
    ['delete', `/api/inbox/${items.inbox.uid}`],
    ['delete', `/api/views/${items.view.uid}`],
];

const LISTS = [
    '/api/areas',
    '/api/goals',
    '/api/projects',
    '/api/tasks',
    '/api/tasks?type=today',
    '/api/tasks?type=upcoming',
    '/api/notes',
    '/api/tags',
    '/api/habits',
    '/api/people',
    '/api/people/assignable',
    '/api/inbox',
    '/api/views',
    '/api/everyone',
    '/api/shares/candidates',
    '/api/groups',
];

const MCP_LISTS = [
    ['list_areas'],
    ['list_goals'],
    ['list_projects'],
    ['list_tasks'],
    ['list_notes'],
    ['list_tags'],
    ['list_habits'],
    ['list_people'],
    ['list_inbox'],
    ['list_views'],
];

const mcpSingleCalls = (items, marker) => [
    ['get_area', { uid: items.area.uid }],
    ['get_goal', { uid: items.goal.uid }],
    ['get_project', { uid: items.project.uid }],
    ['get_task', { id: items.task.uid }],
    ['get_task', { id: items.task.id }],
    ['list_task_comments', { id: items.task.uid }],
    ['list_task_relations', { id: items.task.uid }],
    ['get_note', { uid: items.note.uid }],
    ['get_tag', { name: `${marker}tag` }],
    ['get_habit', { uid: items.habit.uid }],
    ['get_habit_stats', { uid: items.habit.uid }],
    ['get_habit_completions', { uid: items.habit.uid }],
    ['get_person', { uid: items.person.uid }],
    ['get_inbox_item', { uid: items.inbox.uid }],
    ['get_view', { uid: items.view.uid }],
];

const mcpWrites = (items) => [
    ['update_area', { uid: items.area.uid, name: 'pwned' }],
    ['update_goal', { uid: items.goal.uid, title: 'pwned' }],
    ['update_project', { uid: items.project.uid, name: 'pwned' }],
    ['update_task', { id: items.task.uid, name: 'pwned' }],
    ['complete_task', { id: items.task.uid }],
    ['add_subtask', { parent_id: items.task.uid, name: 'pwned' }],
    ['add_task_comment', { id: items.task.uid, body: 'pwned' }],
    ['update_note', { uid: items.note.uid, title: 'pwned' }],
    ['update_tag', { uid: items.tag.uid, name: 'pwned' }],
    ['update_habit', { uid: items.habit.uid, name: 'pwned' }],
    ['log_habit_completion', { uid: items.habit.uid }],
    ['update_person', { uid: items.person.uid, name: 'pwned' }],
    ['update_inbox_item', { uid: items.inbox.uid, content: 'pwned' }],
    ['process_inbox_item', { uid: items.inbox.uid }],
    ['update_view', { uid: items.view.uid, name: 'pwned' }],
    ['delete_area', { uid: items.area.uid }],
    ['delete_goal', { uid: items.goal.uid }],
    ['delete_project', { uid: items.project.uid }],
    ['delete_task', { id: items.task.uid }],
    ['delete_note', { uid: items.note.uid }],
    ['delete_tag', { uid: items.tag.uid }],
    ['delete_habit', { uid: items.habit.uid }],
    ['delete_person', { uid: items.person.uid }],
    ['delete_inbox_item', { uid: items.inbox.uid }],
    ['delete_view', { uid: items.view.uid }],
];

describe('Cloud: account isolation', () => {
    beforeAll(() => {
        global.fetch = mockFetch;
    });

    afterAll(async () => {
        global.fetch = realFetch;
        disableHosted();
        await sequelize.close();
    });

    describe('every first user gets an account', () => {
        let stamp, superadmin;

        beforeEach(async () => {
            enableHosted();
            stamp = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
            superadmin = await createTestUser({
                email: `super_${stamp}@example.com`,
            });
            await Role.update({ is_admin: false }, { where: {} });
            await Role.update(
                { is_admin: true, role: 'admin' },
                { where: { user_id: superadmin.id } }
            );
            await Setting.upsert({
                key: 'registration_enabled',
                value: 'true',
            });
        });

        afterEach(() => {
            disableHosted();
        });

        const expectOwnerAndAdmin = async (userId) => {
            const user = await User.findByPk(userId);
            const account = await Account.findOne({
                where: { owner_user_id: userId },
            });
            expect(account).not.toBeNull();
            expect(user.account_id).toBe(account.id);
            const role = await Role.findOne({ where: { user_id: userId } });
            expect(role.is_admin).toBe(false);
            expect(role.role).toBe('account_admin');
        };

        it('when signing up with an email and password', async () => {
            const email = `signup_${stamp}@example.com`;
            const res = await request(app)
                .post('/api/register')
                .send({ email, password: 'password123' });
            expect(res.status).toBe(201);

            const user = await User.findOne({ where: { email } });
            await expectOwnerAndAdmin(user.id);
        });

        it('when signing up with single sign-on', async () => {
            providerConfig.getProvider.mockResolvedValue({
                slug: 'google',
                name: 'Google',
                autoProvision: true,
                adminEmailDomains: ['example.com'],
            });

            const { user, isNewUser } = await provisioningService.provisionUser(
                'google',
                {
                    sub: `sub_${stamp}`,
                    email: `sso_${stamp}@example.com`,
                    email_verified: true,
                    name: 'Single Sign',
                },
                {}
            );

            expect(isNewUser).toBe(true);
            // The admin domain matches, but the superadmin already exists.
            await expectOwnerAndAdmin(user.id);
            expect(await Role.count({ where: { is_admin: true } })).toBe(1);
        });

        it('when the superadmin creates a customer', async () => {
            const agent = await login(superadmin.email);
            const res = await agent.post('/api/admin/users').send({
                email: `comped_${stamp}@example.com`,
                password: 'password123',
            });
            expect(res.status).toBe(201);

            await expectOwnerAndAdmin(res.body.id);
            const superRow = await User.findByPk(superadmin.id);
            const created = await User.findByPk(res.body.id);
            expect(created.account_id).not.toBe(superRow.account_id);
        });

        it('and members join the account that added them', async () => {
            const owner = await createTestUser({
                email: `owner_${stamp}@example.com`,
            });
            await subscribe(owner.id);
            const ownerAgent = await login(owner.email);
            const partner = (
                await ownerAgent.post('/api/members').send({
                    name: 'Partner',
                    email: `partner_${stamp}@example.com`,
                    password: 'password123',
                    role: 'account_admin',
                })
            ).body;
            const partnerAgent = await login(partner.email);
            const kid = (
                await partnerAgent
                    .post('/api/members')
                    .send({ name: `Kid ${stamp}` })
            ).body;

            const ownerAccount = (await User.findByPk(owner.id)).account_id;
            expect((await User.findByPk(partner.id)).account_id).toBe(
                ownerAccount
            );
            expect((await User.findByPk(kid.id)).account_id).toBe(ownerAccount);
            expect(
                await Account.count({ where: { owner_user_id: kid.id } })
            ).toBe(0);
        });

        it('so no hosted user is ever left without one', async () => {
            await createTestUser({ email: `plain_${stamp}@example.com` });
            const without = await User.count({ where: { account_id: null } });
            expect(without).toBe(0);
            for (const account of await Account.findAll()) {
                const ownerRow = await User.findByPk(account.owner_user_id);
                expect(ownerRow.account_id).toBe(account.id);
            }
        });
    });

    describe('one account and another', () => {
        let stamp, markerA, markerB, markerMember;
        let ownerA, memberA, ownerB, memberB;
        let ownerAAgent, memberAAgent, ownerBAgent, memberBAgent;
        let itemsA, itemsMemberA, itemsB;
        let tokens;

        // tests/helpers/setup.js empties every table before each test, so
        // both accounts are built again for each one.
        beforeEach(async () => {
            enableHosted();
            stamp = `${Date.now()}${Math.round(Math.random() * 1e6)}`;
            markerA = `zzalpha${stamp}`;
            markerMember = `zzkid${stamp}`;
            markerB = `zzbeta${stamp}`;

            const superadmin = await createTestUser({
                email: `iso_super_${stamp}@example.com`,
            });
            await Role.update({ is_admin: false }, { where: {} });
            await Role.update(
                { is_admin: true, role: 'admin' },
                { where: { user_id: superadmin.id } }
            );

            ownerA = await createTestUser({
                email: `iso_a_${stamp}@example.com`,
                name: 'Alpha',
            });
            ownerB = await createTestUser({
                email: `iso_b_${stamp}@example.com`,
                name: 'Beta',
            });
            await subscribe(ownerA.id);
            await subscribe(ownerB.id);
            ownerAAgent = await login(ownerA.email);
            ownerBAgent = await login(ownerB.email);

            memberA = (
                await ownerAAgent.post('/api/members').send({
                    name: 'AlphaKid',
                    email: `iso_akid_${stamp}@example.com`,
                    password: 'password123',
                })
            ).body;
            memberB = (
                await ownerBAgent.post('/api/members').send({
                    name: 'BetaKid',
                    email: `iso_bkid_${stamp}@example.com`,
                    password: 'password123',
                })
            ).body;
            memberAAgent = await login(memberA.email);
            memberBAgent = await login(memberB.email);

            itemsA = await seedItems(ownerA, markerA);
            itemsMemberA = await seedItems(
                await User.findByPk(memberA.id),
                markerMember
            );
            itemsB = await seedItems(ownerB, markerB);

            tokens = {
                ownerA: await tokenFor(ownerA.id),
                memberA: await tokenFor(memberA.id),
                ownerB: await tokenFor(ownerB.id),
                memberB: await tokenFor(memberB.id),
            };
        });

        afterEach(() => {
            disableHosted();
        });

        // A control for every check below: each account does see its own
        // items, so an empty answer means filtering and not a broken query.
        describe('own items', () => {
            it('are visible over the API', async () => {
                for (const path of singleReads(itemsA)) {
                    const res = await ownerAAgent.get(path);
                    expect([200]).toContain(res.status);
                }
                const search = await ownerAAgent.get(
                    `/api/search?q=${markerA}`
                );
                expect(JSON.stringify(search.body)).toContain(markerA);
                const tasks = await ownerAAgent.get('/api/tasks');
                expect(JSON.stringify(tasks.body)).toContain(markerA);
            });

            it('are visible over MCP', async () => {
                const tasks = await callTool(tokens.ownerA, 'list_tasks');
                expect(tasks.isError).toBe(false);
                expect(tasks.text).toContain(markerA);
                const note = await callTool(tokens.ownerA, 'get_note', {
                    uid: itemsA.note.uid,
                });
                expect(note.text).toContain(markerA);
                const search = await callTool(tokens.ownerA, 'search', {
                    query: markerA,
                });
                expect(search.text).toContain(markerA);
            });
        });

        const attackers = () => [
            ['the other owner', ownerBAgent, tokens.ownerB],
            ["the other account's member", memberBAgent, tokens.memberB],
        ];

        describe('over the REST API', () => {
            it('no single item can be read', async () => {
                for (const [, agent] of attackers()) {
                    for (const path of singleReads(itemsA)) {
                        const res = await agent.get(path);
                        expect({
                            path,
                            refused: [400, 403, 404].includes(res.status),
                            leaks: JSON.stringify(res.body).includes(markerA),
                        }).toEqual({ path, refused: true, leaks: false });
                    }
                }
            });

            it('no list, search or picker shows anything', async () => {
                for (const [, agent] of attackers()) {
                    for (const path of [
                        ...LISTS,
                        `/api/search?q=${markerA}`,
                        `/api/search?q=${markerMember}`,
                        `/api/inbox?q=${markerA}`,
                    ]) {
                        const res = await agent.get(path);
                        const text = JSON.stringify(res.body);
                        expect({ path, leaks: text.includes(markerA) }).toEqual(
                            { path, leaks: false }
                        );
                        expect({
                            path,
                            leaks: text.includes(markerMember),
                        }).toEqual({ path, leaks: false });
                        expect({
                            path,
                            leaks: text.includes(ownerA.email),
                        }).toEqual({ path, leaks: false });
                    }
                }
            });

            it('the Access page shows nothing of the other account', async () => {
                for (const path of [
                    '/api/admin/users',
                    '/api/admin/groups',
                    '/api/admin/roles',
                ]) {
                    const res = await ownerBAgent.get(path);
                    expect(res.status).toBe(200);
                    const text = JSON.stringify(res.body);
                    expect(text).not.toContain(ownerA.email);
                    expect(text).not.toContain(memberA.email);
                }
            });

            it('no item can be changed or deleted', async () => {
                for (const [, agent] of attackers()) {
                    for (const [method, path, body] of singleWrites(itemsA)) {
                        const res = await agent[method](path).send(body || {});
                        expect({ method, path, ok: res.status < 300 }).toEqual({
                            method,
                            path,
                            ok: false,
                        });
                    }
                }
                await expectUntouched(itemsA, markerA);
            });

            it('no member of the account can be changed or removed', async () => {
                for (const [, agent] of attackers()) {
                    const patch = await agent
                        .patch(`/api/members/${memberA.id}`)
                        .send({ name: 'pwned' });
                    const remove = await agent.delete(
                        `/api/members/${memberA.id}`
                    );
                    const link = await agent.post(
                        `/api/members/${memberA.id}/sign-in-link`
                    );
                    expect(patch.status).toBe(404);
                    expect(remove.status).toBe(404);
                    expect(link.status).toBe(404);
                }
                expect((await User.findByPk(memberA.id)).name).toBe('AlphaKid');
            });
        });

        describe('over MCP', () => {
            it('no list or search shows anything', async () => {
                for (const [, , token] of attackers()) {
                    for (const [name, args] of [
                        ...MCP_LISTS,
                        ['search', { query: markerA }],
                        ['search', { query: markerMember }],
                        ['get_task_metrics'],
                    ]) {
                        const result = await callTool(token, name, args);
                        expect({
                            name,
                            leaks:
                                result.text.includes(markerA) ||
                                result.text.includes(markerMember),
                        }).toEqual({ name, leaks: false });
                    }
                }
            });

            it('no single item can be read', async () => {
                for (const [, , token] of attackers()) {
                    for (const [name, args] of mcpSingleCalls(
                        itemsA,
                        markerA
                    )) {
                        const result = await callTool(token, name, args);
                        expect({
                            name,
                            leaks: result.text.includes(markerA),
                        }).toEqual({ name, leaks: false });
                    }
                }
            });

            it('no item can be changed or deleted', async () => {
                for (const [, , token] of attackers()) {
                    for (const [name, args] of mcpWrites(itemsA)) {
                        await callTool(token, name, args);
                    }
                }
                await expectUntouched(itemsA, markerA);
                const task = await Task.findByPk(itemsA.task.id);
                expect(task.status).not.toBe(2);
                expect(
                    await Task.count({ where: { parent_task_id: task.id } })
                ).toBe(0);
                expect(
                    await Task.count({
                        where: { name: 'pwned', user_id: ownerB.id },
                    })
                ).toBe(0);
            });
        });

        describe('inside one account', () => {
            it("an admin does not see a member's private items over the API", async () => {
                for (const path of singleReads(itemsMemberA)) {
                    const res = await ownerAAgent.get(path);
                    expect(JSON.stringify(res.body)).not.toContain(
                        markerMember
                    );
                }
                for (const path of [
                    ...LISTS,
                    `/api/search?q=${markerMember}`,
                ]) {
                    const res = await ownerAAgent.get(path);
                    expect({
                        path,
                        leaks: JSON.stringify(res.body).includes(markerMember),
                    }).toEqual({ path, leaks: false });
                }
            });

            it("an admin does not see a member's private items over MCP", async () => {
                for (const [name, args] of [
                    ...MCP_LISTS,
                    ['search', { query: markerMember }],
                    ...mcpSingleCalls(itemsMemberA, markerMember),
                ]) {
                    const result = await callTool(tokens.ownerA, name, args);
                    expect({
                        name,
                        leaks: result.text.includes(markerMember),
                    }).toEqual({ name, leaks: false });
                }
            });

            it("a member does not see the admin's private items", async () => {
                const search = await memberAAgent.get(
                    `/api/search?q=${markerA}`
                );
                expect(JSON.stringify(search.body)).not.toContain(markerA);
                const mcp = await callTool(tokens.memberA, 'search', {
                    query: markerA,
                });
                expect(mcp.text).not.toContain(markerA);
            });

            it('but the family can find each other to assign to', async () => {
                const people = await memberAAgent.get('/api/people');
                expect(JSON.stringify(people.body)).toContain('Alpha');
            });
        });

        it('leaves the other account untouched as well', async () => {
            await expectUntouched(itemsB, markerB);
        });
    });
});
