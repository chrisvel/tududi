'use strict';

const goalsRepository = require('./repository');
const { Area } = require('../../models');
const permissionsService = require('../../services/permissionsService');
const { NotFoundError, ValidationError } = require('../../shared/errors');

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
        if (areaUid) {
            const area = await Area.findOne({ where: { uid: areaUid } });
            if (area) {
                return goalsRepository.findAllByArea(userId, area.id);
            }
            return [];
        }
        if (areaId) {
            return goalsRepository.findAllByArea(userId, areaId);
        }
        return goalsRepository.findAllByUser(userId);
    }

    async getByUid(userId, uid) {
        const goal = await goalsRepository.findByUid(userId, uid);
        if (!goal) throw new NotFoundError('Goal not found');
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
        const goal = await goalsRepository.findByUid(userId, uid);
        if (!goal) throw new NotFoundError('Goal not found');

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
        const goal = await goalsRepository.findByUid(userId, uid);
        if (!goal) throw new NotFoundError('Goal not found');
        await goalsRepository.delete(goal);
    }

    async countActive(userId) {
        return goalsRepository.countActiveByUser(userId);
    }
}

module.exports = new GoalsService();
