'use strict';

// Life-to-Day (T-1104): lesson and task-effect tools for the Capability
// Registry. Reads answer at once; creating or editing a lesson is an R2
// Proposal the user applies in the app. Deleting a lesson is not a tool.
const moment = require('moment-timezone');
const { z, define } = require('../ltd-capabilities/registry');
const proposals = require('../ltd-proposals/service');
const lessons = require('./service');
const repository = require('./repository');

const PENDING =
    'Nothing has changed yet. The user reviews this proposal in Life-to-Day (Proposals) and applies or rejects it there.';
const day = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD (Gregorian)')
    .refine((value) => moment(value, 'YYYY-MM-DD', true).isValid(), {
        message: 'Not a real date',
    });
const text = z.string().max(10000);
const link = z.strictObject({
    type: z.enum(['goal', 'project', 'area', 'tag']),
    uid: z.string().min(1),
});
const fields = {
    expected: text.optional().describe('What the user expected'),
    happened: text.optional().describe('What actually happened'),
    if_text: text
        .optional()
        .describe('The situation of an if/then plan; needs then_text'),
    then_text: text
        .optional()
        .describe('What to do in that situation; needs if_text'),
    learned_on: day.optional().describe('Day learned; default today'),
    review_on: day
        .nullable()
        .optional()
        .describe('Day to review it again; default learned_on + 14 days'),
    links: z
        .array(link)
        .max(20)
        .optional()
        .describe('Goals, projects, areas or tags of the user it applies to'),
    reason: z
        .string()
        .max(500)
        .optional()
        .describe('Why this change is proposed, shown to the user'),
};

// Links are checked now, so a proposal never names another user's goal.
async function preview(userId, links) {
    const targets = await repository.resolveTargets(userId, links || []);
    const describe = await repository.describeTargets(
        userId,
        targets.map((t) => ({ ...t, lesson_id: 0 }))
    );
    return describe({ id: 0 });
}
const reply = (proposal) => ({
    proposal_uid: proposal.uid,
    status: proposal.status,
    title: proposal.title,
    risk_tier: proposal.risk_tier,
    ops: proposal.ops,
    expires_at: proposal.expires_at,
    message: PENDING,
});
const propose = (ctx, title, rationale, op) =>
    proposals.propose(ctx.userId, {
        origin: 'mcp',
        client_id: ctx.client.key,
        title,
        rationale: rationale || null,
        ops: [op],
    });

const LESSON_CAPABILITIES = [
    define({
        name: 'get_task_effect',
        description:
            'Read where one task sits on the long path: its goal chain up to five-year and vision, the outcome O of the nearest measured goal, and at most one life lesson. Finishing a task never changes O.',
        scope: 'ltd.read',
        risk: 'R0',
        input: z.strictObject({
            task_uid: z.string().min(1).describe('Task UID'),
        }),
        handler: (params, ctx) => lessons.effect(ctx.userId, params.task_uid),
    }),
    define({
        name: 'list_lessons',
        description:
            'Read the user’s life lessons, optionally by status or by a linked goal',
        scope: 'ltd.read',
        risk: 'R0',
        input: z.strictObject({
            status: z
                .enum(['active', 'parked', 'retired', 'all'])
                .optional()
                .describe('Filter by status (default: all)'),
            goal_uid: z
                .string()
                .min(1)
                .optional()
                .describe('Only lessons linked to this goal'),
        }),
        handler: async (params, ctx) => {
            const rows = await lessons.list(ctx.userId, params);
            return { count: rows.length, lessons: rows };
        },
    }),
    define({
        name: 'get_lesson',
        description: 'Read one of the user’s life lessons by UID',
        scope: 'ltd.read',
        risk: 'R0',
        input: z.strictObject({
            uid: z.string().min(1).describe('Lesson UID'),
        }),
        handler: async (params, ctx) => ({
            lesson: await lessons.get(ctx.userId, params.uid),
        }),
    }),
    define({
        name: 'create_lesson',
        description:
            'Creates a proposal; nothing changes until the user approves it in Life-to-Day. Proposes a new life lesson, optionally with an if/then plan and links to the user’s goals, projects, areas or tags.',
        scope: 'ltd.propose',
        risk: 'R2',
        input: z.strictObject({
            title: z.string().trim().min(1).max(255),
            ...fields,
        }),
        handler: async ({ reason, ...params }, ctx) => {
            const { fields: valid } = lessons.validate(params, true);
            lessons.assertPair(valid);
            const links = await preview(ctx.userId, params.links);
            const proposal = await propose(
                ctx,
                `Lesson: ${valid.title}`,
                reason,
                { type: 'create_lesson', ...valid, links }
            );
            return reply(proposal);
        },
    }),
    define({
        name: 'update_lesson',
        description:
            'Creates a proposal; nothing changes until the user approves it in Life-to-Day. Proposes changes to one life lesson: its text, if/then plan, review day, links or status (active, parked, retired).',
        scope: 'ltd.propose',
        risk: 'R2',
        input: z.strictObject({
            uid: z.string().min(1).describe('Lesson UID'),
            title: z.string().trim().min(1).max(255).optional(),
            status: z.enum(['active', 'parked', 'retired']).optional(),
            ...fields,
        }),
        handler: async ({ uid, reason, ...params }, ctx) => {
            const current = await lessons.get(ctx.userId, uid);
            const { fields: changes } = lessons.validate(params);
            lessons.assertPair({ ...current, ...changes });
            const links =
                params.links === undefined
                    ? undefined
                    : await preview(ctx.userId, params.links);
            if (!Object.keys(changes).length && !links)
                return {
                    proposal_uid: null,
                    message: 'No change was given; nothing was proposed.',
                };
            const proposal = await propose(
                ctx,
                `Edit lesson: ${current.title}`,
                reason,
                {
                    type: 'update_lesson',
                    lesson_uid: uid,
                    lesson_title: current.title,
                    changes,
                    ...(links ? { links } : {}),
                }
            );
            return reply(proposal);
        },
    }),
];

module.exports = { LESSON_CAPABILITIES };
