'use strict';

const { withReason } = require('./core/errors');
const { Op } = require('sequelize');
const {
    ImportJob,
    Task,
    TaskAttachment,
    Project,
    Area,
    Tag,
    sequelize,
} = require('../../models');
const entitlements = require('../../services/entitlementsService');
const permissionsService = require('../../services/permissionsService');
const { logError } = require('../../services/logService');
const {
    NotFoundError,
    ValidationError,
    ConflictError,
} = require('../../shared/errors');
const {
    buildTaskAttributes,
    buildUpdateAttributes,
} = require('../tasks/core/builders');
const { handleCompletionStatus } = require('../tasks/operations/completion');
const { destroyTaskRows } = require('../tasks/operations/deletion');
const { captureOldValues, logTaskChanges } = require('../tasks/utils/logging');
const { notifyAssignee } = require('../tasks/operations/assignment');
const {
    dueDateTimeToUTC,
    dateStringToUTC,
} = require('../../utils/timezone-utils');
const { projectsService } = require('../projects');
const { areasService } = require('../areas');
const { readSpreadsheet } = require('./core/files');
const { suggestMapping } = require('./core/columns');
const {
    analyze,
    describeRow,
    detectHeaderRow,
    plainOptions,
} = require('./analyze');

const STAGING_HOURS = 24;
// Uploads waiting to be committed, per user. Each holds the parsed file.
const MAX_STAGED = 5;
const UNDO_DAYS = 7;
const PREVIEW_ROWS = 1000;
const SAMPLE_ROWS = 5;

// Task fields an import may change, and so the ones an undo puts back.
const RESTORABLE_FIELDS = [
    'name',
    'note',
    'status',
    'priority',
    'due_date',
    'due_has_time',
    'start_date',
    'start_has_time',
    'defer_until',
    'estimated_minutes',
    'assigned_to',
    'project_id',
    'area_id',
    'parent_task_id',
    'completed_at',
];

function sheetColumns(sheet, headerRow) {
    const headers = sheet.rows[headerRow] || [];
    const data = sheet.rows.slice(headerRow + 1);
    return {
        header_row: headerRow,
        headers,
        sample: data.slice(0, SAMPLE_ROWS),
        row_count: data.length,
        suggested_mapping: suggestMapping(headers, data),
    };
}

function describeJob(job) {
    const sheets = job.sheets || [];
    return {
        uid: job.uid,
        file_name: job.file_name,
        status: job.status,
        // Set for text files; the wizard offers to re-read one that was
        // not UTF-8 in another code page.
        encoding:
            job.status === 'parsed' ? job.options?.encoding || null : null,
        created_at: job.created_at,
        committed_at: job.committed_at,
        undone_at: job.undone_at,
        sheets: sheets.map((sheet) => ({
            name: sheet.name,
            truncated: sheet.truncated,
            has_levels: (sheet.levels || []).some((l) => l > 0),
            ...sheetColumns(sheet, detectHeaderRow(sheet.rows)),
        })),
        result: job.result
            ? {
                  counts: job.result.counts,
                  can_undo: canUndo(job),
              }
            : null,
    };
}

function canUndo(job) {
    if (job.status !== 'committed' || !job.committed_at) return false;
    const age = Date.now() - new Date(job.committed_at).getTime();
    return age < UNDO_DAYS * 24 * 60 * 60 * 1000;
}

async function findJob(userId, uid) {
    const job = await ImportJob.findOne({
        where: { uid: String(uid), user_id: userId },
    });
    if (!job)
        throw withReason(
            new NotFoundError('Import not found.'),
            'import_not_found'
        );
    return job;
}

async function findParsedJob(userId, uid) {
    const job = await findJob(userId, uid);
    if (job.status !== 'parsed' || !job.sheets) {
        throw withReason(
            new ConflictError('This import has already run.'),
            'already_ran'
        );
    }
    return job;
}

