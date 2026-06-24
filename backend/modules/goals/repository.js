'use strict';

const { Goal, Area } = require('../../models');

class GoalsRepository {
    async findAllByUser(userId) {
        return Goal.findAll({
            where: { user_id: userId },
            include: [
                { model: Area, attributes: ['id', 'uid', 'name', 'color'] },
            ],
            order: [['title', 'ASC']],
        });
    }

    async findAllByArea(userId, areaId) {
        return Goal.findAll({
            where: { user_id: userId, area_id: areaId },
            include: [
                { model: Area, attributes: ['id', 'uid', 'name', 'color'] },
            ],
            order: [['title', 'ASC']],
        });
    }

    async findByUid(userId, uid) {
        return Goal.findOne({
            where: { uid, user_id: userId },
            include: [
                { model: Area, attributes: ['id', 'uid', 'name', 'color'] },
            ],
        });
    }

    async create(data) {
        return Goal.create(data);
    }

    async update(goal, data) {
        return goal.update(data);
    }

    async delete(goal) {
        return goal.destroy();
    }

    async countActiveByUser(userId) {
        return Goal.count({ where: { user_id: userId, status: 'active' } });
    }
}

module.exports = new GoalsRepository();
