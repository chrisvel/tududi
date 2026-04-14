const ICAL = require('ical.js');
const {
    STATUS_ICAL_TO_TUDUDI,
    icalToTududiPriority,
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
            task.status = STATUS_ICAL_TO_TUDUDI[status] || 0;
        }

        const priority = vtodo.getFirstPropertyValue('priority');
        if (priority !== null && priority !== undefined) {
            task.priority = icalToTududiPriority(priority);
        }

        const due = vtodo.getFirstPropertyValue('due');
        if (due) {
            task.due_date = due.toJSDate();
        }

        const dtstart = vtodo.getFirstPropertyValue('dtstart');
        if (dtstart) {
            task.defer_until = dtstart.toJSDate();
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

        const projectUid = vtodo.getFirstPropertyValue('x-tududi-project-uid');
        if (projectUid) {
            task.project_uid = projectUid;
        }

        const categories = vtodo.getFirstPropertyValue('categories');
        if (categories) {
            task.tag_names = Array.isArray(categories)
                ? categories
                : [categories];
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

        return task;
    } catch (error) {
        console.error('Error parsing VTODO:', error);
        throw new Error(`Failed to parse VTODO: ${error.message}`);
    }
}

module.exports = {
    parseVTODOToTask,
};
