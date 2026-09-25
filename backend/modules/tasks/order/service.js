'use strict';

const { Op } = require('sequelize');
const { Task, Project, UserTaskOrder, sequelize } = require('../../../models');
const permissionsService = require('../../../services/permissionsService');
const { NotFoundError, ValidationError } = require('../../../shared/errors');

const MAX_ORDER_TASKS = 5000;
const ALL_SCOPE = 'all';
const BASE_ORDER_BY =
    /^(created_at|updated_at|name|priority|status|due_date|completed_at):(asc|desc)$/;

// Resolves the list a request orders: the All Tasks page, or one project's
// tasks (which needs read access to that project).
async function resolveScope(userId, { scope, project_uid: projectUid }) {
    if (scope === ALL_SCOPE) return { key: ALL_SCOPE, projectId: null };
    if (scope !== 'project') {
        throw new ValidationError("scope must be 'all' or 'project'.");
    }
    if (typeof projectUid !== 'string' || !projectUid) {
        throw new ValidationError('project_uid is required.');
    }
    const project = await Project.findOne({
        where: { uid: projectUid },
        attributes: ['id', 'uid'],
    });
    const access = project
        ? await permissionsService.getAccess(userId, 'project', projectUid)
        : 'none';
    if (!project || access === 'none') {
        throw new NotFoundError('Project not found.');
    }
    return { key: `project:${project.id}`, projectId: project.id };
}

// The saved order of a list, as task uids. Rows of deleted tasks drop out
// through the join.
async function getOrderedUids(userId, scopeKey) {
    const rows = await UserTaskOrder.findAll({
        where: { user_id: userId, scope: scopeKey },
        attributes: ['position'],
        include: [{ model: Task, as: 'Task', attributes: ['uid'] }],
        order: [['position', 'ASC']],
    });
    return rows.filter((row) => row.Task).map((row) => row.Task.uid);
}

async function getOrder(userId, query) {
    const scope = await resolveScope(userId, query);
    return { task_uids: await getOrderedUids(userId, scope.key) };
}

// The order a first drag starts from when the list was sorted another way
// (All Tasks only; it is paged, so the client cannot send the full list).
async function seedAllOrder(userId, baseOrderBy, timezone) {
    // Required lazily: query-builders requires this module for ORDER BY.
    const { filterTasksByParams } = require('../queries/query-builders');
    const tasks = await filterTasksByParams(
        { order_by: baseOrderBy, status: 'all' },
        userId,
        timezone
    );
    return tasks.map((task) => task.uid);
}

// Saves a drag. The client sends the tasks it shows, in their new order;
// lists are paged and filtered, so those tasks are reordered within the
// slots they hold in the full order and everything else stays put. The
// full order is the saved one, or for a drag made under another sort
// (`base_order_by`), that sort.
async function saveOrder(userId, body, timezone) {
    const taskUids = body?.task_uids;
    if (
        !Array.isArray(taskUids) ||
        taskUids.some((uid) => typeof uid !== 'string' || !uid)
    ) {
        throw new ValidationError('task_uids must be a list of UIDs.');
    }
    if (taskUids.length > MAX_ORDER_TASKS) {
        throw new ValidationError(
            `Cannot order more than ${MAX_ORDER_TASKS} tasks.`
        );
    }
    if (new Set(taskUids).size !== taskUids.length) {
        throw new ValidationError('task_uids contains duplicates.');
    }

    const scope = await resolveScope(userId, body);
    const visibleWhere = await permissionsService.ownershipOrPermissionWhere(
        'task',
        userId
    );
    const conditions = [visibleWhere, { uid: { [Op.in]: taskUids } }];
    if (scope.projectId !== null) {
        conditions.push({ project_id: scope.projectId });
    }
    const tasks = taskUids.length
        ? await Task.findAll({
              where: { [Op.and]: conditions },
              attributes: ['id', 'uid', 'created_at'],
              raw: true,
          })
        : [];
    if (tasks.length !== taskUids.length) {
        throw new NotFoundError('One or more tasks not found.');
    }

    const baseOrderBy = body.base_order_by;
    if (baseOrderBy !== undefined && !BASE_ORDER_BY.test(baseOrderBy)) {
        throw new ValidationError('base_order_by is not a valid sort.');
    }
    const saved =
        baseOrderBy && scope.key === ALL_SCOPE
            ? await seedAllOrder(userId, baseOrderBy, timezone)
            : await getOrderedUids(userId, scope.key);
    const savedSet = new Set(saved);
    // Unplaced tasks sort first, newest first, in every custom list.
    const unplaced = tasks
        .filter((task) => !savedSet.has(task.uid))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map((task) => task.uid);
    const current = [...unplaced, ...saved];
    const moved = new Set(taskUids);
    let next = 0;
    const newOrder = current.map((uid) =>
        moved.has(uid) ? taskUids[next++] : uid
    );

    const idByUid = new Map(tasks.map((task) => [task.uid, task.id]));
    const missing = newOrder.filter((uid) => !idByUid.has(uid));
    if (missing.length) {
        const rows = await Task.findAll({
            where: { uid: { [Op.in]: missing } },
            attributes: ['id', 'uid'],
            raw: true,
        });
        rows.forEach((row) => idByUid.set(row.uid, row.id));
    }

    await sequelize.transaction(async (transaction) => {
        await UserTaskOrder.destroy({
            where: { user_id: userId, scope: scope.key },
            transaction,
        });
        await UserTaskOrder.bulkCreate(
            newOrder
                .filter((uid) => idByUid.has(uid))
                .map((uid, index) => ({
                    user_id: userId,
                    task_id: idByUid.get(uid),
                    scope: scope.key,
                    position: index,
                })),
            { transaction }
        );
    });

    return { task_uids: newOrder };
}

// ORDER BY for `order_by=custom` on GET /tasks: placed tasks by position,
// unplaced ones first and newest first.
function customOrderClause(userId) {
    const position = `(SELECT uto.position FROM user_task_orders uto WHERE uto.task_id = "Task"."id" AND uto.user_id = ${Number(userId)} AND uto.scope = '${ALL_SCOPE}')`;
    return [
        [
            sequelize.literal(
                `CASE WHEN ${position} IS NULL THEN 0 ELSE 1 END`
            ),
            'ASC',
        ],
        [sequelize.literal(position), 'ASC'],
        ['created_at', 'DESC'],
    ];
}

module.exports = {
    getOrder,
    saveOrder,
    customOrderClause,
};
