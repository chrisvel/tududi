const { sequelize } = require('../models');

function maxAccess(a, b) {
    if (a === 'rw' || b === 'rw') return 'rw';
    if (a === 'ro' || b === 'ro') return 'ro';
    return 'none';
}

async function applyPerms(tx, changes) {
    const { Permission } = require('../models');
    const upserts = changes.upserts || [];
    const deletes = changes.deletes || [];

    // Upserts: for SQLite we can emulate ON CONFLICT with find+create/update in tx
    for (const u of upserts) {
        const where = {
            user_id: u.userId,
            resource_type: u.resourceType,
            resource_uid: u.resourceUid,
        };
        const existing = await Permission.findOne({
            where,
            transaction: tx,
            lock: tx.LOCK.UPDATE,
        });
        if (existing) {
            const nextLevel = maxAccess(existing.access_level, u.accessLevel);
            await existing.update(
                {
                    access_level: nextLevel,
                    propagation: u.propagation || existing.propagation,
                    granted_by_user_id: u.grantedByUserId,
                    source_action_id:
                        u.sourceActionId || existing.source_action_id || null,
                },
                { transaction: tx }
            );
        } else {
            await Permission.create(
                {
                    user_id: u.userId,
                    resource_type: u.resourceType,
                    resource_uid: u.resourceUid,
                    access_level: u.accessLevel,
                    propagation: u.propagation || 'direct',
                    granted_by_user_id: u.grantedByUserId,
                    source_action_id: u.sourceActionId || null,
                },
                { transaction: tx }
            );
        }
    }

    // Deletes
    for (const d of deletes) {
        await Permission.destroy({
            where: {
                user_id: d.userId,
                resource_type: d.resourceType,
                resource_uid: d.resourceUid,
            },
            transaction: tx,
        });
    }
}

module.exports = { applyPerms };
