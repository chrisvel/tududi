const {
    sanitizeDraft,
    sanitizeEstimate,
} = require('../../../modules/daily-plan/ai');
const slots = require('../../../modules/daily-plan/slots');

const task = (uid, extra = {}) => ({ uid, name: uid, ...extra });
const poolOf = (...tasks) => new Map(tasks.map((t) => [t.uid, t]));
const meeting = (start, end, extra = {}) => ({
    all_day: false,
    busy: true,
    start_minute: start,
    end_minute: end,
    ...extra,
});

describe('sanitizeDraft', () => {
    it('drops unknown, duplicate and already planned tasks', () => {
        const items = sanitizeDraft({
            proposed: [
                { task_uid: 'ghost', start_minute: 600, duration_minutes: 30 },
                { task_uid: 'a', start_minute: 600, duration_minutes: 30 },
                { task_uid: 'a', start_minute: 700, duration_minutes: 30 },
                { task_uid: 'kept', start_minute: 800, duration_minutes: 30 },
            ],
            pool: poolOf(task('a'), task('kept')),
            existing: [
                {
                    task_uid: 'kept',
                    start_minute: 480,
                    duration_minutes: 30,
                },
            ],
            events: [],
            now: 0,
        });
        expect(items.map((i) => i.task_uid)).toEqual(['a']);
    });

    it('moves a block that clashes with a meeting to the next free slot', () => {
        const [item] = sanitizeDraft({
            proposed: [
                { task_uid: 'a', start_minute: 540, duration_minutes: 60 },
            ],
            pool: poolOf(task('a')),
            existing: [],
            events: [meeting(560, 600)],
            now: 0,
        });
        expect(item.start_minute).toBe(600);
    });

    it('never schedules in the past', () => {
        const [item] = sanitizeDraft({
            proposed: [
                { task_uid: 'a', start_minute: 480, duration_minutes: 30 },
            ],
            pool: poolOf(task('a')),
            existing: [],
            events: [],
            now: 610,
        });
        expect(item.start_minute).toBe(615);
    });

    it('keeps drafted blocks from overlapping each other', () => {
        const items = sanitizeDraft({
            proposed: [
                { task_uid: 'a', start_minute: 600, duration_minutes: 60 },
                { task_uid: 'b', start_minute: 630, duration_minutes: 30 },
            ],
            pool: poolOf(task('a'), task('b')),
            existing: [],
            events: [],
            now: 0,
        });
        expect(items.map((i) => i.start_minute)).toEqual([600, 660]);
    });

    it('snaps to the grid, clamps lengths and falls back to the estimate', () => {
        const items = sanitizeDraft({
            proposed: [
                { task_uid: 'a', start_minute: 607, duration_minutes: 3 },
                { task_uid: 'b', start_minute: null, duration_minutes: 0 },
                { task_uid: 'c', start_minute: 900, duration_minutes: 5000 },
            ],
            pool: poolOf(
                task('a'),
                task('b', { estimated_minutes: 45 }),
                task('c')
            ),
            existing: [],
            events: [],
            now: 0,
        });
        expect(items[0]).toMatchObject({
            start_minute: 600,
            duration_minutes: 30,
        });
        expect(items[1]).toMatchObject({
            start_minute: null,
            duration_minutes: 45,
        });
        expect(items[2].duration_minutes).toBe(720);
    });

    it('drops the time when the day has no room left', () => {
        const [item] = sanitizeDraft({
            proposed: [
                { task_uid: 'a', start_minute: 600, duration_minutes: 60 },
            ],
            pool: poolOf(task('a')),
            existing: [],
            events: [meeting(480, 1080)],
            now: 0,
        });
        expect(item.start_minute).toBeNull();
    });
});

describe('sanitizeEstimate', () => {
    it('keeps estimates on the 15-minute grid between 15m and 4h', () => {
        expect(sanitizeEstimate(20)).toBe(15);
        expect(sanitizeEstimate(50)).toBe(45);
        expect(sanitizeEstimate(600)).toBe(240);
        expect(sanitizeEstimate(0)).toBeNull();
        expect(sanitizeEstimate('soon')).toBeNull();
    });
});

describe('slots', () => {
    it('finds gaps around meetings and planned blocks', () => {
        const spans = slots.blockedSpans(
            [{ start_minute: 480, duration_minutes: 60 }],
            [meeting(600, 660), meeting(700, 720, { busy: false })]
        );
        expect(slots.freeGaps(spans, { start: 480, end: 720 }, 480)).toEqual([
            { start: 540, end: 600 },
            { start: 660, end: 720 },
        ]);
        expect(
            slots.findFreeSlot(spans, 90, { start: 480, end: 1080 }, 480)
        ).toBe(660);
    });
});

describe('languageInstruction', () => {
    const { languageInstruction } = require('../../../modules/daily-plan/ai');

    it('asks for the user language, mapping the app codes', () => {
        expect(languageInstruction('en')).toBe('');
        expect(languageInstruction('el')).toContain('Greek');
        expect(languageInstruction('jp')).toContain('Japanese');
        expect(languageInstruction('ua')).toContain('Ukrainian');
    });
});
