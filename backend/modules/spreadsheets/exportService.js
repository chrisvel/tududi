'use strict';

const { Op } = require('sequelize');
const moment = require('moment-timezone');
const { Task, Project, Area, Tag, Person } = require('../../models');
const permissionsService = require('../../services/permissionsService');
const { getSafeTimezone } = require('../../utils/timezone-utils');
const { NotFoundError, ValidationError } = require('../../shared/errors');
const { FIELDS } = require('./core/columns');
const { translate } = require('./core/locales');
const { STATUS_LABEL_KEYS, PRIORITY_LABEL_KEYS } = require('./core/values');
const { writeCsv, writeXlsx } = require('./core/files');

const FORMATS = ['csv', 'xlsx'];
const CLOSED_STATUSES = [
    Task.STATUS.DONE,
    Task.STATUS.ARCHIVED,
    Task.STATUS.CANCELLED,
];

// Export columns in order. Every one maps back to a field on import except
// the parent's name and the creation date, which are there for reading.
const EXPORT_COLUMNS = [
    { key: 'uid', width: 18 },
    { key: 'name', width: 44 },
    { key: 'project', width: 26 },
    { key: 'area', width: 18 },
    { key: 'parent_name', label: 'spreadsheet.columns.parent', width: 30 },
    { key: 'parent', width: 18 },
    { key: 'status', width: 16, list: 'status' },
    { key: 'priority', width: 12, list: 'priority' },
    { key: 'start', width: 18 },
    { key: 'due', width: 18 },
    { key: 'defer_until', width: 18 },
    { key: 'estimate', width: 12 },
    { key: 'assignee', width: 20 },
    { key: 'tags', width: 24 },
    { key: 'note', width: 50 },
    { key: 'completed_at', width: 18 },
    { key: 'created_at', label: 'spreadsheet.columns.createdAt', width: 18 },
];

const TEMPLATE_COLUMNS = [
    'name',
    'project',
    'parent',
    'status',
    'priority',
    'start',
    'due',
    'estimate',
    'assignee',
    'tags',
    'note',
];

function columnLabel(column) {
    if (column.label) return column.label;
    return FIELDS.find((f) => f.key === column.key).label;
}

function header(language, column) {
    return translate(language, columnLabel(column)) || column.key;
}

function statusLabel(language, status) {
    const key = STATUS_LABEL_KEYS[status]?.[0];
    return key ? translate(language, key) || '' : '';
}

function priorityLabel(language, priority) {
    if (priority === null || priority === undefined) return '';
    const key = PRIORITY_LABEL_KEYS[priority]?.[0];
    return key ? translate(language, key) || '' : '';
}

function listFor(language, kind) {
    const keys = kind === 'status' ? STATUS_LABEL_KEYS : PRIORITY_LABEL_KEYS;
    return Object.values(keys)
        .map(([key]) => translate(language, key))
        .filter(Boolean);
}

