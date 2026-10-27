'use strict';

const { Op } = require('sequelize');
const { ValidationError } = require('../../shared/errors');
const { Task, Project, Area, Tag, User } = require('../../models');
const permissionsService = require('../../services/permissionsService');
const peopleService = require('../people/service');
const { validateTagName } = require('../tags/tagsService');
const { getSafeTimezone } = require('../../utils/timezone-utils');
const { FIELD_KEYS, IGNORE, APPEND_TO_NOTE } = require('./core/columns');
const {
    detectDateOrder,
    parseDateCell,
    parseStatusCell,
    parsePriorityCell,
    parseEstimateCell,
    splitList,
    normalizeWord,
    MAX_WORD_LENGTH,
} = require('./core/values');

const MAX_NAME_LENGTH = 255;
const DATE_FIELDS = ['start', 'due', 'defer_until', 'completed_at'];
const TARGET_MODES = ['project', 'new_project', 'column', 'none'];
const HIERARCHY_MODES = ['auto', 'parent', 'wbs', 'indent', 'flat'];

function key(text) {
    return normalizeWord(text);
}

// The first row that looks like headers: at least two filled cells and
// at least half as many as the widest of the first rows.
function detectHeaderRow(rows) {
    const sample = rows.slice(0, 20);
    const widest = Math.max(
        0,
        ...sample.map((row) => row.filter(Boolean).length)
    );
    const index = sample.findIndex((row) => {
        const filled = row.filter(Boolean).length;
        return filled >= Math.min(2, widest) && filled >= widest / 2;
    });
    return Math.max(0, index);
}

const MAX_STATUS = Math.max(...Object.values(Task.STATUS));
const MAX_PRIORITY = Math.max(...Object.values(Task.PRIORITY));
const MAX_VALUE_MAP_ENTRIES = 500;
const MAX_TAGS_PER_TASK = 20;
// Distinct unrecognised words offered for matching, per field.
const MAX_UNKNOWN_VALUES = 100;
// What one import may add besides tasks; a sheet needing more is almost
// always a wrongly mapped column.
const MAX_NEW_PROJECTS = 200;
const MAX_NEW_AREAS = 50;
const MAX_NEW_TAGS = 500;

function integerIn(value, min, max) {
    if (value === '' || value === null) return '';
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
}

// What the user matched unknown cell values to, as a Map so a cell saying
// "__proto__" or "constructor" never reads anything but its own entry.
function choiceMap(raw, check) {
    const map = new Map();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return map;
    for (const [cellValue, choice] of Object.entries(raw).slice(
        0,
        MAX_VALUE_MAP_ENTRIES
    )) {
        const value = check(choice);
        if (value !== undefined) map.set(cellValue, value);
    }
    return map;
}

function normalizeOptions(sheets, raw = {}) {
    const sheetIndex = Number.isInteger(raw.sheet) ? raw.sheet : 0;
    const sheet = sheets[sheetIndex];
    if (!sheet) throw new ValidationError('Unknown sheet.');
    const headerRow = Number.isInteger(raw.header_row)
        ? Math.min(Math.max(raw.header_row, 0), sheet.rows.length - 1)
        : detectHeaderRow(sheet.rows);
    const width = sheet.rows[0]?.length || 0;
    const mapping = Array.from({ length: width }, (_, i) => {
        const target = Array.isArray(raw.mapping) ? raw.mapping[i] : null;
        return FIELD_KEYS.includes(target) || target === APPEND_TO_NOTE
            ? target
            : IGNORE;
    });
    // One column per field; a second column for the same field is dropped.
    const seen = new Set();
    mapping.forEach((target, i) => {
        if (!FIELD_KEYS.includes(target)) return;
        if (seen.has(target)) mapping[i] = IGNORE;
        seen.add(target);
    });

    const target = raw.target || {};
    const mode = TARGET_MODES.includes(target.mode) ? target.mode : 'none';
    const hierarchy = HIERARCHY_MODES.includes(raw.hierarchy)
        ? raw.hierarchy
        : 'auto';
    const valueMap = raw.value_map || {};
    return {
        sheet: sheetIndex,
        header_row: headerRow,
        mapping,
        target: {
            mode,
            project_uid: target.project_uid || null,
            project_name: String(target.project_name || '').trim(),
            area_uid: target.area_uid || null,
        },
        hierarchy,
        date_order: ['dmy', 'mdy'].includes(raw.date_order)
            ? raw.date_order
            : 'auto',
        date_order_fallback: raw.date_order_fallback === 'mdy' ? 'mdy' : 'dmy',
        value_map: {
            status: choiceMap(valueMap.status, (v) =>
                integerIn(v, 0, MAX_STATUS)
            ),
            priority: choiceMap(valueMap.priority, (v) =>
                integerIn(v, 0, MAX_PRIORITY)
            ),
            // Checked against the people the user can assign to in analyze.
            assignee: choiceMap(valueMap.assignee, (v) =>
                typeof v === 'string' ? v : undefined
            ),
        },
        update_existing: raw.update_existing !== false,
        clear_blanks: raw.clear_blanks === true,
    };
}

