const mockCreate = jest.fn();

jest.mock('openai', () => jest.fn());

const OpenAI = require('openai');
const request = require('supertest');
const app = require('../../app');
const {
    InboxItem,
    InboxItemAttachment,
    Project,
    User,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const reply = (content) => ({
    choices: [{ message: { content: JSON.stringify(content) } }],
    model: 'test-model',
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
});

const why = (extra = {}) => ({
    title: '',
    project: '',
    tags: '',
    due_date: '',
    ...extra,
});

describe('Inbox AI suggestions', () => {
    let user, agent;

    beforeEach(async () => {
        process.env.LLM_API_KEY = 'test-key';
        mockCreate.mockReset();
        OpenAI.mockImplementation(() => ({
            chat: { completions: { create: (...args) => mockCreate(...args) } },
        }));

        user = await createTestUser({
            email: `inbox-ai-${Date.now()}@example.com`,
            timezone: 'UTC',
        });
        await User.update(
            { features: { ai_assistant_enabled: true } },
            { where: { id: user.id } }
        );
        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
    });

    afterEach(() => {
        delete process.env.LLM_API_KEY;
    });

    const capture = (content, owner = user) =>
        InboxItem.create({ content, source: 'web', user_id: owner.id });

    it('refuses when no AI provider is set up', async () => {
        const openaiKey = process.env.OPENAI_API_KEY;
        delete process.env.LLM_API_KEY;
        delete process.env.OPENAI_API_KEY;
        const item = await capture('Call the plumber');

        const res = await agent
            .post('/api/inbox/ai/suggest')
            .send({ item_uids: [item.uid] });
        if (openaiKey !== undefined) process.env.OPENAI_API_KEY = openaiKey;

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Profile -> AI Assistant/);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('works with a provider even when the AI assistant switch is off', async () => {
        await User.update(
            { features: { ai_assistant_enabled: false } },
            { where: { id: user.id } }
        );
        const item = await capture('Call the plumber');
        mockCreate.mockResolvedValue(reply({ suggestions: [] }));

        const res = await agent
            .post('/api/inbox/ai/suggest')
            .send({ item_uids: [item.uid] });

        expect(res.status).toBe(200);
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('rejects a body without a list of uids', async () => {
        const res = await agent
            .post('/api/inbox/ai/suggest')
            .send({ item_uids: 'abc' });

        expect(res.status).toBe(400);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    const option = (extra = {}) => ({
        kind: 'task',
        confidence: 'sure',
        title: 'x',
        project_name: null,
        tags: [],
        due_date: null,
        reason: '',
        analysis: '',
        why: why(),
        ...extra,
    });

    it('returns sanitised options with their explanation', async () => {
        const project = await Project.create({
            name: 'Home renovation',
            user_id: user.id,
        });
        const item = await capture('call plumber about the kitchen sink');
        mockCreate.mockResolvedValue(
            reply({
                suggestions: [
                    {
                        item_uid: item.uid,
                        options: [
                            option({
                                title: 'Call the plumber about the kitchen sink',
                                project_name: 'home renovation',
                                tags: ['#home'],
                                reason: 'One concrete call to make',
                                analysis: 'A single phone call, so a task.',
                                why: why({
                                    project:
                                        'Kitchen sink, matches Home renovation',
                                    tags: 'House related',
                                }),
                            }),
                            option({
                                kind: 'note',
                                confidence: 'guess',
                                title: 'Plumber contact',
                            }),
                        ],
                    },
                    { item_uid: 'made-up', options: [option()] },
                ],
            })
        );

        const res = await agent
            .post('/api/inbox/ai/suggest')
            .send({ item_uids: [item.uid] });

        expect(res.status).toBe(200);
        expect(res.body.suggestions).toHaveLength(1);
        const [best, alternative] = res.body.suggestions[0].options;
        expect(best).toEqual({
            kind: 'task',
            confidence: 'sure',
            title: 'Call the plumber about the kitchen sink',
            project_uid: project.uid,
            project_name: 'Home renovation',
            tags: ['home'],
            due_date: null,
            reason: 'One concrete call to make',
            analysis: 'A single phone call, so a task.',
            why: why({
                project: 'Kitchen sink, matches Home renovation',
                tags: 'House related',
            }),
        });
        expect(alternative).toMatchObject({
            kind: 'note',
            confidence: 'guess',
            title: 'Plumber contact',
        });
        const prompt = mockCreate.mock.calls[0][0].messages[1].content;
        expect(prompt).toContain('Home renovation');
        expect(prompt).toContain('call plumber about the kitchen sink');
    });

    it('shows the model the files of an item without text', async () => {
        const item = await capture('');
        await InboxItemAttachment.create({
            inbox_item_id: item.id,
            user_id: user.id,
            original_filename: 'IMG_2041.jpg',
            stored_filename: 'inbox-x.jpg',
            file_size: 10,
            mime_type: 'image/jpeg',
            file_path: 'inbox/inbox-x.jpg',
        });
        mockCreate.mockResolvedValue(reply({ suggestions: [] }));

        await agent
            .post('/api/inbox/ai/suggest')
            .send({ item_uids: [item.uid] });

        const prompt = mockCreate.mock.calls[0][0].messages[1].content;
        expect(prompt).toContain('"name":"IMG_2041.jpg"');
        expect(prompt).toContain('"type":"image/jpeg"');
    });

    it("never sends or answers for another user's items", async () => {
        const other = await createTestUser({
            email: `inbox-ai-other-${Date.now()}@example.com`,
        });
        const theirs = await capture('Their secret plan', other);

        const res = await agent
            .post('/api/inbox/ai/suggest')
            .send({ item_uids: [theirs.uid] });

        expect(res.status).toBe(200);
        expect(res.body.suggestions).toEqual([]);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('gives the model more room the more items it sorts', async () => {
        const items = await Promise.all(
            ['One', 'Two', 'Three'].map((content) => capture(content))
        );
        mockCreate.mockResolvedValue(reply({ suggestions: [] }));

        await agent
            .post('/api/inbox/ai/suggest')
            .send({ item_uids: items.map((item) => item.uid) });

        expect(mockCreate.mock.calls[0][0].max_tokens).toBe(7900);
    });

    it('reports an answer cut off before the JSON as an error', async () => {
        const item = await capture('Plan the trip');
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: '' }, finish_reason: 'length' }],
            model: 'test-model',
            usage: { total_tokens: 4000 },
        });

        const res = await agent
            .post('/api/inbox/ai/suggest')
            .send({ item_uids: [item.uid] });

        expect(res.status).toBe(502);
        expect(res.body.error).toMatch(/ran out of room/);
    });

    const noteAnswer = (item, title) =>
        reply({
            suggestions: [
                {
                    item_uid: item.uid,
                    options: [option({ kind: 'note', title })],
                },
            ],
        });
    const suggest = (item, extra = {}) =>
        agent
            .post('/api/inbox/ai/suggest')
            .send({ item_uids: [item.uid], ...extra });

    it('saves suggestions, shows them with the inbox and reuses them', async () => {
        const item = await capture('Read the article on habits');
        mockCreate.mockResolvedValueOnce(noteAnswer(item, 'Article on habits'));

        const first = await suggest(item);
        const second = await suggest(item);

        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(second.body).toEqual(first.body);
        expect(first.body.suggestions[0].generated_at).toEqual(
            expect.any(String)
        );

        const list = await agent.get('/api/inbox');
        const listed = (list.body.items || list.body).find(
            (i) => i.uid === item.uid
        );
        expect(listed.ai_suggestion.options[0].title).toBe('Article on habits');
        expect(listed).not.toHaveProperty('ai_suggestion_key');
    });

    it('asks again for an item whose text changed', async () => {
        const item = await capture('Read the article on habits');
        mockCreate.mockResolvedValueOnce(noteAnswer(item, 'Article on habits'));
        await suggest(item);

        await item.update({ content: 'Read the article on sleep' });
        mockCreate.mockResolvedValueOnce(noteAnswer(item, 'Article on sleep'));
        const res = await suggest(item);

        expect(mockCreate).toHaveBeenCalledTimes(2);
        expect(res.body.suggestions[0].options[0].title).toBe(
            'Article on sleep'
        );
    });

    it('regenerates saved suggestions on request', async () => {
        const item = await capture('Read the article on habits');
        mockCreate.mockResolvedValueOnce(noteAnswer(item, 'Article on habits'));
        await suggest(item);

        mockCreate.mockResolvedValueOnce(noteAnswer(item, 'Habits reading'));
        const res = await suggest(item, { regenerate: true });

        expect(mockCreate).toHaveBeenCalledTimes(2);
        expect(res.body.suggestions[0].options[0].title).toBe('Habits reading');
        await item.reload();
        expect(item.ai_suggestion.options[0].title).toBe('Habits reading');
    });

    it('forgets a dismissed suggestion', async () => {
        const item = await capture('Read the article on habits');
        mockCreate.mockResolvedValueOnce(noteAnswer(item, 'Article on habits'));
        await suggest(item);

        const res = await agent.delete(`/api/inbox/${item.uid}/ai-suggestion`);

        expect(res.status).toBe(200);
        await item.reload();
        expect(item.ai_suggestion).toBeNull();
        expect(item.ai_suggestion_key).toBeNull();
    });

    it('clears the suggestion when the item is edited', async () => {
        const item = await capture('Read the article on habits');
        mockCreate.mockResolvedValueOnce(noteAnswer(item, 'Article on habits'));
        await suggest(item);

        const res = await agent
            .patch(`/api/inbox/${item.uid}`)
            .send({ content: 'Call mum' });

        expect(res.status).toBe(200);
        expect(res.body.ai_suggestion).toBeNull();
    });

    it("cannot dismiss another user's suggestion", async () => {
        const other = await createTestUser({
            email: `inbox-ai-dismiss-${Date.now()}@example.com`,
        });
        const theirs = await capture('Their item', other);
        await theirs.update({ ai_suggestion: { options: [] } });

        const res = await agent.delete(
            `/api/inbox/${theirs.uid}/ai-suggestion`
        );

        expect(res.status).toBe(404);
        await theirs.reload();
        expect(theirs.ai_suggestion).toEqual({ options: [] });
    });
});
