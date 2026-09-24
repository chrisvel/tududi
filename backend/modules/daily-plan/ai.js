'use strict';

const moment = require('moment-timezone');
const { Op } = require('sequelize');
const { User, Task, Project } = require('../../models');
const ai = require('../ai-assistant/service');
const entitlements = require('../../services/entitlementsService');
const permissionsService = require('../../services/permissionsService');
const calendarFeedsService = require('../calendar-feeds/service');
const dailyPlanService = require('./service');
const repository = require('./repository');
const slots = require('./slots');
const { getSafeTimezone } = require('../../utils/timezone-utils');
const { ForbiddenError, ValidationError } = require('../../shared/errors');

const MAX_CANDIDATES = 60;
const MAX_DRAFT_ITEMS = 20;
const MAX_ESTIMATE_BATCH = 40;
const DEFAULT_DURATION = 30;
const ESTIMATE_TTL_MS = 24 * 60 * 60 * 1000;
const PRIORITY_LABELS = { 0: 'low', 1: 'medium', 2: 'high' };
const STATUS_LABELS = {
    0: 'not started',
    1: 'in progress',
    2: 'done',
    3: 'archived',
    4: 'waiting',
    5: 'cancelled',
    6: 'planned',
};

// AI planning follows the same per-user switch as the rest of the AI
// assistant (Profile -> Features). The UI hides everything when it is off;
// this keeps the API honest too.
async function assertAiEnabled(userId) {
    const user = await User.findByPk(userId, {
        attributes: ['id', 'features', 'ai_profile', 'timezone'],
    });
    let features = user?.features;
    if (typeof features === 'string') {
        try {
            features = JSON.parse(features);
        } catch {
            features = null;
        }
    }
    if (!features || features.ai_assistant_enabled !== true) {
        throw new ForbiddenError(
            'Turn on the AI assistant in Profile to get AI help with planning.'
        );
    }
    return user;
}

async function chargeForCall(userId) {
    await entitlements.consumeUsage(userId, 'ai_requests');
    await entitlements.consumeMonthlyUsage(userId, 'ai_credits');
}

// Budgets are generous on purpose: reasoning models spend most of them
// thinking before the JSON starts, and a cut-off answer parses to nothing.
async function askModel(userId, { name, system, user, schema, maxTokens }) {
    const client = await ai.getOpenAIClient(userId);
    const response = await ai.callWithFallback(client, userId, {
        model: await ai.getAIModel(userId),
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
        ],
        max_tokens: maxTokens,
        ...ai.getExtraBodyParams(),
        response_format: ai.buildResponseFormat(name, schema),
    });
    const raw = ai.extractMessageContent(response.choices[0]?.message);
    try {
        return JSON.parse(ai.extractJSON(raw));
    } catch {
        return {};
    }
}

function nowMinute(timezone, date) {
    const now = moment.tz(timezone);
    if (now.format('YYYY-MM-DD') === date) {
        return now.hours() * 60 + now.minutes();
    }
    // Planning a future day: the whole day is open; a past day: none of it.
    return now.format('YYYY-MM-DD') < date ? 0 : slots.MINUTES_PER_DAY;
}

function describeTask(task, date) {
    const due = task.due_date ? String(task.due_date).slice(0, 10) : null;
    const overdueDays =
        due && due < date ? moment(date).diff(moment(due), 'days') : 0;
    return {
        uid: task.uid,
        name: task.name,
        project: task.Project?.name || null,
        goal: task.Goal?.title || null,
        priority: PRIORITY_LABELS[task.priority] || task.priority || 'none',
        status: STATUS_LABELS[task.status] || task.status,
        due,
        overdue_days: overdueDays,
        estimate_minutes: task.estimated_minutes || null,
    };
}

const clampDuration = (value, fallback) => {
    const minutes = Number.isFinite(value) ? slots.snap(value) : fallback;
    return Math.max(slots.SLOT_MINUTES, Math.min(720, minutes || fallback));
};

