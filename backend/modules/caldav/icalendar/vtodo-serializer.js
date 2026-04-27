const ICAL = require('ical.js');
const {
    STATUS_TASKNOTETAKER_TO_ICAL,
    TaskNoteTakerToIcalPriority,
} = require('./field-mappings');
const { generateRRULE } = require('./rrule-generator');

function serializeTaskToVTODO(task, options = {}) {
    const comp = new ICAL.Component('vcalendar');
    comp.addPropertyWithValue('version', '2.0');
    comp.addPropertyWithValue('prodid', '-//TaskNoteTaker//Task Manager//EN');
    comp.addPropertyWithValue('calscale', 'GREGORIAN');

    const vtodo = new ICAL.Component('vtodo');

    vtodo.addPropertyWithValue('uid', task.uid);
    vtodo.addPropertyWithValue('summary', task.name);
    vtodo.addPropertyWithValue('dtstamp', ICAL.Time.now());

    const status = STATUS_TASKNOTETAKER_TO_ICAL[task.status] || 'NEEDS-ACTION';
    vtodo.addPropertyWithValue('status', status);

    if (task.priority !== null && task.priority !== undefined) {
        const priority = TaskNoteTakerToIcalPriority(task.priority);
        vtodo.addPropertyWithValue('priority', priority);
    }

    if (task.due_date) {
        try {
            const dueTime = ICAL.Time.fromJSDate(new Date(task.due_date), true);
            vtodo.addPropertyWithValue('due', dueTime);
        } catch (error) {
            console.error('Error formatting due date:', error);
        }
    }

    if (task.defer_until) {
        try {
            const startTime = ICAL.Time.fromJSDate(
                new Date(task.defer_until),
                true
            );
            vtodo.addPropertyWithValue('dtstart', startTime);
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
        vtodo.addPropertyWithValue('x-TaskNoteTaker-project-uid', task.Project.uid);
        if (task.Project.name) {
            vtodo.addPropertyWithValue(
                'x-TaskNoteTaker-project-name',
                task.Project.name
            );
        }
    }

    if (task.Tags && task.Tags.length > 0) {
        const tagNames = task.Tags.map((t) => t.name).join(',');
        vtodo.addPropertyWithValue('categories', tagNames);

        const tagUids = task.Tags.map((t) => t.uid).join(',');
        vtodo.addPropertyWithValue('x-TaskNoteTaker-tag-uids', tagUids);
    }

    if (task.habit_mode) {
        vtodo.addPropertyWithValue('x-TaskNoteTaker-habit-mode', 'true');
        if (task.habit_current_streak !== null) {
            vtodo.addPropertyWithValue(
                'x-TaskNoteTaker-habit-streak',
                task.habit_current_streak.toString()
            );
        }
        if (task.habit_total_completions !== null) {
            vtodo.addPropertyWithValue(
                'x-TaskNoteTaker-habit-completions',
                task.habit_total_completions.toString()
            );
        }
    }

    if (task.order !== null && task.order !== undefined) {
        vtodo.addPropertyWithValue('x-TaskNoteTaker-order', task.order.toString());
    }

    const statusName = getStatusName(task.status);
    if (statusName) {
        vtodo.addPropertyWithValue('x-TaskNoteTaker-status-name', statusName);
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

    comp.addSubcomponent(vtodo);

    return comp.toString();
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

module.exports = {
    serializeTaskToVTODO,
};