async function writableProjects(userId) {
    const visible = await permissionsService.ownershipOrPermissionWhere(
        'project',
        userId
    );
    const projects = await Project.findAll({
        where: visible,
        attributes: ['id', 'uid', 'name', 'user_id', 'area_id'],
    });
    const writable = [];
    for (const project of projects) {
        if (project.user_id === userId) {
            writable.push(project);
            continue;
        }
        const access = await permissionsService.getAccess(
            userId,
            'project',
            project.uid
        );
        if (access === 'rw' || access === 'admin') writable.push(project);
    }
    return writable;
}

// Name and email -> person uid, for everyone the user can assign tasks to.
async function assigneeIndex(userId) {
    const people = await peopleService.getAssignable(userId);
    const index = new Map();
    const memberIds = [];
    for (const person of people) {
        if (person.name) index.set(key(person.name), person.uid);
        if (person.email) index.set(key(person.email), person.uid);
        if (person.linked_user_id) memberIds.push(person.linked_user_id);
    }
    if (memberIds.length > 0) {
        const users = await User.findAll({
            where: { id: memberIds },
            attributes: ['id', 'email', 'name', 'surname'],
            raw: true,
        });
        for (const user of users) {
            const person = people.find((p) => p.linked_user_id === user.id);
            if (!person) continue;
            if (user.email && !index.has(key(user.email))) {
                index.set(key(user.email), person.uid);
            }
            const fullName = [user.name, user.surname]
                .filter(Boolean)
                .join(' ');
            if (fullName && !index.has(key(fullName))) {
                index.set(key(fullName), person.uid);
            }
        }
    }
    return { index, people, uids: new Set(people.map((p) => p.uid)) };
}

async function writableTasksByUid(userId, uids) {
    if (uids.length === 0) return new Map();
    const tasks = await Task.findAll({
        where: { uid: uids, habit_mode: false },
        include: [
            {
                model: Tag,
                attributes: ['id', 'name'],
                through: { attributes: [] },
            },
        ],
    });
    const result = new Map();
    for (const task of tasks) {
        if (task.user_id !== userId) {
            const access = await permissionsService.getAccess(
                userId,
                'task',
                task.uid
            );
            if (access !== 'rw' && access !== 'admin') continue;
        }
        result.set(task.uid, task);
    }
    return result;
}

function normalizeWbs(value) {
    const text = String(value || '')
        .trim()
        .replace(/\.$/, '');
    if (!/^\d+(\.\d+)*$/.test(text)) return null;
    return text.replace(/(\.0)+$/, '');
}

