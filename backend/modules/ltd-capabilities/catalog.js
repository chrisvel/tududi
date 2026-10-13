'use strict';

// Life-to-Day (T-703, T-705): every capability, defined once. The Phase 4
// read tools are registered here and call the same planning services.
// T-803: in-app AI definitions share this registry and require human consent.
// Out of scope until Phase 9: propose_calendar_changes.
// T-1104: lesson tools live in ltd-lessons/capabilities.js.
const moment = require('moment-timezone');
const { z, define } = require('./registry');
const { Area, Goal, InboxItem, Task } = require('../../models');
const goalsRepository = require('../goals/repository');
const areasRepository = require('../areas/repository');
const planning = require('../ltd-progress/service');
const planner = require('../ltd-planner/service');
const metrics = require('../ltd-metrics/service');
const proposals = require('../ltd-proposals/service');
const dailyPlanService = require('../daily-plan/service');
const calendarFeeds = require('../calendar-feeds/service');
const { withJournal } = require('../ltd-journal/service');
const { NotFoundError, ValidationError } = require('../../shared/errors');
const { getSafeTimezone } = require('../../utils/timezone-utils');

const day = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .refine((value) => moment(value, 'YYYY-MM-DD', true).isValid(), {
        message: 'Not a real date',
    });
const HORIZONS = ['vision', 'five_year', 'year', 'season', 'month', 'week'];
const CLOSED = [Task.STATUS.DONE, Task.STATUS.ARCHIVED, Task.STATUS.CANCELLED];
const PENDING =
    'Nothing has changed yet. The user reviews this proposal in Life-to-Day (Proposals) and applies or rejects it there.';

const today = (user) => moment.tz(getSafeTimezone(user.timezone));
const proposalReply = (proposal) => ({
    proposal_uid: proposal.uid,
    status: proposal.status,
    title: proposal.title,
    risk_tier: proposal.risk_tier,
    ops: proposal.ops,
    expires_at: proposal.expires_at,
    message: PENDING,
});
const propose = (ctx, fields) =>
    proposals.propose(ctx.userId, {
        origin: 'mcp',
        client_id: ctx.client.key,
        ...fields,
    });

const countNodes = (nodes) =>
    nodes.reduce(
        (total, node) => total + 1 + countNodes(node.children || []),
        0
    );

const goalReads = [
    define({
        name: 'list_goals',
        description:
            'Read the goal horizon tree with separate activity (A) and outcome (O) progress',
        scope: 'ltd.read',
        risk: 'R0',
        input: z.strictObject({
            area_id: z
                .number()
                .int()
                .min(1)
                .optional()
                .describe('Filter by owned area ID'),
            status: z
                .enum(['active', 'achieved', 'paused', 'dropped', 'all'])
                .optional()
                .describe('Filter by status (default: all)'),
        }),
        handler: async (params, ctx) => {
            const goals = await planning.tree(ctx.userId, params);
            return { count: countNodes(goals), goals };
        },
    }),
    define({
        name: 'get_goal',
        description: 'Read an owned goal by UID',
        scope: 'ltd.read',
        risk: 'R0',
        input: z.strictObject({
            uid: z.string().min(1).describe('Goal UID'),
        }),
        handler: async (params, ctx) => {
            const goal = await goalsRepository.findByUid(
                ctx.userId,
                params.uid
            );
            if (!goal) throw new NotFoundError('Goal not found');
            const area = goal.Area
                ? await areasRepository.findByUid(ctx.userId, goal.Area.uid)
                : null;
            return {
                goal: {
                    id: goal.id,
                    uid: goal.uid,
                    title: goal.title,
                    why: goal.why,
                    horizon: goal.horizon,
                    status: goal.status,
                    target_date: goal.target_date,
                    parent_goal_id: goal.parent_goal_id,
                    period_start: goal.period_start,
                    period_end: goal.period_end,
                    achieved_at: goal.achieved_at,
                    area: area
                        ? { id: area.id, uid: area.uid, name: area.name }
                        : null,
                    projects: (goal.Projects || []).map((p) => ({
                        id: p.id,
                        uid: p.uid,
                        name: p.name,
                        status: p.status,
                    })),
                    created_at: goal.created_at,
                    updated_at: goal.updated_at,
                },
            };
        },
    }),
    define({
        name: 'get_goal_progress',
        description:
            'Read computed A and O, health and expected progress for an owned goal',
        scope: 'ltd.read',
        risk: 'R0',
        input: z.strictObject({
            uid: z.string().min(1).describe('Goal UID'),
        }),
        handler: (params, ctx) => planning.progress(ctx.userId, params.uid),
    }),
    define({
        name: 'get_life_vision',
        description:
            'Read owned vision goals with their horizon tree and progress',
        scope: 'ltd.read',
        risk: 'R0',
        input: z.strictObject({}),
        handler: async (_params, ctx) => ({
            visions: await planning.lifeVision(ctx.userId),
        }),
    }),
    define({
        name: 'explain_contribution',
        description:
            'Read the task goal or project goal why chain from that goal to its root',
        scope: 'ltd.read',
        risk: 'R0',
        input: z.strictObject({
            task_uid: z.string().min(1).describe('Task UID'),
        }),
        handler: async (params, ctx) => ({
            whyChain: await planning.whyChain(ctx.userId, params.task_uid),
        }),
    }),
];

