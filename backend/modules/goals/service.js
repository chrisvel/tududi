'use strict';

const goalsRepository = require('./repository');
// LTD-PATCH(T-401): validate and journal hierarchy changes through domain services.
const { Area, Goal } = require('../../models');
const hierarchy = require('../ltd-progress/hierarchy');
const { defaultPeriod } = require('../ltd-progress/periods');
const { withJournal } = require('../ltd-journal/service');
const permissionsService = require('../../services/permissionsService');
const {
    NotFoundError,
    ValidationError,
    ForbiddenError,
} = require('../../shared/errors');

const { ACCESS } = permissionsService;

const MAX_REORDER_GOALS = 5000;

class GoalsService {
    // A goal can only be placed in an area the caller owns or can edit.
    // Nonexistent and inaccessible areas get the same error so area ids
    // cannot be probed.
    async resolveAreaId(userId, areaId) {
        if (areaId === undefined || areaId === null || areaId === '') {
            return null;
        }

        const area = await Area.findByPk(areaId, { attributes: ['id', 'uid'] });
        const access = area
            ? await permissionsService.getAccess(userId, 'area', area.uid)
            : 'none';
        if (access !== 'rw' && access !== 'admin') {
            throw new ValidationError('Invalid area');
        }
        return area.id;
    }

    async getAll(userId, areaId, areaUid) {
        let goals;
        if (areaUid || areaId) {
            const area = await Area.findOne({
                where: areaUid ? { uid: areaUid } : { id: areaId },
                attributes: ['id', 'uid'],
            });
            const access = area
                ? await permissionsService.getAccess(userId, 'area', area.uid)
                : ACCESS.NONE;
            if (access === ACCESS.NONE) return [];
            goals = await goalsRepository.findAllByArea(userId, area.id);
        } else {
            goals = await goalsRepository.findAllByUser(userId);
        }

        const positions = await goalsRepository.getUserGoalPositions(userId);
        return goals.map((goal) => ({
            ...goal,
            sort_position: positions[goal.id] ?? null,
        }));
    }

    /**
     * Save the user's custom order of the Goals page.
     */
    async reorder(userId, goalUids) {
        if (
            !Array.isArray(goalUids) ||
            goalUids.some((uid) => typeof uid !== 'string' || !uid)
        ) {
            throw new ValidationError('goal_uids must be a list of UIDs.');
        }
        if (goalUids.length > MAX_REORDER_GOALS) {
            throw new ValidationError(
                `Cannot order more than ${MAX_REORDER_GOALS} goals.`
            );
        }
        if (new Set(goalUids).size !== goalUids.length) {
            throw new ValidationError('goal_uids contains duplicates.');
        }

        const whereClause = await permissionsService.ownershipOrPermissionWhere(
            'goal',
            userId
        );
        const goals = goalUids.length
            ? await goalsRepository.findIdsByUids(whereClause, goalUids)
            : [];
        if (goals.length !== goalUids.length) {
            throw new NotFoundError('One or more goals not found.');
        }

        const idByUid = new Map(goals.map((g) => [g.uid, g.id]));
        await goalsRepository.replaceUserGoalOrder(
            userId,
            goalUids.map((uid) => idByUid.get(uid))
        );
        return { goal_uids: goalUids };
    }

    // The goal and the caller's access to it; a goal they cannot see reads
    // as missing.
    async findAccessible(userId, uid) {
        const goal = await goalsRepository.findVisibleByUid(userId, uid);
        const access = goal
            ? await permissionsService.getAccess(userId, 'goal', uid)
            : ACCESS.NONE;
        if (access === ACCESS.NONE) throw new NotFoundError('Goal not found');
        return { goal, access };
    }

    async getByUid(userId, uid) {
        const { goal } = await this.findAccessible(userId, uid);
        return goal;
    }

