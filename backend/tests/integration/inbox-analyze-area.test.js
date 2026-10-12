const request = require('supertest');
const app = require('../../app');
const { sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('POST /api/inbox/analyze-text: ~area', () => {
    let ownerAgent;
    let work;

    const login = async (user) => {
        const agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
        return agent;
    };

    const analyze = (content) =>
        ownerAgent.post('/api/inbox/analyze-text').send({ content });

    beforeEach(async () => {
        const stamp = Date.now();
        const owner = await createTestUser({
            email: `owner_${stamp}@test.com`,
            name: 'Owner',
            timezone: 'UTC',
        });
        const other = await createTestUser({
            email: `other_${stamp}@test.com`,
            name: 'Other',
            timezone: 'UTC',
        });
        ownerAgent = await login(owner);
        const otherAgent = await login(other);

        work = (await ownerAgent.post('/api/areas').send({ name: 'Work' }))
            .body;
        await ownerAgent.post('/api/areas').send({ name: 'Home Office' });
        await otherAgent.post('/api/areas').send({ name: 'Secret' });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('resolves an area by name and strips it from the title', async () => {
        const response = await analyze('Prepare offsite ~work');

        expect(response.status).toBe(200);
        expect(response.body.parsed_area).toEqual({
            uid: work.uid,
            name: 'work',
        });
        expect(response.body.cleaned_content).toBe('Prepare offsite');
    });

    it('resolves a quoted name with spaces', async () => {
        const response = await analyze('Fix desk lamp ~"home office"');

        expect(response.body.parsed_area).not.toBeNull();
        expect(response.body.cleaned_content).toBe('Fix desk lamp');
    });

    it('leaves a ~word that is no area in the title', async () => {
        const response = await analyze('Walk about ~5 km');

        expect(response.body.parsed_area).toBeNull();
        expect(response.body.cleaned_content).toBe('Walk about ~5 km');
    });

    it('skips an unknown ~word and uses the next one that is an area', async () => {
        const response = await analyze('Plan ~later ~Work');

        expect(response.body.parsed_area.uid).toBe(work.uid);
        expect(response.body.cleaned_content).toBe('Plan ~later');
    });

    it("does not match another user's area", async () => {
        const response = await analyze('Spy ~Secret');

        expect(response.body.parsed_area).toBeNull();
        expect(response.body.cleaned_content).toBe('Spy ~Secret');
    });

    it('works next to a project, tag and date', async () => {
        const response = await analyze('Ship it ~Work +Launch #big tomorrow');

        expect(response.body.parsed_area.uid).toBe(work.uid);
        expect(response.body.parsed_projects).toEqual(['Launch']);
        expect(response.body.parsed_tags).toEqual(['big']);
        expect(response.body.parsed_due_date).not.toBeNull();
        expect(response.body.cleaned_content).toBe('Ship it');
    });
});
