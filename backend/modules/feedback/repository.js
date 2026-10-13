'use strict';

const { Op } = require('sequelize');
const { Feedback, User } = require('../../models');

class FeedbackRepository {
    async create(attrs) {
        return Feedback.create(attrs);
    }

    async list({ limit, offset, resolved }) {
        const where = {};
        if (resolved === true) where.resolved_at = { [Op.ne]: null };
        if (resolved === false) where.resolved_at = null;
        return Feedback.findAndCountAll({
            where,
            include: [
                {
                    model: User,
                    as: 'User',
                    attributes: ['id', 'uid', 'email', 'name', 'surname'],
                },
            ],
            order: [
                ['created_at', 'DESC'],
                ['id', 'DESC'],
            ],
            limit,
            offset,
        });
    }

    async countOpen() {
        return Feedback.count({ where: { resolved_at: null } });
    }

    async findById(id) {
        return Feedback.findByPk(id);
    }

    async destroyById(id) {
        return Feedback.destroy({ where: { id } });
    }
}

module.exports = new FeedbackRepository();
