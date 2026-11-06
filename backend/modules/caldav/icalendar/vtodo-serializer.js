const ICAL = require('ical.js');
const {
    STATUS_TUDUDI_TO_ICAL,
    tududiToIcalPriority,
} = require('./field-mappings');
const { generateRRULE } = require('./rrule-generator');
const { toZonedTime, buildVTimezone } = require('./vtimezone');
const { utcToUserDateString } = require('../../../utils/timezone-utils');

function newCalendar() {
    const comp = new ICAL.Component('vcalendar');
    comp.addPropertyWithValue('version', '2.0');
    comp.addPropertyWithValue('prodid', '-//Tududi//Task Manager//EN');
    comp.addPropertyWithValue('calscale', 'GREGORIAN');
    return comp;
}

// A timed DUE/DTSTART goes out in the user's zone: Apple Reminders labels any
// time in another zone, so a UTC value reads "09:30 (16:30 GMT)" (#2008). Falls
// back to UTC when the zone cannot carry the instant. Returns the instant when
// it was written with a TZID, so the caller can add the matching VTIMEZONE.
function addTimedProperty(vtodo, name, value, userTimezone) {
    const date = new Date(value);
    const zoned = toZonedTime(date, userTimezone);
    if (!zoned) {
        vtodo.addPropertyWithValue(name, ICAL.Time.fromJSDate(date, true));
        return null;
    }
    vtodo.addPropertyWithValue(name, zoned).setParameter('tzid', userTimezone);
    return date;
}

function serializeTaskToVTODO(task, options = {}) {
    const { vtodo, zonedInstants } = buildVTODO(task, options);

    const comp = newCalendar();
    const vtimezone = buildVTimezone(options.userTimezone, zonedInstants);
    if (vtimezone) {
        comp.addSubcomponent(vtimezone);
    }
    comp.addSubcomponent(vtodo);

    return comp.toString();
}

