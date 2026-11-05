'use strict';

const moment = require('moment-timezone');
const { Op } = require('sequelize');
const { Webhook, User, Task } = require('../../models');
const {
    getSafeTimezone,
    getDayBoundsInUTC,
} = require('../../utils/timezone-utils');
const { logError } = require('../../services/logService');
const dispatcher = require('./dispatcher');
const { taskPayload } = require('./taskEvents');

const MAX_PER_SECTION = 50;
const OPEN_STATUSES_EXCLUDED = [
    Task.STATUS.DONE,
    Task.STATUS.ARCHIVED,
    Task.STATUS.CANCELLED,
];

async function findTasks(userId, where) {
    return Task.findAll({
        where: {
            user_id: userId,
            habit_mode: { [Op.not]: true },
            status: { [Op.notIn]: OPEN_STATUSES_EXCLUDED },
            ...where,
        },
        order: [
            ['due_date', 'ASC'],
            ['priority', 'DESC'],
            ['id', 'ASC'],
        ],
        limit: MAX_PER_SECTION,
    });
}

// Today's open work for one user, in their timezone: what is overdue, what
// is due today and what is in progress.
async function buildSummary(user, now = new Date()) {
    const timezone = getSafeTimezone(user.timezone);
    const date = moment.tz(now, timezone).format('YYYY-MM-DD');
    const { start, end } = getDayBoundsInUTC(date, timezone);

    const [overdue, dueToday, inProgress] = await Promise.all([
        findTasks(user.id, { due_date: { [Op.lt]: start } }),
        findTasks(user.id, { due_date: { [Op.gte]: start, [Op.lte]: end } }),
        findTasks(user.id, { status: Task.STATUS.IN_PROGRESS }),
    ]);

    const serialize = (tasks) => Promise.all(tasks.map(taskPayload));
    const data = {
        date,
        timezone,
        overdue: await serialize(overdue),
        due_today: await serialize(dueToday),
        in_progress: await serialize(inProgress),
    };

    const lines = [
        `Today: ${dueToday.length} due, ${overdue.length} overdue, ${inProgress.length} in progress`,
    ];
    const section = (title, tasks) => {
        if (tasks.length === 0) return;
        lines.push('', title, ...tasks.map((task) => `- ${task.name}`));
    };
    section('Overdue', overdue);
    section('Due today', dueToday);
    section('In progress', inProgress);

    return { text: lines.join('\n'), data };
}

// Runs every few minutes from the task scheduler. Each webhook that wants
// the daily summary gets it once per local day, during its summary hour.
async function sendDueSummaries({ now = new Date() } = {}) {
    const hooks = await Webhook.findAll({
        where: { enabled: true },
        attributes: [
            'id',
            'user_id',
            'events',
            'summary_hour',
            'last_summary_on',
        ],
        include: [
            {
                model: User,
                as: 'User',
                attributes: ['id', 'timezone'],
            },
        ],
    });

    let sent = 0;
    for (const hook of hooks) {
        if (!Array.isArray(hook.events)) continue;
        if (!hook.events.includes('daily_summary')) continue;
        if (!hook.User) continue;

        const local = moment.tz(now, getSafeTimezone(hook.User.timezone));
        const today = local.format('YYYY-MM-DD');
        if (local.hour() !== hook.summary_hour) continue;
        if (hook.last_summary_on === today) continue;

        try {
            // Mark first, so a failure is not retried every few minutes.
            await hook.update({ last_summary_on: today });
            const summary = await buildSummary(hook.User, now);
            const queued = await dispatcher.emit(
                hook.user_id,
                'daily_summary',
                { ...summary, webhookIds: [hook.id] }
            );
            sent += queued.length;
        } catch (error) {
            logError(`Failed to send webhook summary ${hook.id}:`, error);
        }
    }
    return { summariesQueued: sent };
}

module.exports = { buildSummary, sendDueSummaries };