async function upload(user, file, { encoding } = {}) {
    if (!file?.buffer?.length) {
        throw withReason(
            new ValidationError('Choose a CSV or Excel file to import.'),
            'no_file'
        );
    }
    // Uploads nobody finished are only worth keeping for a day.
    await ImportJob.destroy({
        where: {
            user_id: user.id,
            status: 'parsed',
            created_at: {
                [Op.lt]: new Date(Date.now() - STAGING_HOURS * 3600 * 1000),
            },
        },
    });
    const staged = await ImportJob.findAll({
        where: { user_id: user.id, status: 'parsed' },
        attributes: ['id'],
        order: [['created_at', 'DESC']],
    });
    if (staged.length >= MAX_STAGED) {
        await ImportJob.destroy({
            where: {
                id: staged.slice(MAX_STAGED - 1).map((j) => j.id),
            },
        });
    }
    const { sheets, encoding: usedEncoding } = await readSpreadsheet(
        file.buffer,
        file.originalname,
        { encoding }
    );
    const job = await ImportJob.create({
        user_id: user.id,
        file_name: String(file.originalname || 'import').slice(0, 255),
        status: 'parsed',
        sheets,
        options: { encoding: usedEncoding },
    });
    return describeJob(job);
}

async function columns(user, uid, { sheet = 0, header_row } = {}) {
    const job = await findParsedJob(user.id, uid);
    const chosen = Number.isInteger(sheet) ? job.sheets[sheet] : undefined;
    if (!chosen)
        throw withReason(
            new ValidationError('Unknown sheet.'),
            'unknown_sheet'
        );
    const headerRow = Number.isInteger(header_row)
        ? Math.min(Math.max(header_row, 0), chosen.rows.length - 1)
        : detectHeaderRow(chosen.rows);
    return sheetColumns(chosen, headerRow);
}

function summarize(plan) {
    const flagged = plan.rows.filter(
        (r) => r.errors.length || r.warnings.length
    );
    const shown = plan.rows.slice(0, PREVIEW_ROWS);
    const extra = flagged.filter((r) => !shown.includes(r));
    return {
        options: plainOptions(plan.options),
        problems: plan.problems,
        counts: plan.counts,
        date_columns: plan.date_columns,
        hierarchy_used: plan.options.hierarchy_used,
        new_projects: plan.new_projects.map((p) => p.name),
        new_areas: plan.new_areas.map((a) => a.name),
        unknown_values: plan.unknown_values,
        assignable: plan.assignable,
        rows: [...shown, ...extra].map(describeRow),
        total_rows: plan.rows.length,
    };
}

async function preview(user, uid, options) {
    const job = await findParsedJob(user.id, uid);
    const plan = await analyze(user, job.sheets, options);
    return summarize(plan);
}

function tagsSnapshot(task) {
    return (task.Tags || []).map((t) => t.id);
}

async function tagsByName(userId, names, transaction) {
    if (names.length === 0) return { map: new Map(), created: [] };
    const existing = await Tag.findAll({
        where: { user_id: userId, name: names },
        transaction,
    });
    const map = new Map(existing.map((t) => [t.name, t]));
    const created = [];
    for (const name of names) {
        if (map.has(name)) continue;
        const tag = await Tag.create(
            { name, user_id: userId },
            { transaction }
        );
        map.set(name, tag);
        created.push(tag.id);
    }
    return { map, created };
}

function completedAtFor(row, timezone) {
    const value = row.completedAt;
    if (!value) return new Date();
    return value.time
        ? dueDateTimeToUTC(value.date, value.time, timezone)
        : dateStringToUTC(value.date, timezone, 'end');
}

// Parents before their subtasks, so a subtask can point at a row created a
// moment earlier.
function writeOrder(rows) {
    const live = rows.filter((r) => r.action !== 'skip');
    return [
        ...live.filter((r) => !r.parent?.row),
        ...live.filter((r) => r.parent?.row),
    ];
}