// Reads every data row of the chosen sheet into a plan: what each row will
// create or change, and the problems found. Nothing is written here; commit
// runs the same plan.
async function analyze(user, sheets, rawOptions) {
    const options = normalizeOptions(sheets, rawOptions);
    const sheet = sheets[options.sheet];
    const timezone = getSafeTimezone(user.timezone);
    const userId = user.id;
    const { mapping } = options;

    const headers = sheet.rows[options.header_row] || [];
    const headerKey = headers.join('\u0000');
    const dataRows = sheet.rows
        .map((cells, i) => ({
            cells,
            index: i,
            level: sheet.levels?.[i] || 0,
            rowNumber: sheet.row_numbers?.[i] ?? i + 1,
        }))
        .slice(options.header_row + 1)
        // Exports that start every group with its own header row repeat it.
        .filter(
            (row) =>
                !row.cells.some(Boolean) ||
                row.cells.join('\u0000') !== headerKey
        );

    const column = (field) => mapping.indexOf(field);
    const has = (field) => column(field) !== -1;
    const cell = (row, field) =>
        has(field) ? String(row.cells[column(field)] ?? '').trim() : '';
    const noteColumns = mapping
        .map((target, i) => (target === APPEND_TO_NOTE ? i : -1))
        .filter((i) => i !== -1);

    const problems = [];
    if (!has('name') && !has('uid')) {
        problems.push({ code: 'name_column_required' });
    }

    // Day-first or month-first, per date column.
    const dateOrders = {};
    const dateColumns = {};
    for (const field of DATE_FIELDS) {
        if (!has(field)) continue;
        const detected = detectDateOrder(dataRows.map((r) => cell(r, field)));
        dateColumns[field] = {
            detected,
            ambiguous:
                !detected &&
                dataRows.some((r) =>
                    /^\d{1,2}[/.-]\d{1,2}[/.-]/.test(cell(r, field))
                ),
        };
        dateOrders[field] =
            options.date_order !== 'auto'
                ? options.date_order
                : detected || options.date_order_fallback;
    }

    // Where tasks go.
    const projects = await writableProjects(userId);
    const projectsByName = new Map();
    for (const project of projects) {
        const k = key(project.name);
        if (!projectsByName.has(k) || project.user_id === userId) {
            projectsByName.set(k, project);
        }
    }
    const projectsByUid = new Map(projects.map((p) => [p.uid, p]));
    const areas = await Area.findAll({
        where: { user_id: userId },
        attributes: ['id', 'uid', 'name'],
    });
    const areasByName = new Map(areas.map((a) => [key(a.name), a]));
    const areasByUid = new Map(areas.map((a) => [a.uid, a]));

    let fixedProject = null;
    const newProjects = new Map();
    const newAreas = new Map();
    const target = options.target;
    if (target.mode === 'project') {
        fixedProject = projectsByUid.get(target.project_uid) || null;
        if (!fixedProject) problems.push({ code: 'target_project_invalid' });
    } else if (target.mode === 'new_project') {
        if (!target.project_name) {
            problems.push({ code: 'target_project_name_required' });
        } else {
            fixedProject = {
                ref: `new:${key(target.project_name)}`,
                name: target.project_name.slice(0, 255),
                area_id: areasByUid.get(target.area_uid)?.id || null,
                isNew: true,
            };
            newProjects.set(fixedProject.ref, fixedProject);
        }
    }
    const fallbackProject =
        target.mode === 'column' && target.project_uid
            ? projectsByUid.get(target.project_uid) || null
            : null;

    function areaFor(row) {
        const name = cell(row, 'area');
        if (!name) return null;
        const existing = areasByName.get(key(name));
        if (existing) return { id: existing.id, name: existing.name };
        const ref = `new:${key(name)}`;
        if (!newAreas.has(ref)) {
            newAreas.set(ref, { ref, name: name.slice(0, 255), isNew: true });
        }
        return newAreas.get(ref);
    }

    function projectFor(row) {
        if (target.mode === 'project' || target.mode === 'new_project') {
            return fixedProject;
        }
        if (target.mode !== 'column') return null;
        const name = cell(row, 'project');
        if (!name) return fallbackProject;
        const existing =
            projectsByUid.get(name) || projectsByName.get(key(name));
        if (existing) return existing;
        const ref = `new:${key(name)}`;
        if (!newProjects.has(ref)) {
            const area = areaFor(row);
            newProjects.set(ref, {
                ref,
                name: name.slice(0, 255),
                area,
                isNew: true,
            });
        }
        return newProjects.get(ref);
    }

    const projectKey = (project) =>
        project ? project.ref || `id:${project.id}` : 'none';

    // People and existing tasks the file refers to.
    const assignees = has('assignee')
        ? await assigneeIndex(userId)
        : { index: new Map(), people: [], uids: new Set() };
    const fileUids = has('uid')
        ? dataRows.map((r) => cell(r, 'uid')).filter(Boolean)
        : [];
    const parentValues =
        has('parent') && ['auto', 'parent'].includes(options.hierarchy)
            ? dataRows.map((r) => cell(r, 'parent')).filter(Boolean)
            : [];
    const existingByUid = await writableTasksByUid(userId, [
        ...new Set([...fileUids, ...parentValues]),
    ]);

    const unknown = {
        status: new Set(),
        priority: new Set(),
        assignee: new Set(),
    };
    const tagNames = new Set();
    const rows = [];

    for (const row of dataRows) {
        const errors = [];
        const warnings = [];
        const warn = (code, extra = {}) =>
            warnings.push({
                code,
                ...extra,
                ...(extra.value !== undefined
                    ? { value: String(extra.value).slice(0, 80) }
                    : {}),
            });
        const uid = cell(row, 'uid');
        const existing = uid ? existingByUid.get(uid) : null;
        const action =
            existing && options.update_existing ? 'update' : 'create';
        if (uid && !existing) warn('uid_not_found');
        const isUpdate = action === 'update';
        // On an update a blank cell leaves the field alone unless asked.
        const take = (field) => {
            const value = cell(row, field);
            if (!has(field)) return undefined;
            if (value) return value;
            return isUpdate && !options.clear_blanks ? undefined : '';
        };

        const body = {};
        let name = cell(row, 'name');
        if (!name && !isUpdate) {
            errors.push({ code: 'name_required' });
        }
        if (name.length > MAX_NAME_LENGTH) {
            warn('name_truncated');
            name = name.slice(0, MAX_NAME_LENGTH);
        }
        if (name) body.name = name;

        const statusText = take('status');
        if (statusText) {
            let status = parseStatusCell(statusText);
            const mapped = options.value_map.status.get(statusText);
            if (mapped !== undefined && mapped !== '') status = mapped;
            if (status === undefined || Number.isNaN(status)) {
                if (
                    statusText.length <= MAX_WORD_LENGTH &&
                    unknown.status.size < MAX_UNKNOWN_VALUES
                ) {
                    unknown.status.add(statusText);
                }
                warn('unknown_status', { value: statusText });
            } else {
                body.status = status;
            }
        } else if (statusText === '') {
            body.status = Task.STATUS.NOT_STARTED;
        }

        const priorityText = take('priority');
        if (priorityText) {
            let priority = parsePriorityCell(priorityText);
            const mapped = options.value_map.priority.get(priorityText);
            if (mapped !== undefined && mapped !== '') priority = mapped;
            if (priority === undefined || Number.isNaN(priority)) {
                if (
                    priorityText.length <= MAX_WORD_LENGTH &&
                    unknown.priority.size < MAX_UNKNOWN_VALUES
                ) {
                    unknown.priority.add(priorityText);
                }
                warn('unknown_priority', { value: priorityText });
            } else {
                body.priority = priority;
            }
        } else if (priorityText === '') {
            body.priority = null;
        }

        const dates = {};
        for (const field of DATE_FIELDS) {
            const text = take(field);
            if (text === undefined) continue;
            if (text === '') {
                dates[field] = null;
                continue;
            }
            const parsed = parseDateCell(text, dateOrders[field]);
            if (!parsed || parsed.error) {
                warn('invalid_date', { field, value: text });
                continue;
            }
            dates[field] = parsed;
        }
        if (dates.due !== undefined) {
            body.due_date = dates.due?.date || null;
            body.due_time = dates.due?.time || null;
        }
        if (dates.start !== undefined) {
            body.start_date = dates.start?.date || null;
            body.start_time = dates.start?.time || null;
        }
        if (dates.defer_until !== undefined) {
            body.defer_until = dates.defer_until
                ? `${dates.defer_until.date}T${dates.defer_until.time || '00:00'}`
                : null;
        }
        if (
            dates.defer_until?.date &&
            dates.due?.date &&
            dates.defer_until.date > dates.due.date
        ) {
            warn('defer_after_due');
            delete body.defer_until;
        }

        const estimateText = take('estimate');
        if (estimateText) {
            const estimate = parseEstimateCell(estimateText);
            if (estimate?.error) {
                warn(estimate.error, { value: estimateText });
            } else {
                body.estimated_minutes = estimate.minutes;
            }
        } else if (estimateText === '') {
            body.estimated_minutes = null;
        }

        const assigneeText = take('assignee');
        if (assigneeText && assigneeText.length > MAX_WORD_LENGTH) {
            warn('unknown_assignee', { value: assigneeText.slice(0, 40) });
        } else if (assigneeText) {
            let mapped = options.value_map.assignee.get(assigneeText);
            if (mapped && !assignees.uids.has(mapped)) mapped = undefined;
            const personUid =
                mapped !== undefined
                    ? mapped || null
                    : assignees.index.get(key(assigneeText));
            if (personUid) {
                body.assigned_to = personUid;
            } else if (mapped === undefined) {
                if (unknown.assignee.size < MAX_UNKNOWN_VALUES) {
                    unknown.assignee.add(assigneeText);
                }
                warn('unknown_assignee', { value: assigneeText });
            }
        } else if (assigneeText === '') {
            body.assigned_to = null;
        }

        const tagsText = take('tags');
        let tags;
        if (tagsText !== undefined) {
            tags = [];
            for (const tag of splitList(tagsText)) {
                const validation = validateTagName(tag);
                if (!validation.valid) {
                    warn('invalid_tag', { value: tag });
                    continue;
                }
                if (tags.includes(validation.name)) continue;
                if (tags.length >= MAX_TAGS_PER_TASK) {
                    warn('too_many_tags');
                    break;
                }
                tags.push(validation.name);
            }
            tags.forEach((t) => tagNames.add(t));
        }

        // The note, with every column kept "in the note" added below it.
        const noteText = take('note');
        const extraLines = noteColumns
            .map((i) => {
                const value = String(row.cells[i] ?? '').trim();
                const label = String(headers[i] ?? '').trim() || `#${i + 1}`;
                return value ? `${label}: ${value}` : null;
            })
            .filter(Boolean);
        if (noteText !== undefined || (!isUpdate && extraLines.length > 0)) {
            body.note =
                [noteText, ...extraLines].filter(Boolean).join('\n') || null;
        }

        let project = projectFor(row);
        if (isUpdate && target.mode !== 'column') project = undefined;
        if (isUpdate && target.mode === 'column' && !cell(row, 'project')) {
            project = undefined;
        }
        const area = !project && project !== undefined ? areaFor(row) : null;

        rows.push({
            row_number: row.rowNumber,
            index: row.index,
            level: row.level,
            action: errors.length > 0 ? 'skip' : action,
            uid: uid || null,
            existing,
            name: name || existing?.name || '',
            body,
            dates,
            tags,
            project,
            area,
            parentText: cell(row, 'parent'),
            wbs: normalizeWbs(cell(row, 'wbs')),
            completedAt: dates.completed_at,
            errors,
            warnings,
        });
    }

    resolveParents(rows, options, existingByUid, projectKey);
    await resolveParentsByName(rows, userId);
    await dropForeignParents(rows, userId, projects);

    // Subtasks live in their parent's project.
    for (const row of rows) {
        const parent = row.parent;
        if (!parent) continue;
        const parentProject = parent.row
            ? parent.row.project
            : parent.projectId
              ? projects.find((p) => p.id === parent.projectId)
              : null;
        if (
            row.project !== undefined &&
            projectKey(row.project) !== projectKey(parentProject)
        ) {
            row.warnings.push({ code: 'moved_to_parent_project' });
        }
        row.project = parentProject;
    }

    // Only projects and areas some imported row still uses get created.
    const usedProjects = new Set(
        rows
            .filter((r) => r.action !== 'skip' && r.project?.isNew)
            .map((r) => r.project.ref)
    );
    const usedAreas = new Set(
        rows
            .filter((r) => r.action !== 'skip')
            .flatMap((r) => [
                r.area?.isNew ? r.area.ref : null,
                usedProjects.has(r.project?.ref) && r.project.area?.isNew
                    ? r.project.area.ref
                    : null,
            ])
            .filter(Boolean)
    );

    const existingTags = await Tag.findAll({
        where: { user_id: userId, name: [...tagNames] },
        attributes: ['name'],
        raw: true,
    });
    const knownTags = new Set(existingTags.map((t) => t.name));

    const newTagCount = [...tagNames].filter((t) => !knownTags.has(t)).length;
    if (usedProjects.size > MAX_NEW_PROJECTS) {
        problems.push({
            code: 'too_many_new_projects',
            value: String(MAX_NEW_PROJECTS),
        });
    }
    if (usedAreas.size > MAX_NEW_AREAS) {
        problems.push({
            code: 'too_many_new_areas',
            value: String(MAX_NEW_AREAS),
        });
    }
    if (newTagCount > MAX_NEW_TAGS) {
        problems.push({
            code: 'too_many_new_tags',
            value: String(MAX_NEW_TAGS),
        });
    }

    const counts = {
        create: rows.filter((r) => r.action === 'create').length,
        update: rows.filter((r) => r.action === 'update').length,
        skip: rows.filter((r) => r.action === 'skip').length,
        warnings: rows.reduce((sum, r) => sum + r.warnings.length, 0),
        new_projects: usedProjects.size,
        new_areas: usedAreas.size,
        new_tags: newTagCount,
    };

    return {
        options,
        headers,
        timezone,
        rows,
        problems,
        counts,
        date_columns: dateColumns,
        new_projects: [...newProjects.values()].filter((p) =>
            usedProjects.has(p.ref)
        ),
        new_areas: [...newAreas.values()].filter((a) => usedAreas.has(a.ref)),
        unknown_values: {
            status: [...unknown.status],
            priority: [...unknown.priority],
            assignee: [...unknown.assignee],
        },
        assignable: assignees.people.map((p) => ({ uid: p.uid, name: p.name })),
    };
}