// Turns whatever the model proposed into a plan the planner can apply:
// only known, not-yet-planned tasks; 15-minute grid; nothing in the past,
// on top of a busy meeting or on top of another block. A clash moves to
// the next free slot, or drops the time when the day is full.
function sanitizeDraft({ proposed, pool, existing, events, now }) {
    const accepted = [];
    const seen = new Set(existing.map((item) => item.task_uid));
    const range = slots.dayRange(existing, events);
    const earliest = Math.max(now, 0);

    for (const entry of Array.isArray(proposed) ? proposed : []) {
        if (accepted.length >= MAX_DRAFT_ITEMS) break;
        const uid = entry?.task_uid;
        const task = uid ? pool.get(uid) : null;
        if (!task || seen.has(uid)) continue;
        seen.add(uid);

        const duration = clampDuration(
            Number(entry.duration_minutes),
            task.estimated_minutes || DEFAULT_DURATION
        );
        const spans = slots.blockedSpans([...existing, ...accepted], events);

        let start = null;
        const wanted = Number(entry.start_minute);
        if (entry.start_minute !== null && Number.isFinite(wanted)) {
            const snapped = slots.snap(wanted);
            const fits =
                snapped >= earliest &&
                snapped + duration <= slots.MINUTES_PER_DAY &&
                !slots.overlaps(spans, snapped, duration);
            start = fits
                ? snapped
                : slots.findFreeSlot(
                      spans,
                      duration,
                      range,
                      Math.max(earliest, snapped)
                  );
        }

        accepted.push({
            task_uid: uid,
            start_minute: start,
            duration_minutes: duration,
            reason: typeof entry.reason === 'string' ? entry.reason : '',
        });
    }

    return accepted;
}

const DRAFT_SCHEMA = {
    type: 'object',
    properties: {
        summary: { type: 'string' },
        items: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    task_uid: { type: 'string' },
                    start_minute: { type: ['integer', 'null'] },
                    duration_minutes: { type: 'integer' },
                    reason: { type: 'string' },
                },
                required: [
                    'task_uid',
                    'start_minute',
                    'duration_minutes',
                    'reason',
                ],
                additionalProperties: false,
            },
        },
        skipped: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    task_uid: { type: 'string' },
                    reason: { type: 'string' },
                },
                required: ['task_uid', 'reason'],
                additionalProperties: false,
            },
        },
    },
    required: ['summary', 'items', 'skipped'],
    additionalProperties: false,
};

const hhmm = (minute) =>
    `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

async function loadDayEvents(user, date) {
    try {
        const day = await calendarFeedsService.eventsForDay(user, date);
        return day.events;
    } catch {
        return [];
    }
}

async function draftDay(userId, { date, mode = 'fill' } = {}) {
    const user = await assertAiEnabled(userId);
    if (!['fill', 'replace'].includes(mode)) {
        throw new ValidationError('mode must be fill or replace');
    }
    const timezone = getSafeTimezone(user.timezone);
    const planDate = dailyPlanService.resolvePlanDate(date, timezone);
    const fullUser = { id: userId, timezone };

    const [{ plan }, candidates, events] = await Promise.all([
        dailyPlanService.getPlan(fullUser, planDate),
        dailyPlanService.getCandidates(fullUser),
        loadDayEvents(fullUser, planDate),
    ]);
    const planned = plan?.items || [];
    const existing = mode === 'fill' ? planned : [];
    const now = nowMinute(timezone, planDate);

    const pool = new Map();
    const addToPool = (task) => {
        if (!task?.uid || pool.size >= MAX_CANDIDATES) return;
        if (existing.some((item) => item.task_uid === task.uid)) return;
        if (!pool.has(task.uid)) pool.set(task.uid, task);
    };
    if (mode === 'replace') planned.forEach((item) => addToPool(item.task));
    [
        candidates.overdue,
        candidates.due_today,
        candidates.in_progress,
        candidates.suggested,
    ].forEach((list) => list.forEach(addToPool));

    if (pool.size === 0) {
        return { date: planDate, mode, summary: '', items: [], skipped: [] };
    }

    const range = slots.dayRange(existing, events);
    const spans = slots.blockedSpans(existing, events);
    const gaps = slots.freeGaps(spans, range, now);

    const context = [
        `Date: ${planDate}. Current time: ${now >= slots.MINUTES_PER_DAY ? 'day is over' : hhmm(Math.min(now, 1439))}.`,
        user.ai_profile ? `About the user: ${user.ai_profile}` : '',
        '',
        'Busy calendar events (cannot schedule over these):',
        ...events
            .filter((e) => !e.all_day && e.busy && e.start_minute !== null)
            .map(
                (e) =>
                    `- ${hhmm(e.start_minute)}-${hhmm(e.end_minute ?? e.start_minute)} ${e.title}`
            ),
        '',
        'Already planned (keep as is):',
        ...existing.map(
            (item) =>
                `- ${item.start_minute !== null ? hhmm(item.start_minute) : 'anytime'} ${item.duration_minutes}m ${item.task.name}`
        ),
        '',
        'Free gaps (minutes after midnight):',
        ...gaps.map(
            (g) => `- ${g.start}-${g.end} (${hhmm(g.start)}-${hhmm(g.end)})`
        ),
        '',
        'Candidate tasks (JSON, one per line):',
        ...[...pool.values()].map((task) =>
            JSON.stringify(describeTask(task, planDate))
        ),
    ]
        .filter((line) => line !== null)
        .join('\n');

    await chargeForCall(userId);

    const parsed = await askModel(userId, {
        name: 'day_plan_draft',
        maxTokens: ai.getMaxTokens('LLM_MAX_TOKENS_DAY_PLAN', 6000),
        schema: DRAFT_SCHEMA,
        system: `You plan one person's day in Tududi. Pick a realistic set of tasks for the free time and place them.

