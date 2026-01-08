'use strict';

const BaseRepository = require('../../shared/database/BaseRepository');
const { Task, RecurringCompletion } = require('../../models');
const { Op } = require('sequelize');

class HabitsRepository extends BaseRepository {
    constructor() {
        super(Task);
    }

    async findAllByUser(userId) {
        return this.model.findAll({
            where: {
                user_id: userId,
                habit_mode: true,
                status: { [Op.ne]: 3 },
            },
            order: [['created_at', 'DESC']],
        });
    }

    async findByUidAndUser(uid, userId) {
        return this.model.findOne({
            where: { uid, user_id: userId },
        });
    }

    async createHabit(userId, data) {
        return this.model.create({
            ...data,
            user_id: userId,
            habit_mode: true,
            status: 0,
        });
    }

    async findCompletions(taskId, startDate, endDate) {
        return RecurringCompletion.findAll({
            where: {
                task_id: taskId,
                skipped: false,
                completed_at: { [Op.between]: [startDate, endDate] },
            },
            order: [['completed_at', 'DESC']],
        });
    }

    async findCompletionById(completionId, taskId) {
        return RecurringCompletion.findOne({
            where: { id: completionId, task_id: taskId },
        });
    }
}

module.exports = new HabitsRepository();
