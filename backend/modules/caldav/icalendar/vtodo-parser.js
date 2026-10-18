const ICAL = require('ical.js');
const moment = require('moment-timezone');
const {
    STATUS_ICAL_TO_TUDUDI,
    icalToTududiPriority,
} = require('./field-mappings');
const { parseRRULE } = require('./rrule-parser');
const {
    processDueDateForStorage,
    processDeferUntilForStorage,
    isValidTimezone,
} = require('../../../utils/timezone-utils');

// ical.js turns a floating time (no Z, no TZID) and a TZID it cannot resolve
// into a floating time, then reads it in the server's timezone. Read those in
// the TZID when it names a real zone, otherwise in the user's timezone.
function dateTimeToJSDate(property, userTimezone) {
    const time = property.getFirstValue();
    if (time.zone && time.zone.tzid !== 'floating') {
        return time.toJSDate();
    }

    const tzid = property.getParameter('tzid');
    const zone = isValidTimezone(tzid)
        ? tzid
        : isValidTimezone(userTimezone)
          ? userTimezone
          : 'UTC';
    return moment
        .tz(
            [
                time.year,
                time.month - 1,
                time.day,
                time.hour,
                time.minute,
                time.second,
            ],
            zone
        )
        .toDate();
}

// Read DUE or DTSTART into everything the rest of the parser needs from it:
// a DATE value is a whole day, so its start (00:00 in the user's timezone) is
// not its stored value (Tududi stores a due date as the end of that day), and
// relative alarms are measured from the start of the day, not from 23:59:59.
function readDateProperty(property, userTimezone) {
    if (!property) return null;

    const value = property.getFirstValue();
    if (!value) return null;

    if (value.isDate) {
        const dateStr = `${value.year}-${pad(value.month)}-${pad(value.day)}`;
        const timezone = userTimezone || 'UTC';
        return {
            isDate: true,
            dateStr,
            start: processDeferUntilForStorage(dateStr, timezone),
            end: processDueDateForStorage(dateStr, timezone),
        };
    }

    const instant = dateTimeToJSDate(property, userTimezone);
    if (!instant) return null;

    return { isDate: false, dateStr: null, start: instant, end: instant };
}

// DTSTART and DUE carrying the same value is how 2Do and EventKit say "this
// task is due then" - they are not asking for a defer date, so such a start is
// not one. Two DATE values are the same when they name the same day.
function startsAtDue(start, due) {
    if (start.isDate && due.isDate) {
        return start.dateStr === due.dateStr;
    }

    return start.start.getTime() >= due.start.getTime();
}

function pad(number) {
    return String(number).padStart(2, '0');
}

