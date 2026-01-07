'use strict';

const { Op } = require('sequelize');
const moment = require('moment-timezone');
const { Task, Tag, Project, sequelize } = require('../../models');
const searchRepository = require('./repository');
const { parseSearchParams, priorityToInt } = require('./validation');
const { serializeTasks } = require('../tasks/core/serializers');
const { UnauthorizedError } = require('../../shared/errors');

class SearchService {
    /**
     * Build date range condition for due/defer filters.
     */
    buildDateCondition(filterValue, startOfToday, fieldName) {
        if (!filterValue) return null;

        let startDate, endDate;

        switch (filterValue) {
            case 'today':
                startDate = startOfToday.clone();
                endDate = startOfToday.clone().endOf('day');
                break;
            case 'tomorrow':
                startDate = startOfToday.clone().add(1, 'day');
                endDate = startOfToday.clone().add(1, 'day').endOf('day');
                break;
            case 'next_week':
                startDate = startOfToday.clone();
                endDate = startOfToday.clone().add(7, 'days').endOf('day');
                break;
            case 'next_month':
                startDate = startOfToday.clone();
                endDate = startOfToday.clone().add(1, 'month').endOf('day');
                break;
            default:
                return null;
        }

        return {
            [fieldName]: {
                [Op.between]: [startDate.toDate(), endDate.toDate()],
            },
        };
    }

