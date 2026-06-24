'use strict';

const goalsRepository = require('./repository');
const { NotFoundError, ValidationError } = require('../../shared/errors');

class GoalsService {
    async getAll(userId, areaId) {
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
        const { title, area_id, why, horizon, target_date, status } = data;
        if (!title || !title.trim()) {
            throw new ValidationError('Goal title is required');
        }
        if (!area_id) {
            throw new ValidationError('Goal must belong to an area');
        }
        return goalsRepository.create({
            user_id: userId,
            area_id,
            title: title.trim(),
            why: why || null,
            horizon: horizon || 'season',
            target_date: target_date || null,
            status: status || 'active',
        });
    }

    async update(userId, uid, data) {
        const goal = await goalsRepository.findByUid(userId, uid);
        if (!goal) throw new NotFoundError('Goal not found');

        const { title, area_id, why, horizon, target_date, status } = data;
        const updates = {};
        if (title !== undefined) updates.title = title.trim();
        if (area_id !== undefined) updates.area_id = area_id;
        if (why !== undefined) updates.why = why;
        if (horizon !== undefined) updates.horizon = horizon;
        if (target_date !== undefined)
            updates.target_date = target_date || null;
        if (status !== undefined) updates.status = status;

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
