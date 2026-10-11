'use strict';

// Life-to-Day (T-502): single-task Focus sessions. Elapsed time is always
// derived from started_at and the clock, never from a client counter.
const { LtdFocusSession, Task } = require('../../models');
const permissionsService = require('../../services/permissionsService');
const { Op } = require('sequelize');
const { ValidationError, NotFoundError } = require('../../shared/errors');

const MIN_PLANNED = 1;
const MAX_PLANNED = 240;
const DEFAULT_PLANNED = 25;
const MAX_NOTE = 2000;

async function visibleTask(userId, uid) {
    if (typeof uid !== 'string' || !uid) {
        throw new ValidationError('task_uid is required');
    }
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
        attributes: ['id', 'uid', 'name', 'starter_step'],
    });
    if (!task) throw new NotFoundError('Task not found');
    return task;
}

function serialize(session, task) {
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
    };
}

async function findOwn(userId, uid) {
    const session = await LtdFocusSession.findOne({
        where: { uid, user_id: userId },
        include: [
            {
                model: Task,
                as: 'Task',
                attributes: ['id', 'uid', 'name', 'starter_step'],
            },
        ],
    });
    if (!session) throw new NotFoundError('Focus session not found');
    return session;
}

// Starting closes any session still open, so there is one running Focus.
async function start(userId, body, now = new Date()) {
    const task = await visibleTask(userId, body?.task_uid);
    const planned =
        body?.planned_minutes === undefined
            ? DEFAULT_PLANNED
            : body.planned_minutes;
    if (
        !Number.isInteger(planned) ||
        planned < MIN_PLANNED ||
        planned > MAX_PLANNED
    ) {
        throw new ValidationError(
            `planned_minutes must be between ${MIN_PLANNED} and ${MAX_PLANNED}`
        );
    }
    const open = await LtdFocusSession.findAll({
        where: { user_id: userId, ended_at: null },
    });
    for (const session of open) await finish(session, now, false, null);
    const session = await LtdFocusSession.create({
        user_id: userId,
        task_id: task.id,
        started_at: now,
        planned_minutes: planned,
    });
    return serialize(session, task);
}

function elapsedMinutes(session, now) {
    return Math.max(
        0,
        Math.round(
            (now.getTime() - new Date(session.started_at).getTime()) / 60000
        )
    );
}

async function finish(session, now, interrupted, note) {
    await session.update({
        ended_at: now,
        actual_minutes: elapsedMinutes(session, now),
        interrupted,
        resume_note: note,
    });
    return session;
}

// End or interrupt. An interruption keeps a "where was I?" note.
async function end(userId, uid, body, now = new Date()) {
    const session = await findOwn(userId, uid);
    if (session.ended_at) {
        throw new ValidationError('This Focus session has already ended');
    }
    const interrupted = body?.interrupted === true;
    let note = null;
    if (body?.resume_note !== undefined && body.resume_note !== null) {
        if (typeof body.resume_note !== 'string') {
            throw new ValidationError('resume_note must be text');
        }
        note = body.resume_note.trim().slice(0, MAX_NOTE) || null;
    }
    await finish(session, now, interrupted, note);
    return serialize(session, session.Task);
}

// What Today offers to resume: the latest session, when it is still
// running or was interrupted and its task is still open. A resumed session
// is newer than the interruption, so that one is not offered again.
async function current(userId) {
    const session = await LtdFocusSession.findOne({
        where: { user_id: userId },
        include: [
            {
                model: Task,
                as: 'Task',
                attributes: ['id', 'uid', 'name', 'starter_step', 'status'],
            },
        ],
        order: [['started_at', 'DESC']],
    });
    if (!session || !session.Task) return null;
    if (session.ended_at && !session.interrupted) return null;
    if ([Task.STATUS.DONE, Task.STATUS.ARCHIVED].includes(session.Task.status))
        return null;
    return serialize(session, session.Task);
}

// Resume opens a new session on the same task and carries the note on.
async function resume(userId, uid, now = new Date()) {
    const previous = await findOwn(userId, uid);
    if (!previous.Task) throw new NotFoundError('Task not found');
    const next = await start(
        userId,
        {
            task_uid: previous.Task.uid,
            planned_minutes: previous.planned_minutes,
        },
        now
    );
    if (previous.resume_note) {
        await LtdFocusSession.update(
            { resume_note: previous.resume_note },
            { where: { uid: next.uid } }
        );
        next.resume_note = previous.resume_note;
    }
    return next;
}

module.exports = { start, end, current, resume, elapsedMinutes };
