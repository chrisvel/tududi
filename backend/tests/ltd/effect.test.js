'use strict';
const { taskEffect } = require('../../modules/ltd-progress/effect');
const { project } = require('../../modules/ltd-progress/projection');

// Life-to-Day (T-1101): the effect of a task is read, never stored, and
// finishing the task never moves the outcome O.
const NOW = new Date('2026-10-13T12:00:00Z');
const TODAY = '2026-10-13';
const goal = (id, horizon, parent = null, changes = {}) => ({
    id,
    uid: `g${id}`,
    title: `Goal ${id}`,
    horizon,
    why: null,
    status: 'active',
    parent_goal_id: parent,
    period_start: '2026-10-01',
    period_end: '2026-12-31',
    area_id: null,
    ...changes,
});
// vision 1 ← five_year 2 ← year 3 ← season 4
const GOALS = [
    goal(1, 'vision', null, { why: 'A bilingual life' }),
    goal(2, 'five_year', 1, { why: 'Work in Spanish' }),
    goal(3, 'year', 2),
    goal(4, 'season', 3, { why: 'Pass the exam' }),
];
const task = (changes = {}) => ({
    id: 10,
    uid: 't10',
    user_id: 1,
    name: 'Practice',
    status: 0,
    goal_id: 4,
    project_id: null,
    area_id: null,
    due_date: '2026-10-20T10:00:00.000Z',
    completed_at: null,
    habit_mode: false,
    ...changes,
});
function snapshot(changes = {}) {
    return {
        goals: GOALS,
        tasks: [task()],
        projects: [{ id: 5, uid: 'p5', goal_id: null, area_id: 7 }],
        // Outcome lives on the year goal: (40 - 0) / (100 - 0) = 0.4.
        metrics: [
            {
                id: 1,
                goal_id: 3,
                baseline: 0,
                target: 100,
                current_value: 40,
                weight: 1,
            },
        ],
        plans: [],
        planItems: [],
        completions: [],
        user: { id: 1, timezone: 'UTC' },
        ...changes,
    };
}
let nextId = 100;
const lesson = (links, changes = {}) => ({
    id: nextId++,
    uid: `l${nextId}`,
    user_id: 1,
    title: `Lesson ${nextId}`,
    if_text: null,
    then_text: null,
    status: 'active',
    review_on: null,
    updated_at: '2026-10-01T00:00:00Z',
    links: links.map(([target_type, target_id]) => ({
        target_type,
        target_id,
    })),
    ...changes,
});
const effect = (t = task(), snap = snapshot(), options = {}) =>
    taskEffect(t, snap, { now: NOW, today: TODAY, ...options });