Rules:
- Only use task_uid values from the candidate list.
- start_minute is minutes after midnight on the 15-minute grid, inside a free gap and not before the current time; use null for a task that should be done today but has no good slot.
- duration_minutes: use the task's estimate when given, otherwise a realistic guess (15, 30, 60, 90 or 120 typical).
- Do not fill every minute: leave short breaks, and do not plan more than the free time allows.
- Prefer overdue and due-today tasks, high priority, and tasks tied to goals; group similar small tasks; put demanding work earlier.
- reason: at most 8 words, specific to the task (e.g. "Due today, 15 minutes fits before Work").
- summary: at most 20 words describing the shape of the day.
- skipped: up to 5 notable candidates left out, with a short reason.
- Plain text, no markdown. Return only the JSON object.`,
        user: context,
    });

    const items = sanitizeDraft({
        proposed: parsed.items,
        pool,
        existing,
        events,
        now,
    }).map((item) => ({ ...item, task: pool.get(item.task_uid) }));

    const skipped = (Array.isArray(parsed.skipped) ? parsed.skipped : [])
        .filter((s) => s && pool.has(s.task_uid))
        .slice(0, 5)
        .map((s) => ({
            task_uid: s.task_uid,
            name: pool.get(s.task_uid).name,
            reason: typeof s.reason === 'string' ? s.reason : '',
        }));

    return {
        date: planDate,
        mode,
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
        items,
        skipped,
    };
}

// Estimates are cached per process: reopening the planner should not spend
// another credit on the same tasks.
const estimateCache = new Map();

const estimateKey = (userId, task) => `${userId}:${task.uid}:${task.name}`;

function sanitizeEstimate(value) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes <= 0) return null;
    return Math.max(15, Math.min(240, slots.snap(minutes)));
}

async function estimateTasks(userId, taskUids) {
    await assertAiEnabled(userId);
    if (
        !Array.isArray(taskUids) ||
        taskUids.some((u) => typeof u !== 'string')
    ) {
        throw new ValidationError('task_uids must be a list of task uids');
    }
    const uids = [...new Set(taskUids)].slice(0, MAX_ESTIMATE_BATCH);
    if (uids.length === 0) return { estimates: [] };

    const visibleWhere = await permissionsService.ownershipOrPermissionWhere(
        'task',
        userId
    );
    const tasks = await Task.findAll({
        where: { [Op.and]: [visibleWhere, { uid: { [Op.in]: uids } }] },
        attributes: ['uid', 'name', 'note'],
        include: [{ model: Project, attributes: ['name'], required: false }],
    });

    const now = Date.now();
    const results = new Map();
    const missing = [];
    for (const task of tasks) {
        const cached = estimateCache.get(estimateKey(userId, task));
        if (cached && now - cached.at < ESTIMATE_TTL_MS) {
            results.set(task.uid, cached.minutes);
        } else {
            missing.push(task);
        }
    }

    if (missing.length > 0) {
        await chargeForCall(userId);
        const parsed = await askModel(userId, {
            name: 'task_estimates',
            maxTokens: ai.getMaxTokens('LLM_MAX_TOKENS_ESTIMATES', 4000),
            schema: {
                type: 'object',
                properties: {
                    estimates: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                task_uid: { type: 'string' },
                                minutes: { type: 'integer' },
                            },
                            required: ['task_uid', 'minutes'],
                            additionalProperties: false,
                        },
                    },
                },
                required: ['estimates'],
                additionalProperties: false,
            },
            system: `Estimate how long each task takes one focused person, in minutes. Use 15, 30, 45, 60, 90, 120, 180 or 240. Be realistic, not optimistic: errands and calls are short, research and writing take longer. Return only the JSON object with one entry per task_uid given.`,
            user: missing
                .map((task) =>
                    JSON.stringify({
                        task_uid: task.uid,
                        name: task.name,
                        project: task.Project?.name || null,
                        note: task.note
                            ? String(task.note).slice(0, 200)
                            : null,
                    })
                )
                .join('\n'),
        });

        const byUid = new Map(missing.map((task) => [task.uid, task]));
        for (const entry of Array.isArray(parsed.estimates)
            ? parsed.estimates
            : []) {
            const task = byUid.get(entry?.task_uid);
            const minutes = sanitizeEstimate(entry?.minutes);
            if (!task || minutes === null) continue;
            results.set(task.uid, minutes);
            estimateCache.set(estimateKey(userId, task), { minutes, at: now });
        }
    }

    return {
        estimates: [...results.entries()].map(([task_uid, minutes]) => ({
            task_uid,
            minutes,
        })),
    };
}

const WRAP_UP_SCHEMA = {
    type: 'object',
    properties: {
        summary: { type: 'string' },
        wins: { type: 'array', items: { type: 'string' } },
        carry_over: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    task_uid: { type: 'string' },
                    reason: { type: 'string' },
                },
                required: ['task_uid', 'reason'],
                additionalProperties: false,
            },
        },
        pattern: { type: 'string' },
    },
    required: ['summary', 'wins', 'carry_over', 'pattern'],
    additionalProperties: false,
};

const isDone = (task) => task?.status === 2 || task?.status === 'done';

async function wrapUpDay(userId, date) {
    const user = await assertAiEnabled(userId);
    const timezone = getSafeTimezone(user.timezone);
    const planDate = dailyPlanService.resolvePlanDate(date, timezone);
    const fullUser = { id: userId, timezone };

    const [{ plan }, events] = await Promise.all([
        dailyPlanService.getPlan(fullUser, planDate),
        loadDayEvents(fullUser, planDate),
    ]);
    if (!plan || plan.items.length === 0) {
        throw new ValidationError('There is no plan for this day to wrap up');
    }
    const now = nowMinute(timezone, planDate);

    const lines = plan.items.map((item) => {
        const when =
            item.start_minute !== null
                ? `${hhmm(item.start_minute)} ${item.duration_minutes}m`
                : `anytime ${item.duration_minutes}m`;
        const late =
            item.start_minute !== null &&
            item.start_minute + item.duration_minutes <= now &&
            !isDone(item.task);
        const state = isDone(item.task)
            ? 'done'
            : late
              ? 'missed its slot'
              : 'not done';
        return JSON.stringify({
            task_uid: item.task_uid,
            name: item.task.name,
            project: item.task.Project?.name || null,
            planned: when,
            state,
        });
    });

    await chargeForCall(userId);

    const parsed = await askModel(userId, {
        name: 'day_wrap_up',
        maxTokens: ai.getMaxTokens('LLM_MAX_TOKENS_WRAP_UP', 3000),
        schema: WRAP_UP_SCHEMA,
        system: `You close out someone's day in Tududi, kindly and honestly.
