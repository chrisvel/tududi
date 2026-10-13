const { Task, TaskAttachment } = require('../../models');
const { deleteAttachmentFiles } = require('../../utils/attachment-utils');

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

    // A CalDAV client addresses a resource by the name it chose for it, which
    // RFC 4791 5.3.2 says need not be the object's UID, so a URL can name a task
    // either way. The uid is looked up on its own and first: it is the identity
    // and is globally unique, while a resource name is only unique to the client
    // that picked it, so one query over both - especially a limited one - can
    // answer with another user's row of the same name, or drop the uid match it
    // was meant to prefer. Callers that know who is asking pass their
    // visibility scope as options.where, so the name fallback can only answer
    // with a task that caller can actually see.
    async findByUidOrResourceName(name, options = {}) {
        const { where = {}, ...rest } = options;

        const byUid = await this.model.findOne({
            where: { uid: name, ...where },
            ...rest,
        });
        if (byUid) return byUid;

        return await this.model.findOne({
            where: { caldav_resource_name: name, ...where },
            ...rest,
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

    async create(taskData, options = {}) {
        return await this.model.create(taskData, options);
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
        const task = await this.findByIdAndUser(id, userId, {
            include: [{ model: TaskAttachment, as: 'Attachments' }],
        });
        if (!task) {
            return null;
        }
        // Unlink attachment files from disk before destroying rows, so a
        // dangling file never outlives the record that gated its access
        // (GHSA-43p8-ch4p-gqg4).
        await deleteAttachmentFiles(task.Attachments);
        await TaskAttachment.destroy({ where: { task_id: task.id } });
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