    async create(
        userId,
        data,
        actor = { user_id: userId, actor_type: 'user' }
    ) {
        const { title, area_id, why, horizon, target_date, status, color } =
            data;
        if (!title || !title.trim()) {
            throw new ValidationError('Goal title is required');
        }
        const resolvedAreaId = await this.resolveAreaId(userId, area_id);
        // LTD-PATCH(T-401): all hierarchy validation and writes share one transaction.
        return withJournal(actor, async (transaction, record) => {
            const user = await hierarchy.lockOwner(userId, transaction);
            const parent = await hierarchy.resolveParent(
                userId,
                data,
                transaction
            );
            const values = {
                user_id: userId,
                area_id: resolvedAreaId,
                title: title.trim(),
                why: why || null,
                horizon: horizon || 'season',
                target_date: target_date || null,
                status: status || 'active',
                color: color || null,
                ...defaultPeriod(horizon || 'season', user),
                parent_goal_id: parent ?? null,
            };
            for (const key of ['period_start', 'period_end']) {
                if (data[key] !== undefined) values[key] = data[key] || null;
            }
            if (values.status === 'achieved') {
                if (actor.actor_type !== 'user')
                    throw new ForbiddenError(
                        'Only a user can mark a goal achieved'
                    );
                values.achieved_at = new Date();
            }
            hierarchy.validatePeriod(values);
            await hierarchy.validateHierarchy(
                userId,
                null,
                values,
                transaction
            );
            const goal = await Goal.create(values, { transaction });
            await record({
                op: 'goal_create',
                entity_type: 'goal',
                entity_uid: goal.uid,
                before: null,
                after: goal.toJSON(),
            });
            return goal;
        });
    }

    async update(
        userId,
        uid,
        data,
        actor = { user_id: userId, actor_type: 'user' }
    ) {
        const { goal, access } = await this.findAccessible(userId, uid);
        if (access !== ACCESS.RW && access !== ACCESS.ADMIN) {
            throw new ForbiddenError('Forbidden');
        }

        const { title, area_id, why, horizon, target_date, status, color } =
            data;
        const updates = {};
        if (title !== undefined) updates.title = title.trim();
        if (area_id !== undefined) {
            updates.area_id = await this.resolveAreaId(userId, area_id);
        }
        if (why !== undefined) updates.why = why;
        if (horizon !== undefined) updates.horizon = horizon;
        if (target_date !== undefined)
            updates.target_date = target_date || null;
        if (status !== undefined) updates.status = status;
        if (color !== undefined) updates.color = color || null;

        // LTD-PATCH(T-401): owner-scoped hierarchy edits and explicit achievement, with atomic Undo.
        const hierarchyEdit = [
            'parent_goal_id',
            'parent_goal_uid',
            'horizon',
            'period_start',
            'period_end',
        ].some((key) => data[key] !== undefined);
        if (goal.user_id !== userId) {
            if (hierarchyEdit || status === 'achieved')
                throw new ForbiddenError(
                    'Only the owner can change goal planning'
                );
            return goalsRepository.update(goal, updates);
        }
        return withJournal(actor, async (transaction, record) => {
            await hierarchy.lockOwner(userId, transaction);
            const current = await Goal.findOne({
                where: { uid, user_id: userId },
                transaction,
            });
            const parent = await hierarchy.resolveParent(
                userId,
                data,
                transaction
            );
            if (parent !== undefined) updates.parent_goal_id = parent;
            for (const key of ['period_start', 'period_end']) {
                if (data[key] !== undefined) updates[key] = data[key] || null;
            }
            if (status === 'achieved' && current.status !== 'achieved') {
                if (actor.actor_type !== 'user')
                    throw new ForbiddenError(
                        'Only a user can mark a goal achieved'
                    );
                updates.achieved_at = new Date();
            } else if (status !== undefined && status !== 'achieved')
                updates.achieved_at = null;
            hierarchy.validatePeriod({ ...current.toJSON(), ...updates });
            await hierarchy.validateHierarchy(
                userId,
                current.id,
                updates,
                transaction
            );
            const before = Object.fromEntries(
                Object.keys(updates).map((key) => [key, current.get(key)])
            );
            await current.update(updates, { transaction });
            await record({
                op: parent !== undefined ? 'reparent' : 'goal_update',
                entity_type: 'goal',
                entity_uid: uid,
                before,
                after: Object.fromEntries(
                    Object.keys(updates).map((key) => [key, current.get(key)])
                ),
            });
            return current;
        });
    }

    async delete(userId, uid) {
        const { goal } = await this.findAccessible(userId, uid);
        // Only the owner deletes a goal, not someone it was shared with.
        if (goal.user_id !== userId) {
            throw new ForbiddenError('Only the owner can delete this goal.');
        }
        await goalsRepository.delete(goal);
    }

    async countActive(userId) {
        return goalsRepository.countActiveByUser(userId);
    }
}

module.exports = new GoalsService();