- summary: at most 25 words on how the day went against the plan.
- wins: 0 to 3 short items (at most 8 words each) naming what got done.
- carry_over: unfinished tasks worth doing tomorrow, using task_uid values from the list, each with a reason of at most 8 words. Leave out tasks that look optional.
- pattern: at most 20 words on one useful pattern (e.g. morning blocks slipped, overplanned by 2h), or an empty string.
Plain text, no markdown. Return only the JSON object.`,
        user: [
            `Date: ${planDate}.`,
            user.ai_profile ? `About the user: ${user.ai_profile}` : '',
            'Meetings:',
            ...events
                .filter((e) => !e.all_day && e.start_minute !== null)
                .map(
                    (e) =>
                        `- ${hhmm(e.start_minute)}-${hhmm(e.end_minute ?? e.start_minute)} ${e.title}`
                ),
            'Planned tasks:',
            ...lines,
        ].join('\n'),
    });

    const openUids = new Set(
        plan.items
            .filter((item) => !isDone(item.task))
            .map((item) => item.task_uid)
    );
    const nameByUid = new Map(
        plan.items.map((item) => [item.task_uid, item.task.name])
    );
    const wrapUp = {
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
        wins: (Array.isArray(parsed.wins) ? parsed.wins : [])
            .filter((w) => typeof w === 'string')
            .slice(0, 3),
        carry_over: (Array.isArray(parsed.carry_over) ? parsed.carry_over : [])
            .filter((c) => c && openUids.has(c.task_uid))
            .map((c) => ({
                task_uid: c.task_uid,
                name: nameByUid.get(c.task_uid),
                reason: typeof c.reason === 'string' ? c.reason : '',
            })),
        pattern: typeof parsed.pattern === 'string' ? parsed.pattern : '',
        generated_at: new Date().toISOString(),
    };

    await repository.saveWrapUp(userId, planDate, wrapUp);
    return { date: planDate, wrap_up: wrapUp };
}

function clearEstimateCache() {
    estimateCache.clear();
}

module.exports = {
    assertAiEnabled,
    sanitizeDraft,
    sanitizeEstimate,
    draftDay,
    estimateTasks,
    wrapUpDay,
    clearEstimateCache,
};