// Moves a job from one status to another only if nobody else did first,
// so two commits (or two undos) of the same job cannot both run.
async function claim(job, from, to) {
    const [changed] = await ImportJob.update(
        { status: to },
        { where: { id: job.id, status: from } }
    );
    if (changed !== 1) {
        throw withReason(
            new ConflictError('This import is already running or has run.'),
            'already_ran'
        );
    }
}

async function release(job, from, to) {
    await ImportJob.update(
        { status: to },
        { where: { id: job.id, status: from } }
    ).catch((error) => logError('Could not release import job', error));
}

async function commit(user, uid, options) {
    const job = await findParsedJob(user.id, uid);
    const plan = await analyze(user, job.sheets, options);
    if (plan.problems.length > 0) {
        throw withReason(
            new ValidationError(
                'The import cannot run until the problems shown are fixed.'
            ),
            'has_problems'
        );
    }
    if (plan.counts.create + plan.counts.update === 0) {
        throw withReason(
            new ValidationError('There are no rows to import.'),
            'no_rows_to_import'
        );
    }

    await claim(job, 'parsed', 'committing');
    try {
        const outcome = await writePlan(user, job, plan);
        await afterCommit(user, outcome.followUps);
        return {
            uid: job.uid,
            counts: outcome.result.counts,
            project_uids: await projectUids(outcome.result, plan),
        };
    } catch (error) {
        await release(job, 'committing', 'parsed');
        throw error;
    }
}

async function writePlan(user, job, plan) {
    if (plan.counts.create > 0) {
        await entitlements.assertCanCreate(user.id, 'task', plan.counts.create);
    }
    if (plan.new_projects.length > 0) {
        await entitlements.assertCanCreate(
            user.id,
            'project',
            plan.new_projects.length
        );
    }

    const userId = user.id;
    const { timezone } = plan;
    const result = {
        created_task_ids: [],
        created_project_ids: [],
        created_area_ids: [],
        created_tag_ids: [],
        updated: [],
    };
    const followUps = [];

    await sequelize.transaction(async (transaction) => {
        for (const area of plan.new_areas) {
            const row = await Area.create(
                { name: area.name, user_id: userId },
                { transaction }
            );
            area.id = row.id;
            result.created_area_ids.push(row.id);
        }
        for (const project of plan.new_projects) {
            const row = await Project.create(
                {
                    name: project.name,
                    user_id: userId,
                    status: 'not_started',
                    area_id: project.area_id || project.area?.id || null,
                },
                { transaction }
            );
            project.id = row.id;
            result.created_project_ids.push(row.id);
        }

        const tagNames = [...new Set(plan.rows.flatMap((r) => r.tags || []))];
        const tags = await tagsByName(userId, tagNames, transaction);
        result.created_tag_ids = tags.created;
        const tagsFor = (names) => names.map((n) => tags.map.get(n));

        for (const row of writeOrder(plan.rows)) {
            const projectId = row.project ? row.project.id : row.project;
            const parentId = row.parent
                ? row.parent.row
                    ? row.parent.row.taskId
                    : row.parent.taskId
                : undefined;

            if (row.action === 'create') {
                const attrs = buildTaskAttributes(row.body, userId, timezone);
                attrs.project_id = projectId || null;
                attrs.area_id = !projectId && row.area ? row.area.id : null;
                if (parentId) attrs.parent_task_id = parentId;
                if (attrs.status === Task.STATUS.DONE) {
                    attrs.completed_at = completedAtFor(row, timezone);
                }
                // The importer's own new tasks: one summary, not a webhook
                // per row.
                const task = await Task.create(attrs, {
                    transaction,
                    skipWebhooks: true,
                });
                row.taskId = task.id;
                result.created_task_ids.push(task.id);
                if (row.tags?.length) {
                    await task.setTags(tagsFor(row.tags), { transaction });
                }
                if (task.assigned_to) {
                    followUps.push({ task, previousAssignee: null });
                }
                continue;
            }

            const task = row.existing;
            const before = {};
            for (const field of RESTORABLE_FIELDS) before[field] = task[field];
            const oldValues = captureOldValues(task);
            const attrs = buildUpdateAttributes(row.body, task, timezone);
            if (row.body.status !== undefined) {
                await handleCompletionStatus(attrs, row.body.status, task);
                if (
                    attrs.completed_at &&
                    row.completedAt &&
                    attrs.status === Task.STATUS.DONE
                ) {
                    attrs.completed_at = completedAtFor(row, timezone);
                }
            }
            if (projectId !== undefined) attrs.project_id = projectId;
            if (parentId !== undefined && parentId !== task.id) {
                attrs.parent_task_id = parentId;
            }
            // Someone else's task changed through a shared project: its
            // owner's webhooks hear about it as they would from the app.
            await task.update(attrs, {
                transaction,
                skipWebhooks: task.user_id === userId,
            });
            row.taskId = task.id;
            const entry = { id: task.id, before };
            let newTags;
            if (row.tags !== undefined) {
                entry.tags_before = tagsSnapshot(task);
                newTags = tagsFor(row.tags);
                await task.setTags(newTags, { transaction });
            }
            result.updated.push(entry);
            followUps.push({
                task,
                previousAssignee: before.assigned_to,
                history: {
                    oldValues,
                    body: {
                        ...row.body,
                        ...(projectId !== undefined
                            ? { project_id: projectId }
                            : {}),
                    },
                    tags: newTags,
                },
            });
        }

        result.counts = {
            created: result.created_task_ids.length,
            updated: result.updated.length,
            skipped: plan.counts.skip,
            new_projects: result.created_project_ids.length,
            new_areas: result.created_area_ids.length,
        };
        await ImportJob.update(
            {
                status: 'committed',
                committed_at: new Date(),
                options: plainOptions(plan.options),
                result,
                // The file itself is not needed any more; what was done is.
                sheets: null,
            },
            { where: { id: job.id, status: 'committing' }, transaction }
        );
    });

    return { result, followUps };
}

