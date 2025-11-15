const { Task } = require('../models');

class TaskRepository {
    constructor() {
        this.model = Task;
    }

    async findById(id, options = {}) {
        return await this.model.findByPk(id, options);
    }

    async findByIdAndUser(id, userId, options = {}) {
        const whereClause = { id, user_id: userId };
        return await this.model.findOne({
            where: whereClause,
            ...options,
        });
    }

    async findByUid(uid, options = {}) {
        return await this.model.findOne({
            where: { uid },
            ...options,
        });
    }

    async findRecurringChildren(recurringParentId, options = {}) {
        const { where = {}, ...restOptions } = options;
        return await this.model.findAll({
            where: { recurring_parent_id: recurringParentId, ...where },
            ...restOptions,
        });
    }

    async findAll(filters = {}, options = {}) {
        const { where = {}, ...restOptions } = options;
        return await this.model.findAll({
            where: { ...where, ...filters },
            ...restOptions,
        });
    }

    async findByUser(userId, filters = {}, options = {}) {
        const { where = {}, ...restOptions } = options;
        return await this.model.findAll({
            where: { user_id: userId, ...where, ...filters },
            ...restOptions,
        });
    }

    async create(taskData) {
        return await this.model.create(taskData);
    }

    async update(id, userId, updates) {
        const task = await this.findByIdAndUser(id, userId);
        if (!task) {
            return null;
        }
        await task.update(updates);
        return task;
    }

    async delete(id, userId) {
        const task = await this.findByIdAndUser(id, userId);
        if (!task) {
            return null;
        }
        await task.destroy();
        return task;
    }

    async count(filters = {}, options = {}) {
        const { where = {}, ...restOptions } = options;
        return await this.model.count({
            where: { ...where, ...filters },
            ...restOptions,
        });
    }

    async bulkUpdate(updates, conditions) {
        return await this.model.update(updates, conditions);
    }

    async findChildren(parentTaskId, userId, options = {}) {
        const { where = {}, ...restOptions } = options;
        return await this.model.findAll({
            where: { parent_task_id: parentTaskId, user_id: userId, ...where },
            ...restOptions,
        });
    }

    async findByUidOnly(uid, options = {}) {
        return await this.model.findOne({
            where: { uid },
            attributes: options.attributes || ['uid'],
            ...options,
        });
    }

    async clearRecurringParent(recurringParentId) {
        return await this.model.update(
            { recurring_parent_id: null },
            { where: { recurring_parent_id: recurringParentId } }
        );
    }

    async destroyMany(conditions) {
        return await this.model.destroy(conditions);
    }

    async createMany(tasksData) {
        return await Promise.all(
            tasksData.map((taskData) => this.model.create(taskData))
        );
    }

    async updateChildren(parentTaskId, userId, updates) {
        return await this.model.update(updates, {
            where: { parent_task_id: parentTaskId, user_id: userId },
        });
    }

    async updateChildrenWithConditions(
        parentTaskId,
        userId,
        updates,
        extraWhere = {}
    ) {
        return await this.model.update(updates, {
            where: {
                parent_task_id: parentTaskId,
                user_id: userId,
                ...extraWhere,
            },
        });
    }
}

module.exports = new TaskRepository();