// A stored instant as the user's wall clock: text for CSV, and a Date whose
// UTC fields are that wall clock for Excel, which has no timezones.
function dateCell(value, timezone, withTime) {
    if (!value) return '';
    const local = moment.utc(value).tz(timezone);
    const text = local.format(withTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD');
    const date = new Date(
        Date.UTC(
            local.year(),
            local.month(),
            local.date(),
            withTime ? local.hour() : 0,
            withTime ? local.minute() : 0
        )
    );
    return { text, date };
}

// Excel refuses some sheet names: certain characters, a leading or trailing
// apostrophe, more than 31 characters, and the reserved name History.
function safeSheetName(name) {
    const cleaned = String(name || '')
        .replace(/[*?:\\/[\]]/g, ' ')
        .trim()
        .slice(0, 31)
        .replace(/^'+|'+$/g, '')
        .trim();
    if (!cleaned) return 'Tasks';
    return cleaned.toLowerCase() === 'history' ? `${cleaned} (1)` : cleaned;
}

function slugify(text) {
    return (
        String(text || '')
            .normalize('NFKD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase()
            .slice(0, 60) || 'tasks'
    );
}

async function resolveProject(userId, projectUid) {
    const project = await Project.findOne({
        where: { uid: String(projectUid) },
        attributes: ['id', 'uid', 'name', 'user_id'],
    });
    if (!project) throw new NotFoundError('Project not found.');
    const access = await permissionsService.getAccess(
        userId,
        'project',
        project.uid
    );
    if (access === permissionsService.ACCESS.NONE) {
        throw new NotFoundError('Project not found.');
    }
    return project;
}

async function findTasks(userId, { project, areaId, includeCompleted }) {
    const visible = await permissionsService.ownershipOrPermissionWhere(
        'task',
        userId
    );
    const conditions = [
        visible,
        { habit_mode: false },
        // Generated occurrences of a repeating task are history; the
        // repeating task itself is the row people edit.
        { recurring_parent_id: null },
    ];
    if (project) conditions.push({ project_id: project.id });
    if (areaId) {
        const projectIds = (
            await Project.findAll({
                where: { area_id: areaId },
                attributes: ['id'],
                raw: true,
            })
        ).map((p) => p.id);
        conditions.push({
            [Op.or]: [{ area_id: areaId }, { project_id: projectIds }],
        });
    }
    if (!includeCompleted) {
        conditions.push({ status: { [Op.notIn]: CLOSED_STATUSES } });
    }

    return Task.findAll({
        where: { [Op.and]: conditions },
        include: [
            {
                model: Project,
                attributes: ['id', 'uid', 'name', 'area_id'],
                required: false,
                include: [
                    { model: Area, attributes: ['name'], required: false },
                ],
            },
            { model: Area, attributes: ['name'], required: false },
            {
                model: Tag,
                attributes: ['name'],
                through: { attributes: [] },
                required: false,
            },
        ],
        order: [
            ['created_at', 'ASC'],
            ['id', 'ASC'],
        ],
    });
}

// Projects alphabetically, tasks in creation order, every subtask right
// under its parent so the sheet reads like the project does.
function orderTasks(tasks) {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const children = new Map();
    const roots = [];
    for (const task of tasks) {
        if (task.parent_task_id && byId.has(task.parent_task_id)) {
            const list = children.get(task.parent_task_id) || [];
            list.push(task);
            children.set(task.parent_task_id, list);
        } else {
            roots.push(task);
        }
    }
    const projectName = (task) => task.Project?.name || '';
    roots.sort((a, b) =>
        projectName(a) === projectName(b)
            ? 0
            : projectName(a)
              ? projectName(b)
                  ? projectName(a).localeCompare(projectName(b))
                  : -1
              : 1
    );
    const ordered = [];
    for (const root of roots) {
        ordered.push(root);
        ordered.push(...(children.get(root.id) || []));
    }
    return ordered;
}

async function buildRows(userId, tasks, language, timezone) {
    const ordered = orderTasks(tasks);
    const parentIds = [
        ...new Set(tasks.map((t) => t.parent_task_id).filter(Boolean)),
    ];
    const parents = new Map(
        // A subtask can be visible (assigned to the user) while its parent
        // is not; such a parent stays out of the file.
        (
            await Task.findAll({
                where: {
                    [Op.and]: [
                        { id: parentIds },
                        await permissionsService.ownershipOrPermissionWhere(
                            'task',
                            userId
                        ),
                    ],
                },
                attributes: ['id', 'uid', 'name'],
                raw: true,
            })
        ).map((p) => [p.id, p])
    );
    const assigneeUids = [
        ...new Set(tasks.map((t) => t.assigned_to).filter(Boolean)),
    ];
    const people = new Map(
        (
            await Person.findAll({
                where: { uid: assigneeUids },
                attributes: ['uid', 'name'],
                raw: true,
            })
        ).map((p) => [p.uid, p.name])
    );

    return ordered.map((task) => {
        const parent = parents.get(task.parent_task_id);
        const values = {
            uid: task.uid,
            name: task.name,
            project: task.Project?.name || '',
            area: task.Project?.Area?.name || task.Area?.name || '',
            parent_name: parent?.name || '',
            parent: parent?.uid || '',
            status: statusLabel(language, task.status),
            priority: priorityLabel(language, task.priority),
            start: dateCell(task.start_date, timezone, task.start_has_time),
            due: dateCell(task.due_date, timezone, task.due_has_time),
            defer_until: dateCell(task.defer_until, timezone, true),
            estimate: task.estimated_minutes || '',
            assignee: people.get(task.assigned_to) || '',
            tags: (task.Tags || []).map((t) => t.name).join(', '),
            note: task.note || '',
            completed_at: dateCell(task.completed_at, timezone, true),
            created_at: dateCell(task.created_at, timezone, true),
        };
        return EXPORT_COLUMNS.map((column) => values[column.key]);
    });
}

function columnType(key, rows, index) {
    if (['start', 'due'].includes(key)) {
        return rows.some((row) => row[index]?.text?.length > 10)
            ? 'datetime'
            : 'date';
    }
    if (['defer_until', 'completed_at', 'created_at'].includes(key)) {
        return 'datetime';
    }
    return 'text';
}

async function render(format, { language, columns, rows, sheetName, extra }) {
    const headers = columns.map((column) => header(language, column));
    if (format === 'csv') {
        return writeCsv(headers, rows);
    }
    return writeXlsx({
        sheetName,
        columns: columns.map((column, i) => ({
            header: headers[i],
            width: column.width,
            type: columnType(column.key, rows, i),
            list: column.list ? listFor(language, column.list) : null,
        })),
        rows,
        extraSheets: extra || [],
    });
}

function checkFormat(format) {
    const value = String(format || 'xlsx').toLowerCase();
    if (!FORMATS.includes(value)) {
        throw new ValidationError('format must be csv or xlsx');
    }
    return value;
}

async function exportTasks(user, query = {}) {
    const format = checkFormat(query.format);
    const language = user.language || 'en';
    const timezone = getSafeTimezone(user.timezone);

    const project = query.project_uid
        ? await resolveProject(user.id, query.project_uid)
        : null;
    let areaId = null;
    if (query.area_uid) {
        const area = await Area.findOne({
            where: { uid: String(query.area_uid) },
            attributes: ['id', 'uid'],
        });
        const access = area
            ? await permissionsService.getAccess(user.id, 'area', area.uid)
            : permissionsService.ACCESS.NONE;
        if (access === permissionsService.ACCESS.NONE) {
            throw new NotFoundError('Area not found.');
        }
        areaId = area.id;
    }
    const includeCompleted =
        query.include_completed === undefined ||
        query.include_completed === 'true' ||
        query.include_completed === true;

    const tasks = await findTasks(user.id, {
        project,
        areaId,
        includeCompleted,
    });
    const rows = await buildRows(user.id, tasks, language, timezone);
    const sheetName =
        project?.name ||
        translate(language, 'spreadsheet.tasksSheet') ||
        'Tasks';
    const buffer = await render(format, {
        language,
        columns: EXPORT_COLUMNS,
        rows,
        sheetName: safeSheetName(sheetName),
    });
    const day = moment.tz(timezone).format('YYYY-MM-DD');
    return {
        buffer,
        format,
        fileName: `${slugify(project?.name || 'tasks')}-${day}.${format}`,
        count: rows.length,
    };
}

async function exportTemplate(user, query = {}) {
    const format = checkFormat(query.format);
    const language = user.language || 'en';
    const t = (key) => translate(language, key) || '';
    const columns = TEMPLATE_COLUMNS.map((key) =>
        key === 'parent'
            ? { key, label: 'spreadsheet.columns.parent', width: 28 }
            : {
                  key,
                  width: key === 'name' || key === 'note' ? 40 : 18,
                  list: ['status', 'priority'].includes(key) ? key : undefined,
              }
    );
    const example = (values) =>
        columns.map((column) => values[column.key] ?? '');
    const project = t('spreadsheet.template.exampleProject');
    const parentName = t('spreadsheet.template.exampleTask');
    const rows = [
        example({
            name: parentName,
            project,
            status: statusLabel(language, Task.STATUS.IN_PROGRESS),
            priority: priorityLabel(language, Task.PRIORITY.HIGH),
            start: '2026-11-02',
            due: '2026-11-20',
            tags: t('spreadsheet.template.exampleTag'),
            note: t('spreadsheet.template.exampleNote'),
        }),
        example({
            name: t('spreadsheet.template.exampleSubtask'),
            project,
            parent: parentName,
            status: statusLabel(language, Task.STATUS.NOT_STARTED),
            priority: priorityLabel(language, Task.PRIORITY.MEDIUM),
            due: '2026-11-06 14:00',
            estimate: '2h',
        }),
    ];
    const instructions = [
        t('spreadsheet.template.instructionsTitle'),
        '',
        ...[
            'instructionsName',
            'instructionsProject',
            'instructionsParent',
            'instructionsStatus',
            'instructionsDates',
            'instructionsEstimate',
            'instructionsAssignee',
            'instructionsTags',
            'instructionsOther',
        ].map((key) => `• ${t(`spreadsheet.template.${key}`)}`),
    ];
    const buffer = await render(format, {
        language,
        columns,
        rows,
        sheetName: safeSheetName(t('spreadsheet.tasksSheet')),
        extra: [
            {
                name: t('spreadsheet.template.instructionsSheet') || 'How to',
                lines: instructions,
            },
        ],
    });
    return { buffer, format, fileName: `tududi-import-template.${format}` };
}

module.exports = { exportTasks, exportTemplate, EXPORT_COLUMNS };