// Task history and assignment notices, written once the import is in.
// They are what the task API records for the same changes.
async function afterCommit(user, followUps) {
    for (const { task, previousAssignee, history } of followUps) {
        try {
            if (history) {
                await logTaskChanges(
                    task,
                    history.oldValues,
                    history.body,
                    history.tags,
                    user.id
                );
            }
            if (task.assigned_to && task.assigned_to !== previousAssignee) {
                await notifyAssignee(task, previousAssignee, user.id);
            }
        } catch (error) {
            logError('Import follow-up failed for a task', error);
        }
    }
}

async function projectUids(result, plan) {
    const ids = new Set(result.created_project_ids);
    for (const row of plan.rows) if (row.project?.id) ids.add(row.project.id);
    if (ids.size === 0) return [];
    const projects = await Project.findAll({
        where: { id: [...ids] },
        attributes: ['uid'],
        raw: true,
    });
    return projects.map((p) => p.uid);
}

// Takes an import back: deletes the tasks it created, puts updated tasks
// back as they were, and removes projects and areas it created once nothing
// is left in them.
async function undo(user, uid) {
    const job = await findJob(user.id, uid);
    if (!canUndo(job)) {
        throw withReason(
            new ConflictError('This import can no longer be undone.'),
            'undo_expired'
        );
    }
    await claim(job, 'committed', 'undoing');
    try {
        const kept = await undoWrites(user, job);
        await job.update({ status: 'undone', undone_at: new Date() });
        return { ...describeJob(job), kept_changed: kept };
    } catch (error) {
        await release(job, 'undoing', 'committed');
        throw error;
    }
}