function buildVTODO(task, options = {}) {
    const { userTimezone } = options;
    const zonedInstants = [];

    const vtodo = new ICAL.Component('vtodo');

    vtodo.addPropertyWithValue('uid', task.uid);
    vtodo.addPropertyWithValue('summary', task.name);
    // DTSTAMP is defined in UTC (RFC 5545 3.8.7.2); ICAL.Time.now() returns the
    // process' local time and serializes without the trailing Z.
    vtodo.addPropertyWithValue(
        'dtstamp',
        ICAL.Time.fromJSDate(new Date(), true)
    );

    const status = STATUS_TUDUDI_TO_ICAL[task.status] || 'NEEDS-ACTION';
    vtodo.addPropertyWithValue('status', status);

    // A task with no priority is served without PRIORITY at all: 0 would read
    // as "undefined" on the way out and as Low on the way back in.
    const priority = tududiToIcalPriority(task.priority);
    if (priority !== null) {
        vtodo.addPropertyWithValue('priority', priority);
    }

    if (task.due_date && task.due_has_time) {
        try {
            const instant = addTimedProperty(
                vtodo,
                'due',
                task.due_date,
                userTimezone
            );
            if (instant) {
                zonedInstants.push(instant);
            }
        } catch (error) {
            console.error('Error formatting due date:', error);
        }
    } else if (task.due_date) {
        try {
            const d = new Date(task.due_date);
            // Use user timezone to get the correct calendar date; Tududi stores
            // due_date as end-of-day in the user's timezone, so converting with
            // UTC date parts gives the wrong date for non-UTC users.
            const dateStr = userTimezone
                ? utcToUserDateString(d, userTimezone)
                : null;
            const [year, month, day] = dateStr
                ? dateStr.split('-').map(Number)
                : [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
            const dueDate = new ICAL.Time({ year, month, day, isDate: true });
            vtodo.addPropertyWithValue('due', dueDate);
        } catch (error) {
            console.error('Error formatting due date:', error);
        }
    }

    if (task.defer_until && task.due_date && task.due_has_time) {
        try {
            // RFC 5545: DTSTART must have the same value type as DUE, so a
            // timed DUE gets a DATE-TIME DTSTART too.
            const instant = addTimedProperty(
                vtodo,
                'dtstart',
                task.defer_until,
                userTimezone
            );
            if (instant) {
                zonedInstants.push(instant);
            }
        } catch (error) {
            console.error('Error formatting defer_until date:', error);
        }
    } else if (task.defer_until) {
        try {
            const d = new Date(task.defer_until);
            // Same timezone-aware conversion for DTSTART.
            const dateStr = userTimezone
                ? utcToUserDateString(d, userTimezone)
                : null;
            const [year, month, day] = dateStr
                ? dateStr.split('-').map(Number)
                : [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
            const startDate = new ICAL.Time({ year, month, day, isDate: true });
            vtodo.addPropertyWithValue('dtstart', startDate);
        } catch (error) {
            console.error('Error formatting defer_until date:', error);
        }
    }

    if (task.completed_at) {
        try {
            const completedTime = ICAL.Time.fromJSDate(
                new Date(task.completed_at),
                true
            );
            vtodo.addPropertyWithValue('completed', completedTime);

            if (status === 'COMPLETED') {
                vtodo.addPropertyWithValue('percent-complete', 100);
            }
        } catch (error) {
            console.error('Error formatting completed_at date:', error);
        }
    }

    if (task.note) {
        vtodo.addPropertyWithValue('description', task.note);
    }

    if (task.recurrence_type && task.recurrence_type !== 'none') {
        const rrule = generateRRULE(task);
        if (rrule) {
            try {
                const recur = ICAL.Recur.fromString(rrule);
                vtodo.addPropertyWithValue('rrule', recur);
            } catch (error) {
                console.error('Error parsing RRULE:', error);
            }
        }
    }

    if (task.parent_task_id && task.ParentTask) {
        vtodo.addPropertyWithValue('related-to', task.ParentTask.uid);
        const relatedProp = vtodo.getFirstProperty('related-to');
        if (relatedProp) {
            relatedProp.setParameter('reltype', 'PARENT');
        }
    }

    if (task.Project) {
        vtodo.addPropertyWithValue('x-tududi-project-uid', task.Project.uid);
        if (task.Project.name) {
            vtodo.addPropertyWithValue(
                'x-tududi-project-name',
                task.Project.name
            );
        }
    }

    if (task.Tags && task.Tags.length > 0) {
        const tagNames = task.Tags.map((t) => t.name).join(',');
        vtodo.addPropertyWithValue('categories', tagNames);

        const tagUids = task.Tags.map((t) => t.uid).join(',');
        vtodo.addPropertyWithValue('x-tududi-tag-uids', tagUids);
    }

    if (task.habit_mode) {
        vtodo.addPropertyWithValue('x-tududi-habit-mode', 'true');
        if (task.habit_current_streak !== null) {
            vtodo.addPropertyWithValue(
                'x-tududi-habit-streak',
                task.habit_current_streak.toString()
            );
        }
        if (task.habit_total_completions !== null) {
            vtodo.addPropertyWithValue(
                'x-tududi-habit-completions',
                task.habit_total_completions.toString()
            );
        }
    }

    if (task.order !== null && task.order !== undefined) {
        vtodo.addPropertyWithValue('x-tududi-order', task.order.toString());
    }

    const statusName = getStatusName(task.status);
    if (statusName) {
        vtodo.addPropertyWithValue('x-tududi-status-name', statusName);
    }

    if (task.created_at) {
        try {
            const createdTime = ICAL.Time.fromJSDate(
                new Date(task.created_at),
                true
            );
            vtodo.addPropertyWithValue('created', createdTime);
        } catch (error) {
            console.error('Error formatting created_at date:', error);
        }
    }

    if (task.updated_at) {
        try {
            const modifiedTime = ICAL.Time.fromJSDate(
                new Date(task.updated_at),
                true
            );
            vtodo.addPropertyWithValue('last-modified', modifiedTime);
        } catch (error) {
            console.error('Error formatting updated_at date:', error);
        }
    }

    if (task.reminder_at) {
        try {
            const valarm = new ICAL.Component('valarm');
            valarm.addPropertyWithValue('action', 'DISPLAY');
            valarm.addPropertyWithValue('description', 'Reminder');

            const triggerTime = ICAL.Time.fromJSDate(
                new Date(task.reminder_at),
                true
            );
            const triggerProp = new ICAL.Property('trigger');
            triggerProp.resetType('date-time');
            triggerProp.setValue(triggerTime);
            valarm.addProperty(triggerProp);

            vtodo.addSubcomponent(valarm);
        } catch (error) {
            console.error('Error formatting reminder_at:', error);
        }
    }

    return { vtodo, zonedInstants };
}

function getStatusName(status) {
    const statusMap = {
        0: 'not_started',
        1: 'in_progress',
        2: 'done',
        3: 'archived',
        4: 'waiting',
        5: 'cancelled',
        6: 'planned',
    };
    return statusMap[status];
}

async function serializeCollectionToVCALENDAR(tasks, options = {}) {
    const vtodos = [];
    const zonedInstants = [];

    for (const task of tasks) {
        try {
            const built = buildVTODO(task, options);
            vtodos.push(built.vtodo);
            zonedInstants.push(...built.zonedInstants);
        } catch (err) {
            console.error(
                `Error serializing task ${task.uid} for collection:`,
                err
            );
        }
    }

    const comp = newCalendar();
    const vtimezone = buildVTimezone(options.userTimezone, zonedInstants);
    if (vtimezone) {
        comp.addSubcomponent(vtimezone);
    }
    vtodos.forEach((vtodo) => comp.addSubcomponent(vtodo));

    return comp.toString();
}

module.exports = {
    serializeTaskToVTODO,
    serializeCollectionToVCALENDAR,
};