describe('Phase 11 taskEffect', () => {
    it('walks the chain up to five_year and vision', () => {
        const result = effect();
        expect(result.kind).toBe('linked');
        expect(result.chain.map((n) => n.uid)).toEqual([
            'g4',
            'g3',
            'g2',
            'g1',
        ]);
        expect(result.chain[0]).toEqual({
            uid: 'g4',
            title: 'Goal 4',
            horizon: 'season',
            why: 'Pass the exam',
        });
        expect(result.fiveYear).toMatchObject({ uid: 'g2' });
        expect(result.vision).toMatchObject({ uid: 'g1' });
        expect(result.meaning).toBe('Work in Spanish');
        expect(result.outcome).toEqual({
            goal_uid: 'g3',
            title: 'Goal 3',
            horizon: 'year',
            value: 0.4,
        });
        expect(result.activity).toBe(true);
    });

    it('takes meaning from five_year, then vision, then the nearest goal', () => {
        const without = (ids) =>
            snapshot({
                goals: GOALS.map((g) =>
                    ids.includes(g.id) ? { ...g, why: '  ' } : g
                ),
            });
        expect(effect(task(), without([2])).meaning).toBe('A bilingual life');
        expect(effect(task(), without([1, 2])).meaning).toBe('Pass the exam');
        expect(effect(task(), without([1, 2, 4])).meaning).toBeNull();
    });

    it('reaches the project goal when the task has no goal of its own', () => {
        const snap = snapshot({
            projects: [{ id: 5, uid: 'p5', goal_id: 3, area_id: null }],
        });
        const result = effect(task({ goal_id: null, project_id: 5 }), snap);
        expect(result.chain.map((n) => n.uid)).toEqual(['g3', 'g2', 'g1']);
    });

    it('a task without a goal is unlinked and carries no percent', () => {
        const result = effect(task({ goal_id: null }));
        expect(result).toMatchObject({
            kind: 'unlinked',
            chain: [],
            fiveYear: null,
            vision: null,
            meaning: null,
            outcome: null,
            activity: false,
            lesson: null,
        });
    });

    it('finishing the task moves A but leaves O where it was', () => {
        const open = snapshot();
        const before = effect(task(), open);
        const doneTask = task({
            status: 2,
            completed_at: '2026-10-13T11:00:00.000Z',
        });
        const done = snapshot({ tasks: [doneTask] });
        const after = effect(doneTask, done);
        expect(before.outcome.value).toBe(0.4);
        expect(after.outcome).toEqual(before.outcome);
        // The same snapshots: activity A went from 0 to 1 on the season goal.
        expect(project(open, NOW).progress.get(4).A).toBe(0);
        expect(project(done, NOW).progress.get(4).A).toBe(1);
        expect(project(done, NOW).progress.get(3).O).toBe(0.4);
    });

    it('activity is false outside the goal period', () => {
        const late = task({ due_date: '2027-03-01T10:00:00.000Z' });
        expect(effect(late, snapshot({ tasks: [late] })).activity).toBe(false);
    });

    it('without any outcome, activity is judged on the nearest goal', () => {
        const result = effect(task(), snapshot({ metrics: [] }));
        expect(result.outcome).toBeNull();
        expect(result.activity).toBe(true);
    });

    it('picks one lesson by score: direct goal 4 > chain 3 > project 2 > area 1', () => {
        const t = task({ project_id: 5, tag_ids: [9] });
        const direct = lesson([['goal', 4]]);
        const chain = lesson([['goal', 2]]);
        const proj = lesson([['project', 5]]);
        const area = lesson([['area', 7]]);
        const tag = lesson([['tag', 9]], {
            updated_at: '2026-01-01T00:00:00Z',
        });
        const pick = (lessons) =>
            effect(t, snapshot(), { lessons }).lesson?.uid;
        expect(pick([area, proj, chain, direct, tag])).toBe(direct.uid);
        expect(pick([area, proj, chain, tag])).toBe(chain.uid);
        expect(pick([area, proj, tag])).toBe(proj.uid);
        // Area and shared tag both score 1; the newer one wins.
        expect(pick([tag, area])).toBe(area.uid);
        expect(pick([tag])).toBe(tag.uid);
    });

    it('returns at most one lesson, the one due for review first, then the newest', () => {
        const older = lesson([['goal', 4]], {
            updated_at: '2026-09-01T00:00:00Z',
        });
        const newer = lesson([['goal', 4]], {
            updated_at: '2026-10-10T00:00:00Z',
        });
        const due = lesson([['goal', 4]], {
            review_on: TODAY,
            updated_at: '2026-08-01T00:00:00Z',
        });
        const notYet = lesson([['goal', 4]], {
            review_on: '2026-10-14',
            updated_at: '2026-10-12T00:00:00Z',
        });
        const result = effect(task(), snapshot(), {
            lessons: [older, newer, notYet, due],
        });
        expect(result.lesson).toEqual({
            uid: due.uid,
            title: due.title,
            if_text: null,
            then_text: null,
            review_on: TODAY,
        });
        expect(
            effect(task(), snapshot(), { lessons: [older, newer] }).lesson.uid
        ).toBe(newer.uid);
    });

    it('a lesson without a link, or with no matching link, never reaches the task', () => {
        const lessons = [
            lesson([]),
            lesson([['goal', 99]]),
            lesson([['project', 5]]),
            lesson([['tag', 9]]),
            lesson([['goal', 4]], { status: 'parked' }),
            lesson([['goal', 4]], { user_id: 2 }),
        ];
        expect(effect(task(), snapshot(), { lessons }).lesson).toBeNull();
    });

    it('carries the if/then of the chosen lesson', () => {
        const withPlan = lesson([['goal', 3]], {
            title: 'Short sessions work',
            if_text: 'I sit down to study',
            then_text: 'I set a 20 minute timer',
        });
        expect(
            effect(task(), snapshot(), { lessons: [withPlan] }).lesson
        ).toMatchObject({
            if_text: 'I sit down to study',
            then_text: 'I set a 20 minute timer',
        });
    });

    it('reads today from the user timezone when none is given', () => {
        const due = lesson([['goal', 4]], {
            review_on: '2026-10-14',
            updated_at: '2026-01-01T00:00:00Z',
        });
        const fresh = lesson([['goal', 4]], {
            updated_at: '2026-10-12T00:00:00Z',
        });
        const late = new Date('2026-10-13T22:30:00Z');
        const inTehran = snapshot({
            user: { id: 1, timezone: 'Asia/Tehran' },
        });
        // 22:30 UTC is already 14 October in Tehran, so the review is due.
        expect(
            taskEffect(task(), inTehran, { now: late, lessons: [fresh, due] })
                .lesson.uid
        ).toBe(due.uid);
        expect(
            taskEffect(task(), snapshot(), { now: late, lessons: [fresh, due] })
                .lesson.uid
        ).toBe(fresh.uid);
    });

    it('a habit linked to the goal counts as activity while the goal has a period', () => {
        const habitTask = task({ habit_mode: true, due_date: null });
        expect(
            effect(habitTask, snapshot({ tasks: [habitTask] })).activity
        ).toBe(true);
        const open = snapshot({
            tasks: [habitTask],
            goals: GOALS.map((g) => ({
                ...g,
                period_start: null,
                period_end: null,
            })),
        });
        expect(effect(habitTask, open).activity).toBe(false);
    });
});