// Returns how many updated tasks were left alone because someone changed
// them after the import.
async function undoWrites(user, job) {
    const result = job.result || {};
    const userId = user.id;
    const committedAt = new Date(job.committed_at).getTime();
    let kept = 0;
    const createdIds = result.created_task_ids || [];

    if (createdIds.length > 0) {
        const tasks = await Task.findAll({
            where: { id: createdIds, user_id: userId },
            include: [{ model: TaskAttachment, as: 'Attachments' }],
        });
        // Worked on since the import: kept, so nobody's changes are lost.
        const doomed = tasks.filter(
            (task) => new Date(task.updated_at).getTime() <= committedAt + 5000
        );
        kept += tasks.length - doomed.length;
        const doomedIds = doomed.map((task) => task.id);
        if (doomedIds.length > 0) {
            // Subtasks that stay (added later, or kept above) move to the
            // top level rather than point at a deleted task.
            await Task.update(
                { parent_task_id: null },
                {
                    where: {
                        parent_task_id: doomedIds,
                        id: { [Op.notIn]: doomedIds },
                    },
                }
            );
        }
        doomed.sort(
            (a, b) => (b.parent_task_id ? 1 : 0) - (a.parent_task_id ? 1 : 0)
        );
        for (const task of doomed) {
            await destroyTaskRows(task, { skipWebhooks: true });
        }
    }

    for (const entry of result.updated || []) {
        const task = await Task.findByPk(entry.id);
        if (!task) continue;
        // Access may have changed in the days since the import.
        if (task.user_id !== userId) {
            const access = await permissionsService.getAccess(
                userId,
                'task',
                task.uid
            );
            if (access !== 'rw' && access !== 'admin') continue;
        }
        // Edited since the import: putting the old values back would throw
        // that work away.
        if (new Date(task.updated_at).getTime() > committedAt + 5000) {
            kept++;
            continue;
        }
        await task.update(entry.before, {
            skipWebhooks: task.user_id === userId,
        });
        if (entry.tags_before) {
            const tags = await Tag.findAll({
                where: { id: entry.tags_before },
            });
            await task.setTags(tags);
        }
    }

    for (const projectId of result.created_project_ids || []) {
        const project = await Project.findByPk(projectId, {
            attributes: ['id', 'uid', 'user_id'],
        });
        if (!project || project.user_id !== userId) continue;
        const left = await Task.count({ where: { project_id: projectId } });
        if (left > 0) continue;
        try {
            await projectsService.delete(userId, project.uid);
        } catch (error) {
            logError('Undo import: could not delete project', error);
        }
    }

    for (const areaId of result.created_area_ids || []) {
        const area = await Area.findByPk(areaId, {
            attributes: ['id', 'uid', 'user_id'],
        });
        if (!area || area.user_id !== userId) continue;
        const [projects, tasks] = await Promise.all([
            Project.count({ where: { area_id: areaId } }),
            Task.count({ where: { area_id: areaId } }),
        ]);
        if (projects + tasks > 0) continue;
        try {
            await areasService.delete(userId, area.uid);
        } catch (error) {
            logError('Undo import: could not delete area', error);
        }
    }

    return kept;
}

async function list(user) {
    const jobs = await ImportJob.findAll({
        where: { user_id: user.id, status: ['committed', 'undone'] },
        attributes: [
            'uid',
            'file_name',
            'status',
            'result',
            'created_at',
            'committed_at',
            'undone_at',
        ],
        order: [['created_at', 'DESC']],
        limit: 10,
    });
    return jobs.map((job) => ({
        uid: job.uid,
        file_name: job.file_name,
        status: job.status,
        committed_at: job.committed_at,
        undone_at: job.undone_at,
        counts: job.result?.counts || null,
        can_undo: canUndo(job),
    }));
}

async function discard(user, uid) {
    const job = await findParsedJob(user.id, uid);
    await job.destroy();
}

async function get(user, uid) {
    return describeJob(await findJob(user.id, uid));
}

module.exports = {
    upload,
    columns,
    preview,
    commit,
    undo,
    list,
    discard,
    get,
};
