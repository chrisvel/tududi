const ICAL = require('ical.js');
const {
    STATUS_ICAL_TO_TASKNOTETAKER,
    icalToTaskNoteTakerPriority,
} = require('./field-mappings');
const { parseRRULE } = require('./rrule-parser');

async function parseVTODOToTask(vtodoString) {
    try {
        const jcalData = ICAL.parse(vtodoString);
        const comp = new ICAL.Component(jcalData);
        const vtodo = comp.getFirstSubcomponent('vtodo');

        if (!vtodo) {
            throw new Error('No VTODO component found');
        }

        const task = {
            uid: null,
            name: null,
            note: null,
            due_date: null,
            defer_until: null,
            completed_at: null,
            status: 0,
            priority: 0,
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
            task.uid = uid;
        }

        const summary = vtodo.getFirstPropertyValue('summary');
        if (summary) {
            task.name = summary;
        }

        const description = vtodo.getFirstPropertyValue('description');
        if (description) {
            task.note = description;
        }

        const status = vtodo.getFirstPropertyValue('status');
        if (status) {
            task.status = STATUS_ICAL_TO_TASKNOTETAKER[status] || 0;
        }

        const priority = vtodo.getFirstPropertyValue('priority');
        if (priority !== null && priority !== undefined) {
            task.priority = icalToTaskNoteTakerPriority(priority);
        }

        const due = vtodo.getFirstPropertyValue('due');
        if (due) {
            if (due.isDate) {
                const year = due.year;
                const month = due.month - 1;
                const day = due.day;
                task.due_date = new Date(
                    Date.UTC(year, month, day, 0, 0, 0, 0)
                );
            } else {
                task.due_date = due.toJSDate();
            }
        }

        const dtstart = vtodo.getFirstPropertyValue('dtstart');
        if (dtstart) {
            if (dtstart.isDate) {
                const year = dtstart.year;
                const month = dtstart.month - 1;
                const day = dtstart.day;
                task.defer_until = new Date(
                    Date.UTC(year, month, day, 0, 0, 0, 0)
                );
            } else {
                task.defer_until = dtstart.toJSDate();
            }
        }

        const completed = vtodo.getFirstPropertyValue('completed');
        if (completed) {
            task.completed_at = completed.toJSDate();
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

        const projectUid = vtodo.getFirstPropertyValue('x-tasknotetaker-project-uid');
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

        const habitMode = vtodo.getFirstPropertyValue('x-tasknotetaker-habit-mode');
        if (habitMode === 'true' || habitMode === true) {
            task.habit_mode = true;

            const streak = vtodo.getFirstPropertyValue('x-tasknotetaker-habit-streak');
            if (streak) {
                task.habit_current_streak = parseInt(streak, 10) || 0;
            }

            const completions = vtodo.getFirstPropertyValue(
                'x-tasknotetaker-habit-completions'
            );
            if (completions) {
                task.habit_total_completions = parseInt(completions, 10) || 0;
            }
        }

        const order = vtodo.getFirstPropertyValue('x-tasknotetaker-order');
        if (order) {
            task.order = parseInt(order, 10);
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
            override.status = STATUS_ICAL_TO_TASKNOTETAKER[status] || 0;
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
