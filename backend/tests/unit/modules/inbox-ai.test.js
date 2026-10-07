const { sanitizeSuggestions } = require('../../../modules/inbox/ai');

const item = (uid, extra = {}) => ({
    uid,
    content: uid,
    created_at: new Date('2026-10-01T09:00:00Z'),
    ...extra,
});
const projects = [{ uid: 'p-home', name: 'Home renovation' }];

const emptyWhy = { title: '', project: '', tags: '', due_date: '' };

const option = (extra = {}) => ({
    kind: 'task',
    confidence: 'sure',
    title: 'Call the plumber',
    project_name: null,
    tags: [],
    due_date: null,
    reason: 'One concrete call',
    analysis: 'A single phone call, so a task.',
    why: { ...emptyWhy, title: 'Starts with the action' },
    ...extra,
});

const run = (options, items = [item('a')], uid = 'a') =>
    sanitizeSuggestions({
        proposed: [{ item_uid: uid, options }],
        items,
        projects,
        timezone: 'UTC',
    });

const first = (extra) => run([option(extra)])[0]?.options[0];

describe('sanitizeSuggestions', () => {
    it('drops unknown items and duplicate answers for one item', () => {
        const result = sanitizeSuggestions({
            proposed: [
                { item_uid: 'ghost', options: [option()] },
                { item_uid: 'a', options: [option()] },
                { item_uid: 'a', options: [option({ title: 'Second' })] },
            ],
            items: [item('a')],
            projects,
            timezone: 'UTC',
        });

        expect(result).toHaveLength(1);
        expect(result[0].options[0].title).toBe('Call the plumber');
    });

    it('keeps up to three distinct options, best first', () => {
        const [result] = run([
            option(),
            option({ kind: 'event' }),
            option({ title: ' call the PLUMBER ' }),
            option({ kind: 'note', title: 'Plumber number' }),
            option({ kind: 'project', title: 'Fix the kitchen' }),
            option({ kind: 'note', title: 'One too many' }),
        ]);

        expect(result.options.map((o) => `${o.kind}:${o.title}`)).toEqual([
            'task:Call the plumber',
            'note:Plumber number',
            'project:Fix the kitchen',
        ]);
    });

    it('leaves out an item with no usable option', () => {
        expect(run([option({ title: '  ' }), option({ kind: 'x' })])).toEqual(
            []
        );
    });

    it('marks an option as a guess unless the model is sure', () => {
        expect(first({ confidence: 'sure' }).confidence).toBe('sure');
        expect(first({ confidence: 'guess' }).confidence).toBe('guess');
        expect(first({ confidence: 'very' }).confidence).toBe('guess');
    });

    it('maps a project name to a real project, case-insensitively', () => {
        const result = first({
            project_name: ' home RENOVATION ',
            why: { ...emptyWhy, project: 'Mentions the kitchen' },
        });

        expect(result.project_uid).toBe('p-home');
        expect(result.project_name).toBe('Home renovation');
        expect(result.why.project).toBe('Mentions the kitchen');
    });

    it('drops an invented project together with its explanation', () => {
        const result = first({
            project_name: 'Garden',
            why: { ...emptyWhy, project: 'Sounds like garden work' },
        });

        expect(result.project_uid).toBeNull();
        expect(result.why.project).toBe('');
    });

    it('cleans, dedupes and caps tags', () => {
        expect(
            first({ tags: ['#home', 'Home', '', 'a', 'b', 'c', 'd', 'e', 42] })
                .tags
        ).toEqual(['home', 'a', 'b', 'c', 'd']);
    });

    it('keeps a due date only for a valid day on or after capture', () => {
        const due = (value) => first({ due_date: value }).due_date;

        expect(due('2026-10-03')).toBe('2026-10-03');
        expect(due('2026-10-01')).toBe('2026-10-01');
        expect(due('2026-09-30')).toBeNull();
        expect(due('next friday')).toBeNull();
        expect(due('2026-02-30')).toBeNull();
    });

    it('only gives tasks a due date', () => {
        expect(first({ kind: 'note', due_date: '2026-10-03' }).due_date).toBe(
            null
        );
    });

    it('clears the fields of an item to keep in the inbox', () => {
        const result = first({
            kind: 'keep',
            project_name: 'Home renovation',
            tags: ['home'],
            why: { title: 'x', project: 'x', tags: 'x', due_date: 'x' },
        });

        expect(result).toMatchObject({
            kind: 'keep',
            title: '',
            project_uid: null,
            tags: [],
            due_date: null,
            why: emptyWhy,
        });
    });

    it('trims and caps the explanation', () => {
        const result = first({
            analysis: `  ${'x'.repeat(400)}  `,
            why: { ...emptyWhy, title: 'y'.repeat(200) },
            reason: 7,
        });

        expect(result.analysis).toHaveLength(300);
        expect(result.why.title).toHaveLength(120);
        expect(result.reason).toBe('');
    });
});
