'use strict';

const { Task, Project } = require('../../models');
const { getConfig } = require('../../config/config');
const { logError } = require('../../services/logService');
const dispatcher = require('./dispatcher');

const STATUS_NAMES = Object.fromEntries(
    Object.entries(Task.STATUS).map(([name, value]) => [
        value,
        name.toLowerCase(),
    ])
);
const PRIORITY_NAMES = ['low', 'medium', 'high'];

// Fields whose change is worth a task.updated event. Ordering, reminder
// bookkeeping and the like change all the time and mean nothing outside.
const WATCHED_FIELDS = [
    'name',
    'note',
    'status',
    'priority',
    'due_date',
    'due_has_time',
    'defer_until',
    'reminder_at',
    'project_id',
    'parent_task_id',
    'estimated_minutes',
];

const iso = (value) => (value ? new Date(value).toISOString() : null);

async function uidOf(model, id) {
    if (!id) return null;
    const row = await model.findByPk(id, { attributes: ['uid'] });
    return row?.uid || null;
}

async function taskPayload(task) {
    return {
        uid: task.uid,
        name: task.name,
        note: task.note || null,
        status: STATUS_NAMES[task.status] || null,
        priority: PRIORITY_NAMES[task.priority] || null,
        due_date: iso(task.due_date),
        due_has_time: !!task.due_has_time,
        defer_until: iso(task.defer_until),
        completed_at: iso(task.completed_at),
        project_uid: await uidOf(Project, task.project_id),
        parent_task_uid: await uidOf(Task, task.parent_task_id),
        url: `${getConfig().frontendUrl.replace(/\/+$/, '')}/task/${task.uid}`,
    };
}

const TEXT = {
    'task.created': (name) => `New task: ${name}`,
    'task.updated': (name) => `Task updated: ${name}`,
    'task.completed': (name) => `Completed: ${name}`,
    'task.deleted': (name) => `Task deleted: ${name}`,
};

async function send(event, task, extra = {}) {
    try {
        const data = { task: await taskPayload(task), ...extra };
        await dispatcher.emit(task.user_id, event, {
            text: TEXT[event](task.name),
            data,
        });
    } catch (error) {
        logError(`Failed to send webhook event ${event}:`, error);
    }
}

// Runs `fn` once the surrounding transaction commits, so a receiver never
// hears about a task that was rolled back. Outside a transaction it runs
// now.
async function afterCommit(options, fn) {
    if (options?.transaction) {
        options.transaction.afterCommit(() => fn());
        return;
    }
    await fn();
}

function skip(task) {
    // Habits are tasks underneath; their check-ins are not task changes.
    return (
        !task?.user_id ||
        task.habit_mode ||
        dispatcher.knownToHaveNone(task.user_id)
    );
}

function onCreate(task, options) {
    if (skip(task)) return undefined;
    return afterCommit(options, () => send('task.created', task));
}

function onUpdate(task, options) {
    if (skip(task)) return undefined;
    const changed = (task.changed() || []).filter((field) =>
        WATCHED_FIELDS.includes(field)
    );
    if (changed.length === 0) return undefined;

    const completed =
        changed.includes('status') &&
        task.status === Task.STATUS.DONE &&
        task.previous('status') !== Task.STATUS.DONE;

    // Copy what we need now: the instance can change again before commit.
    const snapshot = Task.build(task.get({ plain: true }), {
        isNewRecord: false,
    });
    return afterCommit(options, () =>
        completed
            ? send('task.completed', snapshot)
            : send('task.updated', snapshot, { changed })
    );
}

function onDestroy(task, options) {
    if (skip(task)) return undefined;
    const snapshot = Task.build(task.get({ plain: true }), {
        isNewRecord: false,
    });
    return afterCommit(options, () => send('task.deleted', snapshot));
}

let registered = false;

// Model hooks catch every path that writes a task one at a time: the web
// app, the API, MCP, the inbox and Telegram. Bulk Task.update() calls do
// not run them.
function register() {
    if (registered) return;
    registered = true;
    Task.addHook('afterCreate', 'webhooks', onCreate);
    Task.addHook('afterUpdate', 'webhooks', onUpdate);
    Task.addHook('afterDestroy', 'webhooks', onDestroy);
}

module.exports = { register, taskPayload, WATCHED_FIELDS };
