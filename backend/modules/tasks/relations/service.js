const { Op } = require('sequelize');
const { Task, TaskRelation, sequelize } = require('../../../models');
const permissionsService = require('../../../services/permissionsService');
const { logEvent } = require('../taskEventService');
const { logError } = require('../../../services/logService');

const { ACCESS } = permissionsService;

const INPUT_TYPES = [
    'blocks',
    'blocked_by',
    'related_to',
    'duplicates',
    'duplicated_by',
];

const INVERSE_TYPE = {
    blocks: 'blocked_by',
    blocked_by: 'blocks',
    related_to: 'related_to',
    duplicates: 'duplicated_by',
    duplicated_by: 'duplicates',
};

const RESOLVED_STATUSES = [
    Task.STATUS.DONE,
    Task.STATUS.ARCHIVED,
    Task.STATUS.CANCELLED,
];

const MAX_CYCLE_DEPTH = 100;

class RelationError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// Where-fragment for "has (or has no) open blocker", shared by the REST list
// filter and the MCP list_tasks tool.
function blockedCondition(wantBlocked) {
    const openBlockedIds = sequelize.literal(
        `(SELECT tr.target_task_id FROM task_relations tr
          INNER JOIN tasks blocker ON blocker.id = tr.source_task_id
          WHERE tr.relation_type = 'blocks'
          AND blocker.status NOT IN (${RESOLVED_STATUSES.join(', ')}))`
    );
    return { id: { [wantBlocked ? Op.in : Op.notIn]: openBlockedIds } };
}

async function getBlockedCountMap(taskIds) {
    const ids = [...new Set((taskIds || []).filter(Boolean))];
    if (ids.length === 0) return {};

    const rows = await TaskRelation.findAll({
        where: { relation_type: 'blocks', target_task_id: { [Op.in]: ids } },
        attributes: ['target_task_id'],
        include: [
            {
                model: Task,
                as: 'SourceTask',
                attributes: [],
                where: { status: { [Op.notIn]: RESOLVED_STATUSES } },
                required: true,
            },
        ],
        raw: true,
    });

    const counts = {};
    rows.forEach((row) => {
        counts[row.target_task_id] = (counts[row.target_task_id] || 0) + 1;
    });
    return counts;
}

function toView(relation, taskId, otherTask) {
    const isSource = relation.source_task_id === taskId;
    return {
        uid: relation.uid,
        type: isSource
            ? relation.relation_type
            : INVERSE_TYPE[relation.relation_type],
        task: {
            uid: otherTask.uid,
            name: otherTask.name,
            status: otherTask.status,
        },
    };
}

async function listRelations(task, viewerId) {
    const rows = await TaskRelation.findAll({
        where: {
            [Op.or]: [{ source_task_id: task.id }, { target_task_id: task.id }],
        },
        include: [
            {
                model: Task,
                as: 'SourceTask',
                attributes: ['id', 'uid', 'name', 'status'],
            },
            {
                model: Task,
                as: 'TargetTask',
                attributes: ['id', 'uid', 'name', 'status'],
            },
        ],
        order: [['id', 'ASC']],
    });

    const views = [];
    for (const relation of rows) {
        const other =
            relation.source_task_id === task.id
                ? relation.TargetTask
                : relation.SourceTask;
        if (!other) continue;

        // A relation to a task the viewer cannot read is left out, so a
        // link never reveals the name or status of a hidden task.
        const access = await permissionsService.getAccess(
            viewerId,
            'task',
            other.uid
        );
        if (access === ACCESS.NONE) continue;

        views.push(toView(relation, task.id, other));
    }

    return views;
}

async function getOpenBlockers(task, viewerId) {
    const views = await listRelations(task, viewerId);
    return views
        .filter(
            (v) =>
                v.type === 'blocked_by' &&
                !RESOLVED_STATUSES.includes(v.task.status)
        )
        .map((v) => v.task);
}

async function wouldCreateBlockCycle(sourceId, targetId) {
    // Adding "source blocks target" closes a loop when target already
    // (transitively) blocks source. Walk outward from target, one query
    // per level.
    let frontier = [targetId];
    const visited = new Set(frontier);

    for (let depth = 0; depth < MAX_CYCLE_DEPTH && frontier.length; depth++) {
        const edges = await TaskRelation.findAll({
            where: {
                relation_type: 'blocks',
                source_task_id: { [Op.in]: frontier },
            },
            attributes: ['target_task_id'],
            raw: true,
        });

        const next = [];
        for (const edge of edges) {
            if (edge.target_task_id === sourceId) return true;
            if (!visited.has(edge.target_task_id)) {
                visited.add(edge.target_task_id);
                next.push(edge.target_task_id);
            }
        }
        frontier = next;
    }

    return false;
}

