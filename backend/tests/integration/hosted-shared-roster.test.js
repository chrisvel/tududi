const request = require('supertest');
const app = require('../../app');
const { getConfig } = require('../../config/config');
const plans = require('../../config/plans');
const entitlements = require('../../services/entitlementsService');
const accountsService = require('../../services/accountsService');
const peopleService = require('../../modules/people/service');
const {
    Area,
    Project,
    Role,
    User,
    UserGroup,
    UserGroupMember,
} = require('../../models');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');

// On a hosted account a member who is not an admin of it sees, on Everyone,
// People and the share picker, only themselves and the people they share a
// project or area with. Account admins and the superadmin see the whole
// account, and a self-hosted instance is left as it was (#2018).

const config = getConfig();

const setHosted = (enabled) => {
    config.hosted.enabled = enabled;
    plans._resetCache();
    entitlements.invalidate();
};

const login = async (user) => {
    const agent = request.agent(app);
    const res = await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    if (res.status !== 200) {
        throw new Error(`could not sign in ${user.email}: ${res.status}`);
    }
    return agent;
};

const memberIdsOnEveryone = async (agent) => {
    const res = await agent.get('/api/everyone');
    expect(res.status).toBe(200);
    return res.body.columns
        .map((c) => c.person.linked_user_id)
        .filter(Boolean)
        .sort((a, b) => a - b);
};

const memberIdsInPeople = async (agent) => {
    const res = await agent.get('/api/people');
    expect(res.status).toBe(200);
    return res.body.people
        .filter((p) => p.kind === 'member')
        .map((p) => p.linked_user_id)
        .sort((a, b) => a - b);
};

const candidateIds = async (agent) => {
    const res = await agent.get('/api/shares/candidates');
    expect(res.status).toBe(200);
    return res.body.users.map((u) => u.id).sort((a, b) => a - b);
};

const ids = (...users) => users.map((u) => u.id).sort((a, b) => a - b);

const makeUser = async (stamp, name, extra = {}) => {
    const user = await createTestUser({
        email: `${name}_${stamp}@example.com`,
        name,
        ...extra,
    });
    await peopleService.createSelfPerson(user);
    return user;
};

const share = async (agent, body) => {
    const res = await agent
        .post('/api/shares')
        .send({ access_level: 'rw', ...body });
    if (res.status !== 204) {
        throw new Error(`could not share: ${res.status}`);
    }
};

const setRole = async (user, role) => {
    const [row] = await Role.findOrCreate({
        where: { user_id: user.id },
        defaults: { user_id: user.id, role, is_admin: false },
    });
    await row.update({ role, is_admin: false });
};

