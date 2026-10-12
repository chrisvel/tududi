'use strict';
const { z } = require('zod');
const moment = require('moment-timezone');
const { LtdAiRun, LtdProposal, sequelize } = require('../../models');
const context = require('./context');
const port = require('../ltd-llm');
const proposals = require('../ltd-proposals/service');
const planner = require('../ltd-planner/ai-plan');
const {
    AppError,
    ValidationError,
    ForbiddenError,
    NotFoundError,
} = require('../../shared/errors');
const text = z.string().trim().min(1).max(2000);
const ids = z
    .array(z.string().min(1))
    .min(1)
    .max(10)
    .refine((v) => new Set(v).size === v.length);
const schemas = {
    overload: z.strictObject({ task_uids: ids, explanation: text }),
    small_steps: z.strictObject({ task_uids: ids.max(3), explanation: text }),
    tomorrow: z.strictObject({ task_uids: ids, explanation: text }),
    decompose: z.strictObject({
        steps: z
            .array(
                z.strictObject({
                    title: text.max(255),
                    est_min: z.number().int().min(1).max(480),
                    starter_step: text.max(500),
                })
            )
            .min(1)
            .max(10),
        explanation: text,
    }),
    weekly_priorities: z.strictObject({
        goals: z
            .array(z.strictObject({ uid: z.string().min(1), reason: text }))
            .min(1)
            .max(3)
            .refine((gs) => new Set(gs.map((g) => g.uid)).size === gs.length),
        explanation: text,
    }),
    why: z.strictObject({ sentence: text }),
    review: z.strictObject({ summary: text, question: text }),
};
async function preview(user, request) {
    const built = await context.build(user, request);
    return { manifest: built.manifest, digest: built.digest };
}
async function compile(user, built, output) {
    const { params, snapshot: s } = built;
    const f = params.feature;
    const known = new Set(s.tasks.map((t) => t.uid));
    if (output.task_uids?.some((uid) => !known.has(uid)))
        throw new ValidationError('Unknown task ID');
    if (f === 'why' || f === 'review') {
        // Numeric claims must already exist in the deterministic input.
        const allowed = new Set(
            JSON.stringify(f === 'why' ? s.whyChain : s.statistics).match(
                /[0-9۰-۹٠-٩]+(?:[.,][0-9۰-۹٠-٩]+)?/g
            ) || []
        );
        for (const value of Object.values(output))
            for (const n of value.match(/[0-9۰-۹٠-٩]+(?:[.,][0-9۰-۹٠-٩]+)?/g) ||
                [])
                if (!allowed.has(n))
                    throw new ValidationError('Unsupported number');
        return { text: output };
    }
    let ops;
    if (f === 'decompose')
        ops = output.steps.map((step) => ({
            type: 'create_task',
            ...step,
            ...(params.target_type === 'goal'
                ? { goal_uid: params.target_uid }
                : { parent_task_uid: params.target_uid }),
        }));
    if (f === 'weekly_priorities') {
        if (output.goals.some((g) => !s.eligible_goals.includes(g.uid)))
            throw new ValidationError('Goal is not an eligible priority');
        if (s.weekly_priorities.length + output.goals.length > 3)
            throw new ValidationError('At most three weekly priorities');
        ops = output.goals.map((g) => ({
            type: 'create_goal',
            title: s.goals.find((goal) => goal.uid === g.uid).title,
            horizon: 'week',
            parent_goal_uid: g.uid,
            why: g.reason,
            ...s.week,
        }));
    }
    if (f === 'tomorrow')
        ops = await planner.draft(user, s.date, output.task_uids);
    if (f === 'overload' && !s.capacity.unrealistic)
        throw new ValidationError('The plan is already realistic');
    if (f === 'overload' || f === 'small_steps') {
        const planned = s.planned_tasks.map((t) => t.uid);
        if (output.task_uids.some((uid) => !planned.includes(uid)))
            throw new ValidationError('Task is not planned');
        if (
            f === 'small_steps' &&
            output.task_uids.some(
                (uid) => s.planned_tasks.find((t) => t.uid === uid).est_min > 30
            )
        )
            throw new ValidationError(
                'Choose small tasks of at most 30 minutes'
            );
        const moved =
            f === 'overload'
                ? output.task_uids
                : planned.filter((uid) => !output.task_uids.includes(uid));
        ops = await planner.draft(
            user,
            moment(s.date).add(1, 'day').format('YYYY-MM-DD'),
            moved,
            s.date
        );
    }
    if (!ops?.length) throw new ValidationError('No safe changes to propose');
    await planner.validate(user, ops);
    return { ops, rationale: output.explanation };
}
async function generate(
    user,
    args,
    injectedProvider,
    { timeoutMs = 30000 } = {}
) {
    if (args.consent !== true)
        throw new ForbiddenError('Consent is required for this feature');
    const built = await context.build(user, args.request);
    if (args.digest !== built.digest)
        throw new ForbiddenError('Context changed; review the manifest again');
    const f = built.params.feature;
    const beforeNetwork = async () => {
        const current = await context.config(user.id, f);
        if (
            current.provider !== built.config.provider ||
            current.model !== built.config.model ||
            current.baseURL !== built.config.baseURL
        )
            throw new ForbiddenError(
                'Provider changed; review the manifest again'
            );
    };
    const provider =
        injectedProvider ||
        (await port.createProvider(built.config, beforeNetwork));
    const started = Date.now();
    const usage = { inputTokens: 0, outputTokens: 0 };
    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
        let timer;
        const controller = new AbortController();
        try {
            await beforeNetwork();
            const reply = await Promise.race([
                provider.generateStructured(schemas[f], built.messages, {
                    signal: controller.signal,
                }),
                new Promise((_, reject) => {
                    timer = setTimeout(() => {
                        controller.abort();
                        reject(new Error('Timeout'));
                    }, timeoutMs);
                }),
            ]);
            usage.inputTokens += reply.usage?.inputTokens || 0;
            usage.outputTokens += reply.usage?.outputTokens || 0;
            const value = schemas[f].parse(
                typeof reply.value === 'string'
                    ? JSON.parse(reply.value)
                    : reply.value
            );
            result = await compile(user, built, value);
            break;
        } catch {
            if (attempt === 1)
                throw new AppError(
                    'AI پاسخ معتبر نداد',
                    422,
                    'AI_INVALID_RESPONSE'
                );
        } finally {
            clearTimeout(timer);
            controller.abort();
        }
    }
    // Errors above write nothing, including the run ledger. Valid responses are
    // recorded atomically with their Proposal; prompt text/debug is never stored.
    return sequelize.transaction(async (transaction) => {
        const proposal = result.ops
            ? await proposals.propose(
                  user.id,
                  {
                      origin: 'in_app_ai',
                      title: {
                          overload: 'A more realistic day',
                          small_steps: 'Small steps for a heavy day',
                          decompose: 'Steps to get started',
                          tomorrow: 'A plan for tomorrow',
                          weekly_priorities: 'Weekly priorities',
                      }[f],
                      rationale: result.rationale,
                      ops: result.ops,
                  },
                  { transaction }
              )
            : null;
        const row = proposal
            ? await LtdProposal.findOne({
                  where: { user_id: user.id, uid: proposal.uid },
                  transaction,
              })
            : null;
        const run = await LtdAiRun.create(
            {
                user_id: user.id,
                feature: f,
                provider: built.config.provider,
                model: built.config.model,
                tokens_in: usage.inputTokens,
                tokens_out: usage.outputTokens,
                latency_ms: Date.now() - started,
                status: 'success',
                proposal_id: row?.id || null,
                prompt_hash: context.hash(built.messages),
            },
            { transaction }
        );
        return { run_id: run.id, proposal, text: result.text || null };
    });
}
async function targets(userId) {
    const { Task, Goal } = require('../../models');
    const { Op } = require('sequelize');
    const [tasks, goals] = await Promise.all([
        Task.findAll({
            where: { user_id: userId, status: { [Op.notIn]: [2, 3, 5] } },
            attributes: ['uid', 'name'],
            raw: true,
        }),
        Goal.findAll({
            where: { user_id: userId, status: 'active' },
            attributes: ['uid', 'title'],
            raw: true,
        }),
    ]);
    return { tasks: tasks.map((t) => ({ uid: t.uid, title: t.name })), goals };
}
async function list(userId) {
    return LtdAiRun.findAll({
        where: { user_id: userId },
        order: [['id', 'DESC']],
        limit: 100,
    });
}
async function get(userId, id) {
    const run = await LtdAiRun.findOne({ where: { user_id: userId, id } });
    if (!run) throw new NotFoundError('Run not found');
    return run;
}
async function saveReview(user, body) {
    const { summary, question } = schemas.review.parse(body.text);
    if (body.confirm !== true)
        throw new ForbiddenError('Confirm before saving');
    const { CAPABILITIES } = require('../ltd-capabilities/catalog');
    const capture = CAPABILITIES.find((c) => c.name === 'capture');
    return capture.handler(
        { text: `${summary}\n\n${question}` },
        { userId: user.id, actor: { user_id: user.id, actor_type: 'user' } }
    );
}
module.exports = {
    targets,
    preview,
    generate,
    compile,
    schemas,
    list,
    get,
    saveReview,
};