async function parseVTODOToTask(vtodoString, userTimezone) {
    try {
        if (!vtodoString || typeof vtodoString !== 'string') {
            throw new Error('Invalid VTODO data: expected a non-empty string');
        }

        const jcalData = ICAL.parse(vtodoString);
        const comp = new ICAL.Component(jcalData);

        // The root component may itself be a VTODO (bare, without VCALENDAR wrapper)
        // or the VTODO may be nested inside a VCALENDAR component.
        let vtodo =
            comp.name === 'vtodo' ? comp : comp.getFirstSubcomponent('vtodo');

        if (!vtodo) {
            throw new Error('No VTODO component found');
        }

        const task = {
            uid: null,
            name: null,
            note: null,
            due_date: null,
            defer_until: null,
            reminder_at: null,
            completed_at: null,
            status: 0,
            priority: null,
            recurrence_type: 'none',
            recurrence_interval: null,
            recurrence_end_date: null,
            recurrence_weekdays: null,
            recurrence_month_day: null,
            recurrence_weekday: null,
            recurrence_week_of_month: null,
            parent_task_uid: null,
            project_uid: null,
            tag_names: [],
            habit_mode: false,
            habit_current_streak: 0,
            habit_total_completions: 0,
            order: null,
        };

        const uid = vtodo.getFirstPropertyValue('uid');
        if (uid) {
            // Trim whitespace and control characters that would break URL routing
            const trimmedUid = uid.trim();
            if (trimmedUid) {
                task.uid = trimmedUid;
            }
        }

        const summary = vtodo.getFirstPropertyValue('summary');
        if (summary) {
            task.name = summary.trim() || null;
        }

        const description = vtodo.getFirstPropertyValue('description');
        if (description) {
            task.note = description;
        }

        const status = vtodo.getFirstPropertyValue('status');
        if (status) {
            task.status = STATUS_ICAL_TO_TUDUDI[status] || 0;
        }

        const priority = vtodo.getFirstPropertyValue('priority');
        if (priority !== null && priority !== undefined) {
            task.priority = icalToTududiPriority(priority);
        }

        const due = readDateProperty(
            vtodo.getFirstProperty('due'),
            userTimezone
        );
        if (due) {
            task.due_date = due.isDate ? due.end : due.start;
        }

        const start = readDateProperty(
            vtodo.getFirstProperty('dtstart'),
            userTimezone
        );
        if (start && !(due && startsAtDue(start, due))) {
            task.defer_until = start.start;
        }

        const completed = vtodo.getFirstPropertyValue('completed');
        if (completed) {
            task.completed_at = completed.toJSDate();
        }

        // When the remote copy last changed. Not a task column: the sync
        // conflict resolver compares it with the local updated_at, and without
        // it the remote side won every last-write-wins conflict.
        const lastModified = vtodo.getFirstPropertyValue('last-modified');
        if (lastModified && typeof lastModified.toJSDate === 'function') {
            task.last_modified = lastModified.toJSDate();
        }

        const rrule = vtodo.getFirstPropertyValue('rrule');
        if (rrule) {
            const recurrenceData = parseRRULE(rrule.toString());
            if (recurrenceData) {
                Object.assign(task, recurrenceData);
            }
        }

        const relatedTo = vtodo.getFirstPropertyValue('related-to');
        if (relatedTo) {
            task.parent_task_uid = relatedTo;
        }

        const projectUid = vtodo.getFirstPropertyValue('x-tududi-project-uid');
        if (projectUid) {
            task.project_uid = projectUid;
        }

        const categories = vtodo.getFirstPropertyValue('categories');
        if (categories) {
            if (Array.isArray(categories)) {
                task.tag_names = categories;
            } else if (typeof categories === 'string') {
                task.tag_names = categories.split(',').map((t) => t.trim());
            } else {
                task.tag_names = [categories];
            }
        }

        const habitMode = vtodo.getFirstPropertyValue('x-tududi-habit-mode');
        if (habitMode === 'true' || habitMode === true) {
            task.habit_mode = true;

            const streak = vtodo.getFirstPropertyValue('x-tududi-habit-streak');
            if (streak) {
                task.habit_current_streak = parseInt(streak, 10) || 0;
            }

            const completions = vtodo.getFirstPropertyValue(
                'x-tududi-habit-completions'
            );
            if (completions) {
                task.habit_total_completions = parseInt(completions, 10) || 0;
            }
        }

        const order = vtodo.getFirstPropertyValue('x-tududi-order');
        if (order) {
            task.order = parseInt(order, 10);
        }

        const valarm = vtodo.getFirstSubcomponent('valarm');
        if (valarm) {
            const triggerProp = valarm.getFirstProperty('trigger');
            if (triggerProp) {
                try {
                    const triggerVal = triggerProp.getFirstValue();
                    if (
                        triggerVal &&
                        typeof triggerVal.toJSDate === 'function'
                    ) {
                        task.reminder_at = triggerVal.toJSDate();
                    } else if (
                        triggerVal &&
                        typeof triggerVal.toSeconds === 'function'
                    ) {
                        // RFC 5545 3.8.6.3: a relative TRIGGER runs from DTSTART
                        // unless RELATED=END names the due date. DTSTART is used
                        // as the base even when it was not a defer date. A DATE
                        // value is measured from 00:00 in the user's timezone
                        // (not the end of that day), so PT9H on an all-day task
                        // is 09:00 that day, for START and END alike.
                        const related = String(
                            triggerProp.getParameter('related') || 'START'
                        ).toUpperCase();
                        const base =
                            related === 'END'
                                ? (due && due.start) || null
                                : (start && start.start) ||
                                  (due && due.start) ||
                                  null;
                        if (base) {
                            task.reminder_at = new Date(
                                base.getTime() + triggerVal.toSeconds() * 1000
                            );
                        }
                    }
                } catch (e) {
                    console.warn('Could not parse VALARM trigger:', e.message);
                }
            }
        }

        return task;
    } catch (error) {
        console.error('Error parsing VTODO:', error);
        throw new Error(`Failed to parse VTODO: ${error.message}`);
    }
}

async function parseRecurrenceOverride(vtodoString) {
    try {
        const jcalData = ICAL.parse(vtodoString);
        const comp = new ICAL.Component(jcalData);
        const vtodo = comp.getFirstSubcomponent('vtodo');

        if (!vtodo) {
            throw new Error('No VTODO component found');
        }

        const override = {
            uid: null,
            recurrence_id: null,
            name: null,
            due_date: null,
            status: 0,
            completed_at: null,
        };

        const uid = vtodo.getFirstPropertyValue('uid');
        if (uid) {
            override.uid = uid;
        }

        const recurrenceId = vtodo.getFirstPropertyValue('recurrence-id');
        if (recurrenceId) {
            override.recurrence_id = recurrenceId.toJSDate();
        }

        const summary = vtodo.getFirstPropertyValue('summary');
        if (summary) {
            override.name = summary;
        }

        const due = vtodo.getFirstPropertyValue('due');
        if (due) {
            if (due.isDate) {
                const year = due.year;
                const month = due.month - 1;
                const day = due.day;
                override.due_date = new Date(
                    Date.UTC(year, month, day, 0, 0, 0, 0)
                );
            } else {
                override.due_date = due.toJSDate();
            }
        }

        const status = vtodo.getFirstPropertyValue('status');
        if (status) {
            override.status = STATUS_ICAL_TO_TUDUDI[status] || 0;
        }

        const completed = vtodo.getFirstPropertyValue('completed');
        if (completed) {
            override.completed_at = completed.toJSDate();
        }

        return override;
    } catch (error) {
        console.error('Error parsing recurrence override:', error);
        throw new Error(
            `Failed to parse recurrence override: ${error.message}`
        );
    }
}

module.exports = {
    parseVTODOToTask,
    parseRecurrenceOverride,
};