// An existing task as a parent. Subtasks are one level deep, so under a
// subtask means under that subtask's parent.
function existingParent(task) {
    return {
        taskId: task.parent_task_id || task.id,
        projectId: task.project_id,
        name: task.name,
        flattened: !!task.parent_task_id,
    };
}

// Sets row.parent to { row } or an existing task for every row with a parent, keeping
// to one level: a row under a subtask goes under that subtask's parent.
function resolveParents(rows, options, existingByUid, projectKey) {
    let mode = options.hierarchy;
    if (mode === 'auto') {
        const hasParent = rows.some((r) => r.parentText);
        const hasWbs = rows.some((r) => r.wbs && r.wbs.includes('.'));
        const hasLevels = rows.some((r) => r.level > 0);
        mode = hasParent
            ? 'parent'
            : hasWbs
              ? 'wbs'
              : hasLevels
                ? 'indent'
                : 'flat';
    }
    options.hierarchy_used = mode;
    if (mode === 'flat') return;

    const live = rows.filter((r) => r.action !== 'skip');
    const direct = new Map();

    if (mode === 'parent') {
        const byUid = new Map(live.filter((r) => r.uid).map((r) => [r.uid, r]));
        const byName = new Map();
        for (const row of live) {
            const k = `${projectKey(row.project)}|${key(row.name)}`;
            if (!byName.has(k)) byName.set(k, row);
        }
        const anyByName = new Map();
        for (const row of live) {
            if (!anyByName.has(key(row.name)))
                anyByName.set(key(row.name), row);
        }
        for (const row of rows) {
            if (!row.parentText || row.action === 'skip') continue;
            const text = row.parentText;
            const found =
                byUid.get(text) ||
                byName.get(`${projectKey(row.project)}|${key(text)}`) ||
                anyByName.get(key(text));
            if (found && found !== row) {
                direct.set(row, { row: found });
                continue;
            }
            const task = existingByUid.get(text);
            if (task) {
                direct.set(row, existingParent(task));
                continue;
            }
            // Maybe an existing task's name; looked up once all rows are in.
            row.pendingParentName = text;
        }
    } else if (mode === 'wbs') {
        const byWbs = new Map();
        for (const row of live) if (row.wbs) byWbs.set(row.wbs, row);
        for (const row of live) {
            if (!row.wbs) continue;
            let parts = row.wbs.split('.');
            while (parts.length > 1) {
                parts = parts.slice(0, -1);
                const found = byWbs.get(parts.join('.'));
                if (found) {
                    direct.set(row, { row: found });
                    break;
                }
            }
        }
    } else if (mode === 'indent') {
        const stack = [];
        for (const row of live) {
            while (stack.length && stack[stack.length - 1].level >= row.level) {
                stack.pop();
            }
            if (stack.length) direct.set(row, { row: stack[stack.length - 1] });
            stack.push(row);
        }
    }

    // Flatten to one level and break cycles.
    for (const row of rows) {
        let parent = direct.get(row);
        if (!parent) continue;
        const seen = new Set([row]);
        let flattened = false;
        while (parent.row && direct.get(parent.row)) {
            if (seen.has(parent.row)) {
                parent = null;
                break;
            }
            seen.add(parent.row);
            parent = direct.get(parent.row);
            flattened = true;
        }
        if (!parent || parent.row === row) continue;
        if (parent.flattened) flattened = true;
        if (flattened) row.warnings.push({ code: 'flattened' });
        row.parent = parent;
    }
}