const planningReads = [
    define({
        name: 'get_weekly_plan',
        description:
            'Read the planned blocks of each day of one week (read only)',
        scope: 'ltd.read',
        risk: 'R0',
        input: z.strictObject({
            week_start: day
                .optional()
                .describe('First day of the week; default: this week'),
        }),
        handler: async ({ week_start: weekStart }, ctx) => {
            const now = today(ctx.user);
            const first =
                weekStart ||
                now
                    .clone()
                    .subtract(
                        (now.day() - (ctx.user.first_day_of_week ?? 1) + 7) % 7,
                        'days'
                    )
                    .format('YYYY-MM-DD');
            const days = [];
            for (let offset = 0; offset < 7; offset++) {
                const date = moment(first)
                    .add(offset, 'days')
                    .format('YYYY-MM-DD');
                const { plan } = await dailyPlanService.getPlan(ctx.user, date);
                const items = (plan?.items || []).map((item) => ({
                    task_uid: item.task_uid,
                    name: item.task?.name,
                    start_minute: item.start_minute,
                    duration_minutes: item.duration_minutes,
                    done:
                        item.occurrence_done ||
                        CLOSED.includes(item.task?.status),
                }));
                days.push({
                    date,
                    planned_minutes: items.reduce(
                        (sum, item) => sum + (item.duration_minutes || 0),
                        0
                    ),
                    items,
                });
            }
            return { week_start: first, days };
        },
    }),
    define({
        name: 'get_calendar_events',
        description:
            'Read busy time from the user’s calendar feeds; event titles are left out unless allow_titles is true',
        scope: 'ltd.read',
        risk: 'R0',
        input: z.strictObject({
            from: day.describe('First day (YYYY-MM-DD)'),
            to: day.describe('Last day (YYYY-MM-DD), at most 62 days later'),
            allow_titles: z
                .boolean()
                .optional()
                .describe(
                    'Include event titles; only when the user asked for them'
                ),
        }),
        handler: async ({ from, to, allow_titles: allowTitles }, ctx) => {
            const { events } = await calendarFeeds.eventsForRangeOfDays(
                ctx.user,
                from,
                to
            );
            return {
                from,
                to,
                titles_included: allowTitles === true,
                events: events.map((event) => ({
                    date: event.date,
                    all_day: event.all_day,
                    busy: event.busy,
                    start: event.start,
                    end: event.end,
                    start_minute: event.start_minute,
                    end_minute: event.end_minute,
                    ...(allowTitles === true ? { title: event.title } : {}),
                })),
            };
        },
    }),
];

