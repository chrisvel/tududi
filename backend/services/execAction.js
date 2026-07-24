const { sequelize, Action } = require('../models');
const { isAdmin } = require('./rolesService');
const { applyPerms } = require('./applyPerms');
const {
    calculateProjectPerms,
    calculateTaskPerms,
    calculateNotePerms,
    calculateAreaPerms,
    calculateTagPerms,
} = require('./permissionsCalculators');

async function assertActorCanShare(actorUserId, resourceType, resourceOwnerId) {
    if (await isAdmin(actorUserId)) return;
    if (resourceOwnerId !== actorUserId) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
    }
}

const OWNER_MODELS = {
    project: 'Project',
    task: 'Task',
    note: 'Note',
    area: 'Area',
};

async function resolveOwnerUserId(tx, resourceType, resourceUid) {
    const modelName = OWNER_MODELS[resourceType];
    if (!modelName) return null;
    const models = require('../models');
    const resource = await models[modelName].findOne({
        where: { uid: resourceUid },
        attributes: ['user_id'],
        transaction: tx,
        lock: tx.LOCK.UPDATE,
    });
    if (!resource) {
        const err = new Error('Resource not found');
        err.status = 404;
        throw err;
    }
    return resource.user_id;
}

async function execAction(action) {
    // action: { verb, actorUserId, targetUserId, resourceType, resourceUid, accessLevel? }
    return await sequelize.transaction(async (tx) => {
        const ownerUserId = await resolveOwnerUserId(
            tx,
            action.resourceType,
            action.resourceUid
        );

        await assertActorCanShare(
            action.actorUserId,
            action.resourceType,
            ownerUserId
        );

        const actionRow = await Action.create(
            {
                actor_user_id: action.actorUserId,
                verb: action.verb,
                resource_type: action.resourceType,
                resource_uid: action.resourceUid,
                target_user_id: action.targetUserId,
                access_level: action.accessLevel || null,
                metadata: null,
            },
            { transaction: tx }
        );

        let changes = { upserts: [], deletes: [] };
        const ctx = { tx };

        if (action.resourceType === 'project') {
            changes = await calculateProjectPerms(ctx, action);
        } else if (action.resourceType === 'task') {
            changes = await calculateTaskPerms(ctx, action);
        } else if (action.resourceType === 'note') {
            changes = await calculateNotePerms(ctx, action);
        } else if (action.resourceType === 'area') {
            changes = await calculateAreaPerms(ctx, action);
        } else if (action.resourceType === 'tag') {
            changes = await calculateTagPerms(ctx, action);
        }

        // Attach source_action_id
        changes.upserts = changes.upserts.map((u) => ({
            ...u,
            source_action_id: actionRow.id,
        }));

        await applyPerms(tx, changes);

        return actionRow.id;
    });
}

module.exports = { execAction };
