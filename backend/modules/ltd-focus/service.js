'use strict';
// Life-to-Day (T-502, T-1201): one task, one session table, server timestamps.
const { LtdFocusSession, Task, User, sequelize } = require('../../models');
const permissionsService = require('../../services/permissionsService');
const { Op, Transaction } = require('sequelize');
const moment = require('moment-timezone');
const {
    getSafeTimezone,
    getDayBoundsInUTC,
} = require('../../utils/timezone-utils');
const {
    ValidationError,
    NotFoundError,
    ConflictError,
} = require('../../shared/errors');
const rules = require('./rules');
const MAX_NOTE = 2000;
const taskAttributes = [
    'id',
    'uid',
    'name',
    'starter_step',
    'status',
    'focus_minutes',
    'estimated_minutes',
];
const includeTask = [{ model: Task, as: 'Task', attributes: taskAttributes }];
const readSettings = (user) => {
    const raw =
        typeof user.ui_settings === 'string'
            ? JSON.parse(user.ui_settings || '{}')
            : user.ui_settings || {};
    return raw;
};
async function getSettings(userId) {
    return rules.settings(readSettings(await User.findByPk(userId)).pomodoro);
}
async function saveSettings(userId, body) {
    for (const key of [
        'focus_minutes',
        'short_break_minutes',
        'long_break_minutes',
    ])
        if (body[key] !== undefined) rules.parseLength(body[key]);
    if (
        body.long_every !== undefined &&
        (!Number.isInteger(body.long_every) ||
            body.long_every < 1 ||
            body.long_every > 12)
    )
        throw new ValidationError('long_every must be 1 to 12');
    if (body.sound !== undefined && typeof body.sound !== 'boolean')
        throw new ValidationError('sound must be boolean');
    return exclusive(userId, async (transaction, user) => {
        const raw = readSettings(user);
        const next = rules.settings({ ...raw.pomodoro, ...body });
        await user.update(
            { ui_settings: { ...raw, pomodoro: next } },
            { transaction }
        );
        return next;
    });
}
async function visibleTask(userId, uid, transaction) {
    if (typeof uid !== 'string' || !uid)
        throw new ValidationError('task_uid is required');
    const task = await Task.findOne({
        where: {
            [Op.and]: [
                await permissionsService.ownershipOrPermissionWhere(
                    'task',
                    userId
                ),
                { uid },
            ],
        },
        attributes: taskAttributes,
        transaction,
    });
    if (!task) throw new NotFoundError('Task not found');
    return task;
}
function serialize(session, task, now = new Date()) {
    return {
        uid: session.uid,
        task_uid: task?.uid ?? null,
        task_name: task?.name ?? null,
        starter_step: task?.starter_step ?? null,
        started_at: new Date(session.started_at).toISOString(),
        ended_at: session.ended_at
            ? new Date(session.ended_at).toISOString()
            : null,
        planned_minutes: session.planned_minutes,
        actual_minutes: session.actual_minutes,
        interrupted: !!session.interrupted,
        resume_note: session.resume_note,
        server_now: now.toISOString(),
    };
}
async function findOwn(userId, uid, transaction) {
    const s = await LtdFocusSession.findOne({
        where: { uid, user_id: userId },
        include: includeTask,
        transaction,
    });
    if (!s) throw new NotFoundError('Focus session not found');
    return s;
}
// Serialize writes per user on both PostgreSQL and SQLite, including manual overlap checks.
async function exclusive(userId, fn) {
    return sequelize.transaction(
        { type: Transaction.TYPES.IMMEDIATE },
        async (transaction) => {
            const user = await User.findByPk(userId, {
                transaction,
                lock: transaction.LOCK.UPDATE,
            });
            return fn(transaction, user);
        }
    );
}
const bellAt = (s) =>
    new Date(new Date(s.started_at).getTime() + s.planned_minutes * 60000);
const abandoned = (s, now) =>
    !s.ended_at && now.getTime() > bellAt(s).getTime() + 120 * 60000;