const proposalTools = [
    define({
        name: 'plan_tomorrow',
        description:
            'Creates a proposal; nothing changes until the user approves it in Life-to-Day. Drafts time blocks for tomorrow (or the given day) from the user’s ranked tasks, within work hours, around calendar events, keeping the load realistic.',
        scope: 'ltd.propose',
        risk: 'R2',
        input: z.strictObject({
            date: day.optional().describe('Day to plan; default: tomorrow'),
        }),
        handler: async ({ date }, ctx) => {
            const target =
                date || today(ctx.user).add(1, 'day').format('YYYY-MM-DD');
            const draft = await planner.draftDay(ctx.user, target);
            if (!draft.blocks.length)
                return {
                    proposal_uid: null,
                    date: draft.date,
                    message:
                        'No task fits a free slot under a realistic load; nothing was proposed.',
                };
            const proposal = await propose(ctx, {
                title: `Plan for ${draft.date}`,
                rationale: `Load after this plan: ${draft.load} of ${draft.capacity_minutes} free minutes.`,
                ops: draft.blocks.map((block) => ({
                    type: 'schedule_block',
                    date: draft.date,
                    task_uid: block.task_uid,
                    task_name: block.task_name,
                    start_minute: block.start_minute,
                    duration_minutes: block.duration_minutes,
                    reason: block.reason,
                })),
            });
            return { ...proposalReply(proposal), load: draft.load };
        },
    }),
    define({
        name: 'create_goal',
        description:
            'Creates a proposal; nothing changes until the user approves it in Life-to-Day. Proposes a new goal, optionally under a parent goal or in an area.',
        scope: 'ltd.propose',
        risk: 'R2',
        input: z.strictObject({
            title: z.string().trim().min(1).max(255),
            horizon: z.enum(HORIZONS).describe('Goal horizon'),
            parent_goal_uid: z.string().min(1).optional(),
            area_uid: z.string().min(1).optional(),
            why: z.string().max(2000).optional(),
            target_date: day.optional(),
            reason: z
                .string()
                .max(500)
                .optional()
                .describe('Why this goal is proposed, shown to the user'),
        }),
        handler: async (params, ctx) => {
            let parentTitle = null;
            if (params.parent_goal_uid) {
                const parent = await Goal.findOne({
                    where: { uid: params.parent_goal_uid, user_id: ctx.userId },
                });
                if (!parent) throw new NotFoundError('Parent goal not found');
                parentTitle = parent.title;
            }
            if (
                params.area_uid &&
                !(await Area.findOne({
                    where: { uid: params.area_uid, user_id: ctx.userId },
                }))
            )
                throw new NotFoundError('Area not found');
            const { reason, ...goal } = params;
            const proposal = await propose(ctx, {
                title: `New goal: ${goal.title}`,
                rationale: reason || null,
                ops: [
                    { type: 'create_goal', ...goal, parent_title: parentTitle },
                ],
            });
            return proposalReply(proposal);
        },
    }),
    define({
        name: 'reschedule_tasks',
        description:
            'Creates a proposal; nothing changes until the user approves it in Life-to-Day. Proposes new due dates: tomorrow, the start of next week, or a given date.',
        scope: 'ltd.propose',
        risk: 'R2',
        input: z.strictObject({
            task_uids: z.array(z.string().min(1)).min(1).max(50),
            strategy: z.enum(['tomorrow', 'next_week', 'date']),
            date: day.optional().describe('Required when strategy is date'),
            reason: z.string().max(500).optional(),
        }),
        handler: async ({ task_uids: uids, strategy, date, reason }, ctx) => {
            const now = today(ctx.user);
            let target = date;
            if (strategy === 'date' && !date)
                throw new ValidationError('date is required for strategy date');
            if (strategy === 'tomorrow')
                target = now.clone().add(1, 'day').format('YYYY-MM-DD');
            if (strategy === 'next_week') {
                const ahead =
                    ((ctx.user.first_day_of_week ?? 1) - now.day() + 7) % 7 ||
                    7;
                target = now.clone().add(ahead, 'days').format('YYYY-MM-DD');
            }
            const unique = [...new Set(uids)];
            const found = await Task.findAll({
                where: { user_id: ctx.userId, uid: unique },
            });
            const byUid = new Map(found.map((task) => [task.uid, task]));
            const missing = unique.filter((uid) => !byUid.has(uid));
            if (missing.length)
                throw new NotFoundError(
                    `Tasks not found: ${missing.join(', ')}`
                );
            // Ops follow the order the client asked for, on every dialect.
            const tasks = unique.map((uid) => byUid.get(uid));
            const blocked = tasks.filter(
                (task) =>
                    CLOSED.includes(task.status) ||
                    (task.recurrence_type && task.recurrence_type !== 'none')
            );
            if (blocked.length)
                throw new ValidationError(
                    `Closed or recurring tasks cannot be rescheduled here: ${blocked.map((t) => t.uid).join(', ')}`
                );
            const timezone = getSafeTimezone(ctx.user.timezone);
            const ops = tasks
                .map((task) => ({
                    type: 'update_task',
                    task_uid: task.uid,
                    task_name: task.name,
                    field: 'due_date',
                    before: task.due_date
                        ? new Date(task.due_date).toISOString()
                        : null,
                    before_day: task.due_date
                        ? moment(task.due_date)
                              .tz(timezone)
                              .format('YYYY-MM-DD')
                        : null,
                    after: target,
                }))
                .filter((op) => op.before_day !== target);
            if (!ops.length)
                return {
                    proposal_uid: null,
                    message: `Every task is already due on ${target}; nothing was proposed.`,
                };
            const proposal = await propose(ctx, {
                title: `Move ${ops.length} task(s) to ${target}`,
                rationale: reason || null,
                ops,
            });
            return proposalReply(proposal);
        },
    }),
];

