'use strict';

const BaseRepository = require('../../shared/database/BaseRepository');
const { Project, Task, Tag, Area, Goal, sequelize } = require('../../models');

class TemplatesRepository extends BaseRepository {
    constructor() {
        super(Project);
    }

    async findAllTemplates(userId) {
        return this.model.findAll({
            where: { user_id: userId, is_template: true },
            include: [
                {
                    model: Task,
                    required: false,
                    attributes: ['id', 'status'],
                    where: { parent_task_id: null, recurring_parent_id: null },
                },
                {
                    model: Area,
                    required: false,
                    attributes: ['id', 'uid', 'name', 'color'],
                },
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid', 'color'],
                    through: { attributes: [] },
                },
            ],
            order: [['name', 'ASC']],
        });
    }

    async findTemplateByUid(uid) {
        return this.model.findOne({
            where: { uid, is_template: true },
            include: [
                {
                    model: Task,
                    required: false,
                    where: { parent_task_id: null, recurring_parent_id: null },
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name', 'uid', 'color'],
                            through: { attributes: [] },
                            required: false,
                        },
                        {
                            model: Task,
                            as: 'Subtasks',
                            required: false,
                            include: [
                                {
                                    model: Tag,
                                    attributes: ['id', 'name', 'uid', 'color'],
                                    through: { attributes: [] },
                                    required: false,
                                },
                            ],
                        },
                    ],
                },
                {
                    model: Area,
                    required: false,
                    attributes: ['id', 'uid', 'name'],
                },
                {
                    model: Goal,
                    as: 'Goal',
                    required: false,
                    attributes: ['id', 'uid', 'title'],
                },
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid', 'color'],
                    through: { attributes: [] },
                },
            ],
        });
    }

    async findByUid(uid) {
        return this.model.findOne({
            where: { uid },
            attributes: ['id', 'uid', 'user_id', 'is_template'],
        });
    }

    async findTagsByNames(userId, tagNames) {
        return Tag.findAll({ where: { user_id: userId, name: tagNames } });
    }

    async createTag(name, userId) {
        return Tag.create({ name, user_id: userId });
    }

    async incrementCloneCount(templateId) {
        return this.model.increment('clone_count', {
            where: { id: templateId },
        });
    }
}

module.exports = new TemplatesRepository();