describe('Roster of a hosted account (#2018)', () => {
    let stamp, owner, memberA, memberB, memberC, memberD;
    let ownerAgent, aAgent, bAgent, cAgent;

    beforeEach(async () => {
        setHosted(true);
        stamp = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;

        // Sequential: the first user created becomes the superadmin.
        const superadmin = await makeUser(stamp, 'super');
        owner = await makeUser(stamp, 'owner');
        await Role.update({ is_admin: false }, { where: {} });
        await Role.update(
            { is_admin: true, role: 'admin' },
            { where: { user_id: superadmin.id } }
        );
        const accountId = await accountsService.ensureAccountId(owner.id);

        const members = [];
        for (const name of ['amy', 'ben', 'cleo', 'dan']) {
            const member = await makeUser(stamp, name, {
                created_by_user_id: owner.id,
            });
            await User.update(
                { account_id: accountId },
                { where: { id: member.id }, hooks: false }
            );
            await setRole(member, 'user');
            members.push(member);
        }
        [memberA, memberB, memberC, memberD] = members;
        await setRole(owner, 'account_admin');

        ownerAgent = await login(owner);
        aAgent = await login(memberA);
        bAgent = await login(memberB);
        cAgent = await login(memberC);
        const dAgent = await login(memberD);

        // The owner shares one project with C and D only.
        const project = await Project.create({
            name: 'Outside work',
            user_id: owner.id,
        });
        for (const member of [memberC, memberD]) {
            await share(ownerAgent, {
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: member.email,
            });
        }
        await acceptAllInvitations(cAgent);
        await acceptAllInvitations(dAgent);

        // A shares an area with B.
        const area = await Area.create({ name: 'Home', user_id: memberA.id });
        await share(aAgent, {
            resource_type: 'area',
            resource_uid: area.uid,
            target_user_email: memberB.email,
        });
        await acceptAllInvitations(bAgent);

        // The owner shares another project with a group holding A and D.
        const group = await UserGroup.create({
            name: 'Crew',
            account_id: accountId,
        });
        for (const member of [memberA, memberD]) {
            await UserGroupMember.create({
                group_id: group.id,
                user_id: member.id,
            });
        }
        const groupProject = await Project.create({
            name: 'Crew work',
            user_id: owner.id,
        });
        await share(ownerAgent, {
            resource_type: 'project',
            resource_uid: groupProject.uid,
            target_group_uid: group.uid,
        });
        await acceptAllInvitations(aAgent);
        await acceptAllInvitations(dAgent);
    });

    afterEach(() => {
        setHosted(false);
    });

    it('shows an outside collaborator only the people on their project', async () => {
        const expected = ids(memberC, owner, memberD);
        expect(await memberIdsOnEveryone(cAgent)).toEqual(expected);
        expect(await memberIdsInPeople(cAgent)).toEqual(expected);
        expect(await candidateIds(cAgent)).toEqual(ids(owner, memberD));
    });

    it('counts an area shared between two members, in either direction', async () => {
        expect(await memberIdsInPeople(bAgent)).toEqual(ids(memberA, memberB));
        expect(await memberIdsOnEveryone(bAgent)).toEqual(
            ids(memberA, memberB)
        );
        expect(await memberIdsInPeople(aAgent)).toContain(memberB.id);
    });

    it('counts access that comes through a group', async () => {
        expect(await memberIdsInPeople(aAgent)).toEqual(
            ids(owner, memberA, memberB, memberD)
        );
        expect(await memberIdsOnEveryone(aAgent)).not.toContain(memberC.id);
    });

    it('shows an account admin the whole account', async () => {
        const everyone = ids(owner, memberA, memberB, memberC, memberD);
        expect(await memberIdsOnEveryone(ownerAgent)).toEqual(everyone);
        expect(await memberIdsInPeople(ownerAgent)).toEqual(everyone);
        expect(await candidateIds(ownerAgent)).toEqual(
            ids(memberA, memberB, memberC, memberD)
        );
    });

    it('keeps the contacts a member created', async () => {
        const res = await cAgent.post('/api/people').send({ name: 'Grandma' });
        expect(res.status).toBe(201);

        const people = (await cAgent.get('/api/people')).body.people;
        expect(people.map((p) => p.name)).toContain('Grandma');
    });

    it('still lets a project collaborator assign a task to the project owner', async () => {
        const project = await Project.findOne({
            where: { name: 'Outside work', user_id: owner.id },
        });
        const ownerSelf = await peopleService.createSelfPerson(owner);
        const res = await cAgent.post('/api/task').send({
            name: 'Ask the owner',
            project_id: project.id,
            assigned_to: ownerSelf.uid,
        });
        expect(res.status).toBe(201);
    });
});

describe('Roster on a self-hosted instance (#2018)', () => {
    it('still shows every member of the workspace', async () => {
        setHosted(false);
        const stamp = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
        const owner = await makeUser(stamp, 'owner');
        const first = await makeUser(stamp, 'first', {
            created_by_user_id: owner.id,
        });
        const second = await makeUser(stamp, 'second', {
            created_by_user_id: owner.id,
        });
        await Role.update({ is_admin: false }, { where: {} });

        const agent = await login(first);
        expect(await memberIdsInPeople(agent)).toEqual(ids(owner, first));
        expect(await memberIdsOnEveryone(agent)).toEqual(ids(owner, first));

        const ownerAgent = await login(owner);
        expect(await memberIdsInPeople(ownerAgent)).toEqual(
            ids(owner, first, second)
        );
    });
});