const writes = [
    define({
        name: 'capture',
        description:
            'Adds one item to the user’s Inbox right away; the user can undo it from the Journal.',
        scope: 'ltd.write',
        risk: 'R1',
        input: z.strictObject({
            text: z.string().trim().min(1).max(10000),
        }),
        handler: (params, ctx) =>
            withJournal(ctx.actor, async (transaction, record) => {
                const item = await InboxItem.create(
                    {
                        content: params.text,
                        source: 'mcp',
                        user_id: ctx.userId,
                    },
                    { transaction }
                );
                const entry = await record({
                    op: 'inbox_create',
                    entity_type: 'inbox_item',
                    entity_uid: item.uid,
                    before: null,
                    after: { content: item.content },
                });
                return { inbox_item_uid: item.uid, journal_uid: entry.uid };
            }),
    }),
    define({
        name: 'checkin_metric',
        description:
            'Records a new value for one goal metric right away; the user can undo it from the Journal.',
        scope: 'ltd.write',
        risk: 'R1',
        input: z.strictObject({
            metric_uid: z.string().min(1),
            value: z.number().finite(),
            note: z.string().max(10000).optional(),
        }),
        handler: async ({ metric_uid: uid, value, note }, ctx) => {
            const { metric, checkin, journal_uid } = await metrics.checkin(
                ctx.userId,
                uid,
                { value, note },
                ctx.actor
            );
            return {
                metric_uid: metric.uid,
                checkin_uid: checkin.uid,
                current_value: metric.current_value,
                journal_uid,
            };
        },
    }),
];

const CAPABILITIES = [
    ...goalReads,
    ...planningReads,
    ...proposalTools,
    ...writes,
    ...require('../ltd-ai/capabilities').AI_CAPABILITIES,
    // T-1104: task effect and life lessons.
    ...require('../ltd-lessons/capabilities').LESSON_CAPABILITIES,
];

module.exports = { CAPABILITIES, GOAL_READS: goalReads };