// An existing task can only take subtasks from an import when the user
// could add a task next to it: it sits in a project they can write to, or
// it is their own task outside any project. Being assigned a task in
// someone else's private project is not enough. The task a subtask finally
// hangs under (its parent's parent, after flattening) is what is checked.
async function dropForeignParents(rows, userId, projects) {
    const withExisting = rows.filter((r) => r.parent && !r.parent.row);
    if (withExisting.length === 0) return;
    const writableProjectIds = new Set(projects.map((p) => p.id));
    const tasks = await Task.findAll({
        where: { id: [...new Set(withExisting.map((r) => r.parent.taskId))] },
        attributes: ['id', 'user_id', 'project_id', 'parent_task_id'],
        raw: true,
    });
    const byId = new Map(tasks.map((t) => [t.id, t]));
    for (const row of withExisting) {
        const task = byId.get(row.parent.taskId);
        const allowed =
            task &&
            !task.parent_task_id &&
            (task.project_id
                ? writableProjectIds.has(task.project_id)
                : task.user_id === userId);
        if (allowed) {
            row.parent.projectId = task.project_id;
            continue;
        }
        row.warnings = row.warnings.filter((w) => w.code !== 'flattened');
        row.warnings.push({
            code: 'parent_not_found',
            value: String(row.parentText || '').slice(0, 80),
        });
        row.parent = undefined;
    }
}

