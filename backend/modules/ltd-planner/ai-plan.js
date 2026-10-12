'use strict';
// T-803: the model supplies IDs/order only. Slots, buffers and load stay here.
const { Task } = require('../../models');
const moment = require('moment-timezone');
const { getSafeTimezone } = require('../../utils/timezone-utils');
const planner = require('./service');
const repository = require('./repository');
const capacity = require('./capacity');
const slots = require('../daily-plan/slots');
const calendars = require('../calendar-feeds/service');
const { ValidationError } = require('../../shared/errors');
const CLOSED = [2, 3, 5];
async function state(user, date, transaction) {
    const [stored, window, result, sessions] = await Promise.all([
        repository.planRows(user.id, date, transaction),
        planner.getWorkHours(user),
        calendars.eventsForDay(user, date),
        repository.finishedSessions(user.id, 30),
    ]);
    const tasks = await Task.findAll({
        where: { user_id: user.id },
        transaction,
    });
    const byId = new Map(tasks.map((t) => [t.id, t]));
    return {
        date,
        ...stored,
        window,
        events: result.events,
        factor: capacity.planningFactor(sessions),
        byId,
        before: stored.rows.map((r) => ({ ...r })),
    };
}
function items(s) {
    return s.rows.map((r) => ({
        ...r,
        task_uid: s.byId.get(r.task_id)?.uid,
        done: CLOSED.includes(s.byId.get(r.task_id)?.status),
    }));
}
function valid(s) {
    const list = items(s);
    const c = capacity.computeCapacity({ ...s, items: list });
    const warnings = capacity.blockWarnings(
        list.filter((i) => !i.done),
        s.events
    );
    if (
        c.load === null ||
        c.load > 0.85 ||
        c.planned_minutes * s.factor > c.capacity_minutes * 0.85 ||
        warnings.event_overlaps.length ||
        warnings.missing_buffer.length
    )
        throw new ValidationError(
            'No safe plan fits: busy conflict, missing buffer or load above 0.85'
        );
    const timed = list.filter((i) => !i.done && i.start_minute != null);
    if (
        timed.some((i) =>
            s.events.some(
                (e) =>
                    e.busy &&
                    !e.all_day &&
                    e.start_minute != null &&
                    i.start_minute < e.end_minute + capacity.BUFFER_MINUTES &&
                    e.start_minute <
                        i.start_minute +
                            i.duration_minutes +
                            capacity.BUFFER_MINUTES
            )
        )
    )
        throw new ValidationError('Keep a buffer around busy events');
    for (const i of list.filter((i) => !i.done && i.start_minute != null)) {
        if (
            !Number.isInteger(i.start_minute) ||
            !Number.isInteger(i.duration_minutes) ||
            i.duration_minutes < 1 ||
            i.start_minute < s.window.start ||
            i.start_minute + i.duration_minutes > s.window.end
        )
            throw new ValidationError('Block outside work hours');
    }
    return c;
}
async function validate(user, ops, transaction) {
    const planOps = ops.filter((o) =>
        ['schedule_block', 'move_block'].includes(o.type)
    );
    const dates = [
        ...new Set(
            planOps.flatMap((o) => [o.date, o.from_date].filter(Boolean))
        ),
    ];
    const days = new Map(
        await Promise.all(
            dates.map(async (d) => [d, await state(user, d, transaction)])
        )
    );
    for (const op of planOps) {
        const target = days.get(op.date);
        const now = moment.tz(getSafeTimezone(user.timezone));
        const today = now.format('YYYY-MM-DD');
        if (
            op.date < today ||
            (op.date === today &&
                op.start_minute < now.hours() * 60 + now.minutes())
        )
            throw new ValidationError('Cannot plan into the past');
        const task = [...target.byId.values()].find(
            (t) => t.uid === op.task_uid
        );
        if (!task || CLOSED.includes(task.status))
            throw new ValidationError('Task not found or closed');
        if (target.rows.some((r) => r.task_id === task.id))
            throw new ValidationError('Task already planned');
        if (op.type === 'move_block') {
            const source = days.get(op.from_date);
            const row = source.rows.find((r) => r.task_id === task.id);
            if (!row || JSON.stringify(row) !== JSON.stringify(op.before))
                throw new ValidationError('Source plan changed');
            source.rows = source.rows.filter((r) => r.task_id !== task.id);
        }
        target.rows.push({
            task_id: task.id,
            start_minute: op.start_minute,
            duration_minutes: op.duration_minutes,
        });
    }
    for (const s of days.values()) valid(s);
    return [...days.values()];
}
async function draft(user, date, uids, fromDate) {
    if (new Set(uids).size !== uids.length)
        throw new ValidationError('Duplicate task IDs');
    const now = moment.tz(getSafeTimezone(user.timezone));
    const today = now.format('YYYY-MM-DD');
    if (date < today) throw new ValidationError('Cannot plan into the past');
    const from = date === today ? now.hours() * 60 + now.minutes() : 0;
    const target = await state(user, date);
    const source = fromDate ? await state(user, fromDate) : null;
    const ops = [];
    for (const uid of uids) {
        const task = [...target.byId.values()].find((t) => t.uid === uid);
        if (!task || CLOSED.includes(task.status))
            throw new ValidationError('Task not found or closed');
        const old = source?.rows.find((r) => r.task_id === task.id);
        if (source && !old)
            throw new ValidationError('Task not in source plan');
        if (target.rows.some((r) => r.task_id === task.id))
            throw new ValidationError('Task already planned');
        const duration =
            old?.duration_minutes ||
            Math.max(15, slots.snapUp(task.estimated_minutes || 30));
        const blocked = slots
            .blockedSpans(items(target), target.events)
            .map(([s, e]) => [s - 5, e + 5]);
        const start = slots.findFreeSlot(
            blocked,
            duration,
            target.window,
            from
        );
        if (start === null) {
            if (source)
                throw new ValidationError('No free slot for moved task');
            continue;
        }
        const row = {
            task_id: task.id,
            start_minute: start,
            duration_minutes: duration,
        };
        target.rows.push(row);
        try {
            valid(target);
        } catch (error) {
            target.rows.pop();
            if (source) throw error;
            continue;
        }
        ops.push({
            type: source ? 'move_block' : 'schedule_block',
            date,
            task_uid: uid,
            task_name: task.name,
            start_minute: start,
            duration_minutes: duration,
            ...(source ? { from_date: fromDate, before: old } : {}),
        });
        if (source)
            source.rows = source.rows.filter((r) => r.task_id !== task.id);
    }
    if (source) valid(source);
    valid(target);
    return ops;
}
module.exports = { draft, validate };
