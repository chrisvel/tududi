'use strict';

const goalsRepository = require('./repository');
const { Area } = require('../../models');
const permissionsService = require('../../services/permissionsService');
const {
    NotFoundError,
    ValidationError,
    ForbiddenError,
} = require('../../shared/errors');

const { ACCESS } = permissionsService;

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
        if (areaUid || areaId) {
            const area = await Area.findOne({
                where: areaUid ? { uid: areaUid } : { id: areaId },
                attributes: ['id', 'uid'],
            });
            const access = area
                ? await permissionsService.getAccess(userId, 'area', area.uid)
                : ACCESS.NONE;
            if (access === ACCESS.NONE) return [];
            return goalsRepository.findAllByArea(userId, area.id);
        }
        return goalsRepository.findAllByUser(userId);
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

    async create(userId, data) {
        const { title, area_id, why, horizon, target_date, status, color } =
            data;
        if (!title || !title.trim()) {
            throw new ValidationError('Goal title is required');
        }
        const resolvedAreaId = await this.resolveAreaId(userId, area_id);
        return goalsRepository.create({
            user_id: userId,
            area_id: resolvedAreaId,
            title: title.trim(),
            why: why || null,
            horizon: horizon || 'season',
            target_date: target_date || null,
            status: status || 'active',
            color: color || null,
        });
    }

    async update(userId, uid, data) {
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

        return goalsRepository.update(goal, updates);
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
