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
const { User, Person, Task, sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const rolesService = require('../../services/rolesService');

const loginAgent = async (email, password = 'password123') => {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
};

describe('POST /api/members', () => {
    let admin, inviter, plain, guest;
    let adminAgent, inviterAgent, plainAgent, guestAgent;

    const invite = (agent, body) => agent.post('/api/members').send(body);

    beforeEach(async () => {
        sentEmails.length = 0;
        admin = await createTestUser({ email: 'admin@example.com' });
        inviter = await createTestUser({
            email: 'inviter@example.com',
            name: 'Inviter',
        });
        plain = await createTestUser({ email: 'plain@example.com' });
        guest = await createTestUser({ email: 'guest@example.com' });
        await rolesService.setCapabilities(inviter.id, {
            invite_members: true,
        });
        await rolesService.setRole(guest.id, 'guest');
        await rolesService.setCapabilities(guest.id, { invite_members: true });

        adminAgent = await loginAgent(admin.email);
        inviterAgent = await loginAgent(inviter.email);
        plainAgent = await loginAgent(plain.email);
        guestAgent = await loginAgent(guest.email);
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('who may use it', () => {
        it('requires a session', async () => {
            const res = await request(app)
                .post('/api/members')
                .send({ name: 'Emma' });

            expect(res.status).toBe(401);
        });

        it('is refused for a user who was not given the permission', async () => {
            const res = await invite(plainAgent, { name: 'Emma' });

            expect(res.status).toBe(403);
            expect(await User.count({ where: { name: 'Emma' } })).toBe(0);
        });

        it('is allowed for a guest who was given the permission', async () => {
            const res = await invite(guestAgent, { name: 'Emma' });

            expect(res.status).toBe(201);
        });

        it('is allowed for a user who was given the permission', async () => {
            const res = await invite(inviterAgent, { name: 'Emma' });

            expect(res.status).toBe(201);
        });

        it('is allowed for an admin', async () => {
            const res = await invite(adminAgent, { name: 'Emma' });

            expect(res.status).toBe(201);
        });
    });

    describe('adding a member', () => {
        it('invites someone by email when there is no password', async () => {
            const res = await invite(inviterAgent, {
                email: 'wife@example.com',
                name: 'Wife',
            });

            expect(res.status).toBe(201);
            expect(res.body.invited).toBe(true);
            expect(res.body.email_sent).toBe(true);
            expect(res.body.account_status).toBe('invited');
            expect(res.body.role).toBe('user');
            expect(sentEmails).toHaveLength(1);
            expect(sentEmails[0].to).toBe('wife@example.com');
        });

        it('signs someone up when there is a password', async () => {
            const res = await invite(inviterAgent, {
                email: 'wife@example.com',
                password: 'Str0ng-passw0rd!',
            });

            expect(res.status).toBe(201);
            expect(res.body.account_status).toBe('active');
            expect(res.body.invited).toBe(false);
            expect(sentEmails).toHaveLength(0);

            const login = await request(app).post('/api/login').send({
                email: 'wife@example.com',
                password: 'Str0ng-passw0rd!',
            });
            expect(login.status).toBe(200);
        });

        it('adds a member who cannot sign in yet when there is no email', async () => {
            const res = await invite(inviterAgent, { name: 'Emma' });

            expect(res.status).toBe(201);
            expect(res.body.email).toBeNull();
            expect(res.body.account_status).toBe('no_sign_in');
            expect(sentEmails).toHaveLength(0);
        });

        it('gives back the person that stands for the new member', async () => {
            const res = await invite(inviterAgent, { name: 'Emma' });

            const person = await Person.findOne({
                where: { user_id: res.body.id, linked_user_id: res.body.id },
            });
            expect(person).toBeTruthy();
            expect(res.body.person_uid).toBe(person.uid);
            expect(person.name).toBe('Emma');
        });

        it('needs a name when there is no email', async () => {
            const res = await invite(inviterAgent, {});

            expect(res.status).toBe(400);
        });

        it('refuses a password without an email', async () => {
            const res = await invite(inviterAgent, {
                name: 'Emma',
                password: 'Str0ng-passw0rd!',
            });

            expect(res.status).toBe(400);
            expect(await User.count({ where: { name: 'Emma' } })).toBe(0);
        });

        it('refuses an email that is already in use', async () => {
            const res = await invite(inviterAgent, { email: admin.email });

            expect(res.status).toBe(409);
        });

        it('records who created the account', async () => {
            const res = await invite(inviterAgent, { name: 'Emma' });

            const member = await User.findByPk(res.body.id);
            expect(member.created_by_user_id).toBe(inviter.id);
        });

        it('records the admin as the creator too', async () => {
            const res = await adminAgent
                .post('/api/admin/users')
                .send({ name: 'Emma' });

            const member = await User.findByPk(res.body.id);
            expect(member.created_by_user_id).toBe(admin.id);
        });
    });

    describe('roles and permissions of the new member', () => {
        it('lets a user with the permission add a user or a guest', async () => {
            const asUser = await invite(inviterAgent, {
                name: 'A',
                role: 'user',
            });
            const asGuest = await invite(inviterAgent, {
                name: 'B',
                role: 'guest',
            });

            expect(asUser.body.role).toBe('user');
            expect(asGuest.body.role).toBe('guest');
        });

        it('does not let a user who is not an admin create an admin', async () => {
            const res = await invite(inviterAgent, {
                name: 'Emma',
                role: 'admin',
            });

            expect(res.status).toBe(403);
            expect(await User.count({ where: { name: 'Emma' } })).toBe(0);
        });

        it('does not let a user who is not an admin set permissions', async () => {
            const res = await invite(inviterAgent, {
                name: 'Emma',
                capabilities: { invite_members: true },
            });

            expect(res.status).toBe(403);
            expect(await User.count({ where: { name: 'Emma' } })).toBe(0);
        });

        it('lets an admin set the role and permissions', async () => {
            const res = await invite(adminAgent, {
                name: 'Second',
                role: 'admin',
            });
            expect(res.status).toBe(201);
            expect(res.body.role).toBe('admin');

            const res2 = await invite(adminAgent, {
                name: 'Helper',
                capabilities: { invite_members: true },
            });
            expect(res2.status).toBe(201);
            expect(res2.body.capabilities.invite_members).toBe(true);
        });

        it('rejects a role that does not exist', async () => {
            const res = await invite(adminAgent, {
                name: 'Emma',
                role: 'owner',
            });

            expect(res.status).toBe(400);
        });
    });

    describe("the new member is in the creator's workspace", () => {
        it('is offered when the creator assigns a task', async () => {
            await invite(inviterAgent, { name: 'Emma' });

            const res = await inviterAgent.get('/api/people/assignable');

            expect(res.body.people.map((p) => p.name)).toContain('Emma');
        });

        it('sees the creator in return', async () => {
            await invite(inviterAgent, {
                email: 'wife@example.com',
                password: 'Str0ng-passw0rd!',
                name: 'Wife',
            });
            const wifeAgent = await loginAgent(
                'wife@example.com',
                'Str0ng-passw0rd!'
            );

            const res = await wifeAgent.get('/api/people/assignable');

            expect(res.body.people.map((p) => p.name)).toContain('Inviter');
        });

        it('turns the Everyone link on for both', async () => {
            await invite(inviterAgent, {
                email: 'wife@example.com',
                password: 'Str0ng-passw0rd!',
            });
            const wifeAgent = await loginAgent(
                'wife@example.com',
                'Str0ng-passw0rd!'
            );

            const mine = await inviterAgent.get('/api/current_user');
            const theirs = await wifeAgent.get('/api/current_user');

            expect(mine.body.user.has_collaborators).toBe(true);
            expect(theirs.body.user.has_collaborators).toBe(true);
        });

        it("does not put two accounts made by the same person in each other's workspace", async () => {
            await invite(inviterAgent, {
                email: 'one@example.com',
                password: 'Str0ng-passw0rd!',
                name: 'One',
            });
            await invite(inviterAgent, { name: 'Two' });
            const oneAgent = await loginAgent(
                'one@example.com',
                'Str0ng-passw0rd!'
            );

            const res = await oneAgent.get('/api/people/assignable');

            expect(res.body.people.map((p) => p.name)).not.toContain('Two');
        });
    });

    describe('turning a contact into a member', () => {
        let card, task;

        beforeEach(async () => {
            card = await Person.create({
                user_id: inviter.id,
                name: 'Emma',
                relationship_type: 'family',
                phone: '555-0100',
                notes: 'my private note',
                color: '#ff0000',
            });
            task = await Task.create({
                user_id: inviter.id,
                name: 'Tidy the room',
                assigned_to: card.uid,
            });
        });

        const convert = (body = {}) =>
            invite(inviterAgent, { person_uid: card.uid, ...body });

        it('keeps the same person, now owned by the new account', async () => {
            const res = await convert({
                email: 'emma@example.com',
                password: 'Str0ng-passw0rd!',
            });

            expect(res.status).toBe(201);
            expect(res.body.person_uid).toBe(card.uid);
            const person = await Person.findOne({ where: { uid: card.uid } });
            expect(person.user_id).toBe(res.body.id);
            expect(person.linked_user_id).toBe(res.body.id);
            expect(person.name).toBe('Emma');
            expect(person.email).toBe('emma@example.com');
        });

        it('leaves the new account with one person, not two', async () => {
            const res = await convert({ email: 'emma@example.com' });

            expect(
                await Person.count({ where: { user_id: res.body.id } })
            ).toBe(1);
        });

        it('takes the account name from the contact', async () => {
            const res = await convert();

            expect(res.status).toBe(201);
            const member = await User.findByPk(res.body.id);
            expect(member.name).toBe('Emma');
        });

        it('splits a two part name into first name and surname', async () => {
            await card.update({ name: 'Emma Veleris' });

            const res = await convert();

            const member = await User.findByPk(res.body.id);
            expect(member.name).toBe('Emma');
            expect(member.surname).toBe('Veleris');
        });

        it('keeps the details of the contact but not the private notes', async () => {
            await convert();

            const person = await Person.findOne({ where: { uid: card.uid } });
            expect(person.phone).toBe('555-0100');
            expect(person.color).toBe('#ff0000');
            expect(person.relationship_type).toBe('family');
            expect(person.notes).toBeNull();
        });

        it('keeps every task that was assigned to the contact', async () => {
            const res = await convert({
                email: 'emma@example.com',
                password: 'Str0ng-passw0rd!',
            });

            await task.reload();
            expect(task.assigned_to).toBe(card.uid);

            const emma = await loginAgent(
                'emma@example.com',
                'Str0ng-passw0rd!'
            );
            const opened = await emma.get(`/api/task/${task.uid}`);
            expect(opened.status).toBe(200);
            expect(res.body.person_uid).toBe(card.uid);
        });

        it("lists the person once in the creator's assignee list, under the same uid", async () => {
            await convert();

            const res = await inviterAgent.get('/api/people/assignable');

            const matches = res.body.people.filter((p) => p.name === 'Emma');
            expect(matches).toHaveLength(1);
            expect(matches[0].uid).toBe(card.uid);
        });

        it('works for a member without an email', async () => {
            const res = await convert();

            expect(res.body.account_status).toBe('no_sign_in');
            expect(res.body.email).toBeNull();
        });

        it('sends no email for a contact turned into a member without an email', async () => {
            await convert();

            expect(sentEmails).toHaveLength(0);
        });

        it('cannot use a contact that belongs to someone else, even for an admin', async () => {
            const res = await invite(adminAgent, { person_uid: card.uid });

            expect(res.status).toBe(404);
            const untouched = await Person.findOne({
                where: { uid: card.uid },
            });
            expect(untouched.user_id).toBe(inviter.id);
            expect(untouched.notes).toBe('my private note');
        });

        it('cannot use a contact that already has an account', async () => {
            const first = await convert();
            const again = await invite(adminAgent, {
                person_uid: first.body.person_uid,
            });

            expect(again.status).toBeGreaterThanOrEqual(400);
            expect(again.status).toBeLessThan(500);
        });

        it('cannot use the person of an account', async () => {
            const own = await Person.findOne({
                where: { user_id: inviter.id, linked_user_id: inviter.id },
            });

            const res = await invite(inviterAgent, { person_uid: own.uid });

            expect(res.status).toBe(409);
        });

        it('answers not found for a contact that does not exist, and creates nothing', async () => {
            const before = await User.count();

            const res = await invite(inviterAgent, {
                person_uid: 'nope12345678901',
            });

            expect(res.status).toBe(404);
            expect(await User.count()).toBe(before);
        });

        it('creates nothing when the email is already taken', async () => {
            const before = await User.count();

            const res = await convert({ email: admin.email });

            expect(res.status).toBe(409);
            expect(await User.count()).toBe(before);
            const untouched = await Person.findOne({
                where: { uid: card.uid },
            });
            expect(untouched.user_id).toBe(inviter.id);
            expect(untouched.notes).toBe('my private note');
        });

        it('is the same when an admin uses the admin page', async () => {
            const adminCard = await Person.create({
                user_id: admin.id,
                name: 'Frank',
                notes: 'admin note',
            });

            const res = await adminAgent.post('/api/admin/users').send({
                email: 'frank@example.com',
                password: 'Str0ng-passw0rd!',
                person_uid: adminCard.uid,
            });

            expect(res.status).toBe(201);
            const person = await Person.findOne({
                where: { uid: adminCard.uid },
            });
            expect(person.user_id).toBe(res.body.id);
            expect(person.notes).toBeNull();
            expect(
                await Person.count({ where: { user_id: res.body.id } })
            ).toBe(1);
        });

        it('still accepts the old admin field name', async () => {
            const adminCard = await Person.create({
                user_id: admin.id,
                name: 'Gina',
            });

            const res = await adminAgent.post('/api/admin/users').send({
                name: 'Gina',
                linked_person_uid: adminCard.uid,
            });

            expect(res.status).toBe(201);
            expect(res.body.person_uid).toBe(adminCard.uid);
            expect(
                await Person.count({ where: { user_id: res.body.id } })
            ).toBe(1);
        });
    });
});