function normalize(sourceTask, targetTask, type) {
    if (type === 'blocked_by') {
        return { source: targetTask, target: sourceTask, type: 'blocks' };
    }
    if (type === 'duplicated_by') {
        return { source: targetTask, target: sourceTask, type: 'duplicates' };
    }
    if (type === 'related_to' && sourceTask.id > targetTask.id) {
        return { source: targetTask, target: sourceTask, type };
    }
    return { source: sourceTask, target: targetTask, type };
}

async function logRelationEvent(eventType, userId, entries) {
    for (const { task, relationType, otherUid } of entries) {
        const value = { relationType, task: otherUid };
        try {
            await logEvent({
                taskId: task.id,
                userId,
                eventType,
                newValue: eventType === 'relation_added' ? value : null,
                oldValue: eventType === 'relation_removed' ? value : null,
                metadata: { action: eventType },
            });
        } catch (error) {
            logError('Failed to log relation event:', error);
        }
    }
}

async function createRelation({ task, targetUid, type, userId }) {
    if (!INPUT_TYPES.includes(type)) {
        throw new RelationError(400, 'Invalid relation type.');
    }
    if (!targetUid || typeof targetUid !== 'string') {
        throw new RelationError(400, 'target_uid is required.');
    }
    if (targetUid === task.uid) {
        throw new RelationError(400, 'A task cannot be related to itself.');
    }

    const targetTask = await Task.findOne({ where: { uid: targetUid } });
    if (!targetTask) {
        throw new RelationError(404, 'Target task not found.');
    }

    // Linking changes what both owners see, so the caller needs write
    // access to both endpoints. A task that is invisible to them reads as
    // not found.
    const targetAccess = await permissionsService.getAccess(
        userId,
        'task',
        targetTask.uid
    );
    if (targetAccess === ACCESS.NONE) {
        throw new RelationError(404, 'Target task not found.');
    }
    if (targetAccess === ACCESS.RO) {
        throw new RelationError(
            403,
            'You need edit access to the target task.'
        );
    }

    const {
        source,
        target,
        type: storedType,
    } = normalize(task, targetTask, type);

    const reverse = await TaskRelation.findOne({
        where: {
            source_task_id: target.id,
            target_task_id: source.id,
            relation_type: storedType,
        },
    });
    if (reverse && storedType !== 'related_to') {
        throw new RelationError(
            409,
            storedType === 'blocks'
                ? 'These tasks already block each other.'
                : 'The reverse relation already exists.'
        );
    }

    if (
        storedType === 'blocks' &&
        (await wouldCreateBlockCycle(source.id, target.id))
    ) {
        throw new RelationError(
            409,
            'This would create a circular blocking chain.'
        );
    }

    const existing = await TaskRelation.findOne({
        where: {
            source_task_id: source.id,
            target_task_id: target.id,
            relation_type: storedType,
        },
    });
    if (existing) {
        throw new RelationError(409, 'This relation already exists.');
    }

    const relation = await TaskRelation.create({
        source_task_id: source.id,
        target_task_id: target.id,
        relation_type: storedType,
        created_by_user_id: userId,
    });

    await logRelationEvent('relation_added', userId, [
        { task, relationType: type, otherUid: targetTask.uid },
        {
            task: targetTask,
            relationType: INVERSE_TYPE[type],
            otherUid: task.uid,
        },
    ]);

    return toView(relation, task.id, targetTask);
}

async function deleteRelation({ task, relationUid, userId }) {
    const relation = await TaskRelation.findOne({
        where: {
            uid: relationUid,
            [Op.or]: [{ source_task_id: task.id }, { target_task_id: task.id }],
        },
    });
    if (!relation) {
        throw new RelationError(404, 'Relation not found.');
    }

    const otherId =
        relation.source_task_id === task.id
            ? relation.target_task_id
            : relation.source_task_id;
    const otherTask = await Task.findOne({
        where: { id: otherId },
        attributes: ['id', 'uid'],
    });

    await relation.destroy();

    if (otherTask) {
        const viewType =
            relation.source_task_id === task.id
                ? relation.relation_type
                : INVERSE_TYPE[relation.relation_type];
        await logRelationEvent('relation_removed', userId, [
            { task, relationType: viewType, otherUid: otherTask.uid },
            {
                task: otherTask,
                relationType: INVERSE_TYPE[viewType],
                otherUid: task.uid,
            },
        ]);
    }
}

module.exports = {
    RelationError,
    RESOLVED_STATUSES,
    INPUT_TYPES,
    getBlockedCountMap,
    blockedCondition,
    listRelations,
    getOpenBlockers,
    createRelation,
    deleteRelation,
};