// Parents named in the sheet that are not rows of it: top-level tasks of
// the same project with that name. Rows without a project look everywhere
// the user owns.
async function resolveParentsByName(rows, userId) {
    const pending = rows.filter((r) => r.pendingParentName && !r.parent);
    if (pending.length === 0) return;
    const projectIds = [
        ...new Set(pending.map((r) => r.project?.id).filter(Boolean)),
    ];
    const candidates = await Task.findAll({
        where: {
            parent_task_id: null,
            habit_mode: false,
            [Op.or]: [{ project_id: projectIds }, { user_id: userId }],
        },
        attributes: ['id', 'name', 'project_id', 'parent_task_id', 'user_id'],
        raw: true,
    });
    for (const row of pending) {
        const wanted = key(row.pendingParentName);
        const match = candidates.find(
            (t) =>
                key(t.name) === wanted &&
                (row.project?.id
                    ? t.project_id === row.project.id
                    : !t.project_id && t.user_id === userId)
        );
        if (match) {
            row.parent = existingParent(match);
        } else {
            row.warnings.push({
                code: 'parent_not_found',
                value: row.pendingParentName,
            });
        }
        delete row.pendingParentName;
    }
}

// What the preview shows for one row, without internal references.
function describeRow(row) {
    const projectName =
        row.project === undefined ? undefined : row.project?.name || null;
    return {
        row_number: row.row_number,
        action: row.action,
        name: row.name,
        project: projectName,
        project_is_new: !!row.project?.isNew,
        parent: row.parent?.row?.name || row.parent?.name || null,
        status: row.body.status,
        priority: row.body.priority,
        due: row.dates.due
            ? [row.dates.due.date, row.dates.due.time].filter(Boolean).join(' ')
            : row.dates.due,
        start: row.dates.start
            ? [row.dates.start.date, row.dates.start.time]
                  .filter(Boolean)
                  .join(' ')
            : row.dates.start,
        assigned_to: row.body.assigned_to,
        tags: row.tags,
        errors: row.errors,
        warnings: row.warnings,
    };
}

// The options as plain JSON, for responses and the stored job.
function plainOptions(options) {
    return {
        ...options,
        value_map: Object.fromEntries(
            Object.entries(options.value_map).map(([kind, map]) => [
                kind,
                Object.fromEntries(map),
            ])
        ),
    };
}

module.exports = {
    analyze,
    plainOptions,
    describeRow,
    detectHeaderRow,
    normalizeOptions,
    DATE_FIELDS,
};