    /**
     * Build task search conditions.
     */
    buildTaskConditions(
        userId,
        params,
        dueDateCondition,
        deferDateCondition,
        nowDate
    ) {
        const { searchQuery, priority, recurring, extras, excludeSubtasks } =
            params;

        const conditions = { user_id: userId };
        const extraConditions = [];

        if (excludeSubtasks) {
            conditions.parent_task_id = null;
            conditions.recurring_parent_id = null;
        }

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            conditions[Op.or] = [
                sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('Task.name')),
                    {
                        [Op.like]: `%${lowerQuery}%`,
                    }
                ),
                sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('Task.note')),
                    {
                        [Op.like]: `%${lowerQuery}%`,
                    }
                ),
            ];
        }

        if (priority) {
            const priorityInt = priorityToInt(priority);
            if (priorityInt !== null) {
                conditions.priority = priorityInt;
            }
        }

        if (dueDateCondition) {
            extraConditions.push(dueDateCondition);
        }

        if (deferDateCondition) {
            extraConditions.push(deferDateCondition);
        }

        if (recurring) {
            switch (recurring) {
                case 'recurring':
                    conditions.recurrence_type = { [Op.ne]: 'none' };
                    conditions.recurring_parent_id = null;
                    break;
                case 'non_recurring':
                    conditions[Op.or] = [
                        { recurrence_type: 'none' },
                        { recurrence_type: null },
                    ];
                    conditions.recurring_parent_id = null;
                    break;
                case 'instances':
                    conditions.recurring_parent_id = { [Op.ne]: null };
                    break;
            }
        }

        if (extras.has('recurring')) {
            extraConditions.push({
                [Op.or]: [
                    { recurrence_type: { [Op.ne]: 'none' } },
                    { recurring_parent_id: { [Op.ne]: null } },
                ],
            });
        }

        if (extras.has('overdue')) {
            extraConditions.push({ due_date: { [Op.lt]: nowDate } });
            extraConditions.push({ completed_at: null });
        }

        if (extras.has('has_content')) {
            extraConditions.push(
                sequelize.where(
                    sequelize.fn(
                        'LENGTH',
                        sequelize.fn('TRIM', sequelize.col('Task.note'))
                    ),
                    { [Op.gt]: 0 }
                )
            );
        }

        if (extras.has('deferred')) {
            extraConditions.push({ defer_until: { [Op.gt]: nowDate } });
        }

        if (extras.has('assigned_to_project')) {
            extraConditions.push({ project_id: { [Op.ne]: null } });
        }

        if (extraConditions.length > 0) {
            conditions[Op.and] = extraConditions;
        }

        return conditions;
    }

    /**
     * Build task include config.
     */
    buildTaskInclude(tagIds, extras) {
        const include = [
            { model: Project, attributes: ['id', 'uid', 'name'] },
            {
                model: Task,
                as: 'Subtasks',
                include: [
                    {
                        model: Tag,
                        attributes: ['id', 'name', 'uid'],
                        through: { attributes: [] },
                    },
                ],
            },
        ];

        const requireTags = tagIds.length > 0 || extras.has('has_tags');
        const tagInclude = {
            model: Tag,
            through: { attributes: [] },
            attributes: ['id', 'name', 'uid'],
            required: requireTags,
        };

        if (tagIds.length > 0) {
            tagInclude.where = { id: { [Op.in]: tagIds } };
        }

        include.push(tagInclude);
        return { include, tagInclude: requireTags ? tagInclude : undefined };
    }

    /**
     * Search tasks.
     */
    async searchTasks(
        userId,
        params,
        tagIds,
        dueDateCondition,
        deferDateCondition,
        nowDate,
        timezone
    ) {
        const conditions = this.buildTaskConditions(
            userId,
            params,
            dueDateCondition,
            deferDateCondition,
            nowDate
        );
        const { include, tagInclude } = this.buildTaskInclude(
            tagIds,
            params.extras
        );

        let count = 0;
        if (params.hasPagination) {
            count = await searchRepository.countTasks(
                conditions,
                tagInclude ? [tagInclude] : undefined
            );
        }

        const tasks = await searchRepository.findTasks(
            conditions,
            include,
            params.limit,
            params.offset
        );

        const serializedTasks = await serializeTasks(tasks, timezone);

        return {
            count,
            results: serializedTasks.map((task) => ({
                type: 'Task',
                ...task,
                description: task.note,
            })),
        };
    }

    /**
     * Search projects.
     */
    async searchProjects(userId, params, tagIds, dueDateCondition) {
        const { searchQuery, priority, extras, hasPagination, limit, offset } =
            params;

        const conditions = { user_id: userId };

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            conditions[Op.or] = [
                sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('Project.name')),
                    {
                        [Op.like]: `%${lowerQuery}%`,
                    }
                ),
                sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('Project.description')),
                    {
                        [Op.like]: `%${lowerQuery}%`,
                    }
                ),
            ];
        }

        if (priority) {
            conditions.priority = priority;
        }

        if (dueDateCondition) {
            conditions.due_date_at = dueDateCondition.due_date;
        }

        const requireTags = tagIds.length > 0 || extras.has('has_tags');
        const include = [];

        if (requireTags) {
            const tagInclude = {
                model: Tag,
                through: { attributes: [] },
                attributes: [],
                required: true,
            };
            if (tagIds.length > 0) {
                tagInclude.where = { id: { [Op.in]: tagIds } };
            }
            include.push(tagInclude);
        }

        let count = 0;
        if (hasPagination) {
            count = await searchRepository.countProjects(conditions, include);
        }

        const projects = await searchRepository.findProjects(
            conditions,
            include,
            limit,
            offset
        );

        return {
            count,
            results: projects.map((project) => ({
                type: 'Project',
                id: project.id,
                uid: project.uid,
                name: project.name,
                description: project.description,
                priority: project.priority,
                status: project.status,
            })),
        };
    }

    /**
     * Search areas.
     */
    async searchAreas(userId, params) {
        const { searchQuery, hasPagination, limit, offset } = params;

        const conditions = { user_id: userId };

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            conditions[Op.or] = [
                sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('Area.name')),
                    {
                        [Op.like]: `%${lowerQuery}%`,
                    }
                ),
                sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('Area.description')),
                    {
                        [Op.like]: `%${lowerQuery}%`,
                    }
                ),
            ];
        }

        let count = 0;
        if (hasPagination) {
            count = await searchRepository.countAreas(conditions);
        }

        const areas = await searchRepository.findAreas(
            conditions,
            limit,
            offset
        );

        return {
            count,
            results: areas.map((area) => ({
                type: 'Area',
                id: area.id,
                uid: area.uid,
                name: area.name,
                description: area.description,
            })),
        };
    }

    /**
     * Search notes.
     */
    async searchNotes(userId, params, tagIds) {
        const { searchQuery, hasPagination, limit, offset } = params;

        const conditions = { user_id: userId };

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            conditions[Op.or] = [
                sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('Note.title')),
                    {
                        [Op.like]: `%${lowerQuery}%`,
                    }
                ),
                sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('Note.content')),
                    {
                        [Op.like]: `%${lowerQuery}%`,
                    }
                ),
            ];
        }

        const include = [];
        if (tagIds.length > 0) {
            include.push({
                model: Tag,
                where: { id: { [Op.in]: tagIds } },
                through: { attributes: [] },
                attributes: [],
                required: true,
            });
        }

        let count = 0;
        if (hasPagination) {
            count = await searchRepository.countNotes(conditions, include);
        }

        const notes = await searchRepository.findNotes(
            conditions,
            include,
            limit,
            offset
        );

        return {
            count,
            results: notes.map((note) => ({
                type: 'Note',
                id: note.id,
                uid: note.uid,
                name: note.title,
                title: note.title,
                description: note.content ? note.content.substring(0, 100) : '',
            })),
        };
    }

    /**
     * Search tags.
     */
    async searchTags(userId, params) {
        const { searchQuery, hasPagination, limit, offset } = params;

        const conditions = { user_id: userId };

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            conditions[Op.and] = [
                sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('Tag.name')),
                    {
                        [Op.like]: `%${lowerQuery}%`,
                    }
                ),
            ];
        }

        let count = 0;
        if (hasPagination) {
            count = await searchRepository.countTags(conditions);
        }

        const tags = await searchRepository.findTags(conditions, limit, offset);

        return {
            count,
            results: tags.map((tag) => ({
                type: 'Tag',
                id: tag.id,
                uid: tag.uid,
                name: tag.name,
            })),
        };
    }

    /**
     * Universal search across all entity types.
     */
    async search(userId, query, timezone = 'UTC') {
        if (!userId) {
            throw new UnauthorizedError('Unauthorized');
        }

        const params = parseSearchParams(query);
        const {
            filterTypes,
            tagNames,
            due,
            defer,
            hasPagination,
            limit,
            offset,
        } = params;

        // Find tag IDs if filtering by tags
        const tagIds = await searchRepository.findTagIdsByNames(
            userId,
            tagNames
        );
        if (tagNames.length > 0 && tagIds.length === 0) {
            return { results: [] };
        }

        // Calculate date conditions
        const nowMoment = moment().tz(timezone);
        const startOfToday = nowMoment.clone().startOf('day');
        const nowDate = nowMoment.toDate();

        const dueDateCondition = this.buildDateCondition(
            due,
            startOfToday,
            'due_date'
        );
        const deferDateCondition = this.buildDateCondition(
            defer,
            startOfToday,
            'defer_until'
        );

        const results = [];
        let totalCount = 0;

        // Search each entity type
        if (filterTypes.includes('Task')) {
            const taskResults = await this.searchTasks(
                userId,
                params,
                tagIds,
                dueDateCondition,
                deferDateCondition,
                nowDate,
                timezone
            );
            results.push(...taskResults.results);
            totalCount += taskResults.count;
        }

        if (filterTypes.includes('Project')) {
            const projectResults = await this.searchProjects(
                userId,
                params,
                tagIds,
                dueDateCondition
            );
            results.push(...projectResults.results);
            totalCount += projectResults.count;
        }

        if (filterTypes.includes('Area')) {
            const areaResults = await this.searchAreas(userId, params);
            results.push(...areaResults.results);
            totalCount += areaResults.count;
        }

        if (filterTypes.includes('Note')) {
            const noteResults = await this.searchNotes(userId, params, tagIds);
            results.push(...noteResults.results);
            totalCount += noteResults.count;
        }

        if (filterTypes.includes('Tag')) {
            const tagResults = await this.searchTags(userId, params);
            results.push(...tagResults.results);
            totalCount += tagResults.count;
        }

        if (hasPagination) {
            return {
                results,
                pagination: {
                    total: totalCount,
                    limit,
                    offset,
                    hasMore: offset + results.length < totalCount,
                },
            };
        }

        return { results };
    }
}

module.exports = new SearchService();
