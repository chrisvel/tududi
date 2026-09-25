const request = require('supertest');
const app = require('../../app');
const { sequelize, Person } = require('../../models');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');
const peopleService = require('../../modules/people/service');

describe('POST /api/inbox/analyze-text: dates and @people', () => {
    let owner, member, outsider;
    let ownerAgent;
    let contact;

    const login = async (user) => {
        const agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
        return agent;
    };

    const analyze = (body) =>
        ownerAgent.post('/api/inbox/analyze-text').send(body);

    beforeEach(async () => {
        const stamp = Date.now();
        owner = await createTestUser({
            email: `owner_${stamp}@test.com`,
            name: 'Owner',
            timezone: 'UTC',
        });
        member = await createTestUser({
            email: `member_${stamp}@test.com`,
            name: 'Member',
            timezone: 'UTC',
        });
        outsider = await createTestUser({
            email: `outsider_${stamp}@test.com`,
            name: 'Outsider',
            timezone: 'UTC',
        });
        await peopleService.createSelfPerson(owner);
        await peopleService.createSelfPerson(member);
        await peopleService.createSelfPerson(outsider);

        contact = await Person.create({
            user_id: owner.id,
            name: 'Maria Lopez',
        });

        ownerAgent = await login(owner);
        const memberAgent = await login(member);
        const outsiderAgent = await login(outsider);

        // "Team" is shared with member only; "Side" with outsider only, which
        // puts outsider in the owner's workspace but not on "Team".
        const team = await ownerAgent
            .post('/api/project')
            .send({ name: 'Team' });
        const side = await ownerAgent
            .post('/api/project')
            .send({ name: 'Side' });
        await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: team.body.uid,
            target_user_email: member.email,
            access_level: 'rw',
        });
        await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: side.body.uid,
            target_user_email: outsider.email,
            access_level: 'rw',
        });
        await acceptAllInvitations(memberAgent);
        await acceptAllInvitations(outsiderAgent);
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('resolves a contact by first name and strips it from the title', async () => {
        const response = await analyze({ content: 'Call @Maria about rent' });

        expect(response.status).toBe(200);
        expect(response.body.parsed_assignee).toEqual({
            uid: contact.uid,
            name: 'Maria Lopez',
        });
        expect(response.body.cleaned_content).toBe('Call about rent');
        expect(response.body.suggested_type).toBe('task');
    });

    it('resolves a quoted full name', async () => {
        const response = await analyze({ content: 'Call @"maria lopez"' });

        expect(response.body.parsed_assignee.uid).toBe(contact.uid);
    });

    it('leaves an unknown name in the title', async () => {
        const response = await analyze({ content: 'Call @Nobody' });

        expect(response.body.parsed_person).toBe('Nobody');
        expect(response.body.parsed_assignee).toBeNull();
        expect(response.body.cleaned_content).toBe('Call @Nobody');
    });

    it('does not guess between two people with the same first name', async () => {
        await Person.create({ user_id: owner.id, name: 'Maria Chen' });

        const response = await analyze({ content: 'Call @Maria' });

        expect(response.body.parsed_assignee).toBeNull();
    });

    it('resolves a workspace member without a project', async () => {
        const response = await analyze({ content: 'Review @Outsider' });

        expect(response.body.parsed_assignee?.name).toBe('Outsider');
    });

    it('limits @people to the project when a +project is given', async () => {
        const onTeam = await analyze({ content: 'Review @Member +Team' });
        const offTeam = await analyze({ content: 'Review @Outsider +Team' });

        expect(onTeam.body.parsed_assignee?.name).toBe('Member');
        expect(offTeam.body.parsed_assignee).toBeNull();
    });

    it('parses dates against reference_date in the user timezone', async () => {
        const response = await analyze({
            content: 'Call plumber tomorrow',
            reference_date: '2026-01-10T12:00:00Z',
        });

        expect(response.body.parsed_due_date).toBe('2026-01-11');
        expect(response.body.parsed_date_text).toBe('tomorrow');
        expect(response.body.cleaned_content).toBe('Call plumber');
    });

    it('skips dates when parse_dates is false', async () => {
        const response = await analyze({
            content: 'Call plumber tomorrow',
            parse_dates: false,
        });

        expect(response.body.parsed_due_date).toBeNull();
        expect(response.body.cleaned_content).toBe('Call plumber tomorrow');
    });

    it('rejects an invalid reference_date', async () => {
        const response = await analyze({
            content: 'Call tomorrow',
            reference_date: 'not a date',
        });

        expect(response.status).toBe(400);
    });
});