function elapsedMinutes(session, now) {
    return Math.max(
        0,
        Math.round(
            (now.getTime() - new Date(session.started_at).getTime()) / 60000
        )
    );
}
async function finish(s, at, interrupted, note, transaction) {
    await s.update(
        {
            ended_at: at,
            actual_minutes: elapsedMinutes(s, at),
            interrupted,
            resume_note: note,
        },
        { transaction }
    );
}
async function start(userId, body, now = new Date()) {
    // Legacy callers can send a length, but it cannot override the task rule.
    if (body?.planned_minutes !== undefined)
        rules.parseLength(body.planned_minutes);
    return exclusive(userId, async (transaction, user) => {
        const task = await visibleTask(userId, body?.task_uid, transaction);
        const open = await LtdFocusSession.findOne({
            where: { user_id: userId, ended_at: null },
            transaction,
        });
        if (open) {
            if (abandoned(open, now))
                await finish(open, bellAt(open), false, null, transaction);
            else throw new ConflictError('A Focus session is already open');
        }
        const s = await LtdFocusSession.create(
            {
                user_id: userId,
                task_id: task.id,
                started_at: now,
                planned_minutes: rules.length(
                    task,
                    readSettings(user).pomodoro
                ),
            },
            { transaction }
        );
        return serialize(s, task, now);
    });
}
function timestamp(value, name) {
    if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    )
        throw new ValidationError(
            `${name} must be an ISO timestamp with timezone`
        );
    const at = new Date(value);
    if (!Number.isFinite(at.getTime()))
        throw new ValidationError(`${name} is invalid`);
    return at;
}
async function end(userId, uid, body = {}, now = new Date()) {
    return exclusive(userId, async (transaction) => {
        const s = await findOwn(userId, uid, transaction);
        if (s.ended_at) return serialize(s, s.Task, now); // another tab may have ended it
        let at =
            body?.ended_at === undefined
                ? now
                : timestamp(body.ended_at, 'ended_at');
        if (at > now || at < new Date(s.started_at))
            throw new ValidationError(
                'ended_at must be between started_at and now'
            );
        let note = null;
        if (body?.resume_note != null) {
            if (typeof body.resume_note !== 'string')
                throw new ValidationError('resume_note must be text');
            note = body.resume_note.trim().slice(0, MAX_NOTE) || null;
        }
        const autoClosed = abandoned(s, now);
        if (autoClosed) at = bellAt(s);
        await finish(
            s,
            at,
            !autoClosed && body?.interrupted === true,
            note,
            transaction
        );
        return {
            ...serialize(s, s.Task, now),
            ...(autoClosed ? { auto_closed: true } : {}),
        };
    });
}
async function current(userId, now = new Date()) {
    return exclusive(userId, async (transaction) => {
        // Open sessions win over newer manual entries.
        let s = await LtdFocusSession.findOne({
            where: { user_id: userId, ended_at: null },
            include: includeTask,
            transaction,
        });
        if (s && abandoned(s, now)) {
            await finish(s, bellAt(s), false, null, transaction);
            return { ...serialize(s, s.Task, now), auto_closed: true };
        }
        if (s) return serialize(s, s.Task, now);
        s = await LtdFocusSession.findOne({
            where: { user_id: userId },
            include: includeTask,
            order: [['started_at', 'DESC']],
            transaction,
        });
        if (
            !s?.Task ||
            !s.interrupted ||
            [Task.STATUS.DONE, Task.STATUS.ARCHIVED].includes(s.Task.status)
        )
            return null;
        return serialize(s, s.Task, now);
    });
}
async function resume(userId, uid, now = new Date()) {
    const previous = await findOwn(userId, uid);
    if (!previous.Task) throw new NotFoundError('Task not found');
    if (!previous.ended_at) return serialize(previous, previous.Task, now);
    const next = await start(userId, { task_uid: previous.Task.uid }, now);
    if (previous.resume_note) {
        await LtdFocusSession.update(
            { resume_note: previous.resume_note },
            { where: { uid: next.uid, user_id: userId } }
        );
        next.resume_note = previous.resume_note;
    }
    return next;
}
async function manual(userId, body, now = new Date()) {
    const from = timestamp(body?.started_at, 'started_at');
    const to = timestamp(body?.ended_at, 'ended_at');
    const duration = (to - from) / 60000;
    if (
        duration < 1 ||
        duration > 240 ||
        to > now ||
        from < new Date(now.getTime() - 7 * 86400000)
    )
        throw new ValidationError(
            'Manual time must be 1 to 240 minutes, within the last seven days and not in the future'
        );
    return exclusive(userId, async (transaction, user) => {
        const task = await visibleTask(userId, body.task_uid, transaction);
        const overlap = await LtdFocusSession.findOne({
            where: {
                user_id: userId,
                started_at: { [Op.lt]: to },
                [Op.or]: [{ ended_at: null }, { ended_at: { [Op.gt]: from } }],
            },
            transaction,
        });
        if (overlap) throw new ConflictError('Focus sessions cannot overlap');
        const s = await LtdFocusSession.create(
            {
                user_id: userId,
                task_id: task.id,
                started_at: from,
                ended_at: to,
                planned_minutes: rules.length(
                    task,
                    readSettings(user).pomodoro
                ),
                actual_minutes: Math.round(duration),
                interrupted: false,
            },
            { transaction }
        );
        return serialize(s, task, now);
    });
}
async function summary(userId, uids) {
    if (typeof uids !== 'string')
        throw new ValidationError('task_uids is required');
    const list = uids.split(',').filter(Boolean);
    if (list.length > 100) throw new ValidationError('At most 100 task_uids');
    const tasks = await Task.findAll({
        where: {
            [Op.and]: [
                await permissionsService.ownershipOrPermissionWhere(
                    'task',
                    userId
                ),
                { uid: { [Op.in]: list } },
            ],
        },
        attributes: taskAttributes,
    });
    const [prefs, sessions] = await Promise.all([
        getSettings(userId),
        LtdFocusSession.findAll({
            where: {
                user_id: userId,
                task_id: { [Op.in]: tasks.map((t) => t.id) },
                ended_at: { [Op.ne]: null },
            },
        }),
    ]);
    return Object.fromEntries(
        tasks.map((task) => {
            const minutes = rules.length(task, prefs);
            return [
                task.uid,
                {
                    ...rules.totals(
                        sessions.filter((s) => s.task_id === task.id)
                    ),
                    target_count: rules.target(task.estimated_minutes, minutes),
                    length_minutes: minutes,
                },
            ];
        })
    );
}
async function today(userId, now = new Date()) {
    const user = await User.findByPk(userId);
    const timezone = getSafeTimezone(user.timezone);
    const bounds = getDayBoundsInUTC(
        moment(now).tz(timezone).format('YYYY-MM-DD'),
        timezone
    );
    const sessions = await LtdFocusSession.findAll({
        where: {
            user_id: userId,
            ended_at: { [Op.ne]: null },
            started_at: { [Op.gte]: bounds.start, [Op.lt]: bounds.end },
        },
    });
    return rules.totals(sessions);
}
module.exports = {
    start,
    end,
    current,
    resume,
    manual,
    summary,
    today,
    getSettings,
    saveSettings,
    elapsedMinutes,
};
