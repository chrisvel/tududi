const express = require('express');
const { Task, Tag, Project, Area, Note, sequelize } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const { serializeTasks } = require('./tasks/core/serializers');
const router = express.Router();

// Helper function to convert priority string to integer
const priorityToInt = (priorityStr) => {
    const priorityMap = {
        low: 0,
        medium: 1,
        high: 2,
    };
    return priorityMap[priorityStr] !== undefined
        ? priorityMap[priorityStr]
        : null;
};

/**
 * Universal search endpoint
 * GET /api/search
 * Query params:
 *   - q: search query string
 *   - filters: comma-separated list of entity types (Task,Project,Area,Note,Tag)
 *   - priority: filter by priority (low,medium,high)
 *   - due: filter by due date (today,tomorrow,next_week,next_month)
 *   - tags: comma-separated list of tag names to filter by
 *   - recurring: filter by recurrence type (recurring,non_recurring,instances)
 *   - extras: comma-separated list of extra filters (recurring,overdue,has_content,deferred,has_tags,assigned_to_project)
 *   - limit: number of results to return (default: 20)
 *   - offset: number of results to skip (default: 0)
 *   - excludeSubtasks: if 'true', exclude tasks that have a parent_task_id or recurring_parent_id
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.currentUser?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const {
            q: query,
            filters,
            priority,
            due,
            defer,
            tags: tagsParam,
            recurring,
            extras: extrasParam,
            limit: limitParam,
            offset: offsetParam,
            excludeSubtasks,
        } = req.query;
        const searchQuery = query ? query.trim() : '';
        const filterTypes = filters
            ? filters.split(',').map((f) => f.trim())
            : ['Task', 'Project', 'Area', 'Note', 'Tag'];
        const tagNames = tagsParam
            ? tagsParam.split(',').map((t) => t.trim())
            : [];
        const extras =
            extrasParam && typeof extrasParam === 'string'
                ? extrasParam
                      .split(',')
                      .map((extra) => extra.trim())
                      .filter(Boolean)
                : [];
        const extrasSet = new Set(extras);
        const userTimezone = req.currentUser?.timezone || 'UTC';
        const nowMoment = moment().tz(userTimezone);
        const startOfToday = nowMoment.clone().startOf('day');
        const nowDate = nowMoment.toDate();

        // Pagination support
        const hasPagination =
            limitParam !== undefined || offsetParam !== undefined;
        const limit = hasPagination ? parseInt(limitParam, 10) || 20 : 20;
        const offset = hasPagination ? parseInt(offsetParam, 10) || 0 : 0;

        const results = [];
        let totalCount = 0;

        // If tags are specified, find their IDs first
        let tagIds = [];
        if (tagNames.length > 0) {
            const tags = await Tag.findAll({
                where: {
                    user_id: userId,
                    name: { [Op.in]: tagNames },
                },
                attributes: ['id'],
            });
            tagIds = tags.map((tag) => tag.id);

            // If no matching tags found, return empty results
            if (tagIds.length === 0) {
                return res.json({ results: [] });
            }
        }

        // Calculate due date range based on filter
        let dueDateCondition = null;
        if (due) {
            let startDate, endDate;

            switch (due) {
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
            }

            if (startDate && endDate) {
                dueDateCondition = {
                    due_date: {
                        [Op.between]: [startDate.toDate(), endDate.toDate()],
                    },
                };
            }
        }

        // Calculate defer until date range based on filter
        let deferDateCondition = null;
        if (defer) {
            let startDate, endDate;

            switch (defer) {
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
            }

            if (startDate && endDate) {
                deferDateCondition = {
                    defer_until: {
                        [Op.between]: [startDate.toDate(), endDate.toDate()],
                    },
                };
            }
        }

        // Search Tasks
        if (filterTypes.includes('Task')) {
            const taskConditions = {
                user_id: userId,
            };
            const taskExtraConditions = [];

            // Exclude subtasks and recurring instances if requested
            if (excludeSubtasks === 'true') {
                taskConditions.parent_task_id = null;
                taskConditions.recurring_parent_id = null;
            }

            // Add search query filter if specified
            if (searchQuery) {
                const lowerQuery = searchQuery.toLowerCase();
                taskConditions[Op.or] = [
                    sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('Task.name')),
                        { [Op.like]: `%${lowerQuery}%` }
                    ),
                    sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('Task.note')),
                        { [Op.like]: `%${lowerQuery}%` }
                    ),
                ];
            }

            // Add priority filter if specified (convert string to integer)
            if (priority) {
                const priorityInt = priorityToInt(priority);
                if (priorityInt !== null) {
                    taskConditions.priority = priorityInt;
                }
            }

            // Add due date filter if specified
            if (dueDateCondition) {
                taskExtraConditions.push(dueDateCondition);
            }

            // Add defer until filter if specified
            if (deferDateCondition) {
                taskExtraConditions.push(deferDateCondition);
            }

            // Add recurring filter if specified
            if (recurring) {
                switch (recurring) {
                    case 'recurring':
                        // Show only recurring templates (not instances)
                        taskConditions.recurrence_type = { [Op.ne]: 'none' };
                        taskConditions.recurring_parent_id = null;
                        break;
                    case 'non_recurring':
                        // Show only non-recurring tasks (not templates or instances)
                        taskConditions[Op.or] = [
                            { recurrence_type: 'none' },
                            { recurrence_type: null },
                        ];
                        taskConditions.recurring_parent_id = null;
                        break;
                    case 'instances':
                        // Show only recurring instances (spawned from templates)
                        taskConditions.recurring_parent_id = { [Op.ne]: null };
                        break;
                }
            }

            if (extrasSet.has('recurring')) {
                taskExtraConditions.push({
                    [Op.or]: [
                        { recurrence_type: { [Op.ne]: 'none' } },
                        { recurring_parent_id: { [Op.ne]: null } },
                    ],
                });
            }

            if (extrasSet.has('overdue')) {
                taskExtraConditions.push({
                    due_date: { [Op.lt]: nowDate },
                });
                taskExtraConditions.push({
                    completed_at: null,
                });
            }

            if (extrasSet.has('has_content')) {
                const noteHasContent = sequelize.where(
                    sequelize.fn(
                        'LENGTH',
                        sequelize.fn('TRIM', sequelize.col('Task.note'))
                    ),
                    { [Op.gt]: 0 }
                );
                taskExtraConditions.push(noteHasContent);
            }

            if (extrasSet.has('deferred')) {
                taskExtraConditions.push({
                    defer_until: { [Op.gt]: nowDate },
                });
            }

            if (extrasSet.has('assigned_to_project')) {
                taskExtraConditions.push({
                    project_id: { [Op.ne]: null },
                });
            }

            if (taskExtraConditions.length > 0) {
                if (taskConditions[Op.and]) {
                    taskConditions[Op.and].push(...taskExtraConditions);
                } else {
                    taskConditions[Op.and] = taskExtraConditions;
                }
            }

            const taskInclude = [
                {
                    model: Project,
                    attributes: ['id', 'uid', 'name'],
                },
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

            const requireTags = tagIds.length > 0 || extrasSet.has('has_tags');
            const tagInclude = {
                model: Tag,
                through: { attributes: [] },
                attributes: ['id', 'name', 'uid'],
                required: requireTags,
            };

            if (tagIds.length > 0) {
                tagInclude.where = {
                    id: { [Op.in]: tagIds },
                };
            }

            taskInclude.push(tagInclude);

            // Count total tasks if pagination is requested
            if (hasPagination) {
                const countInclude = requireTags ? [tagInclude] : undefined;
                totalCount += await Task.count({
                    where: taskConditions,
                    include: countInclude,
                    distinct: true,
                });
            }

            const tasks = await Task.findAll({
                where: taskConditions,
                include: taskInclude,
                limit: limit,
                offset: offset,
                order: [['updated_at', 'DESC']],
            });

            // Use proper serialization to include all task data
            const serializedTasks = await serializeTasks(
                tasks,
                req.currentUser?.timezone || 'UTC'
            );

            results.push(
                ...serializedTasks.map((task) => ({
                    type: 'Task',
                    ...task,
                    description: task.note,
                }))
            );
        }

        // Search Projects
        if (filterTypes.includes('Project')) {
            const projectConditions = {
                user_id: userId,
            };

            if (searchQuery) {
                const lowerQuery = searchQuery.toLowerCase();
                projectConditions[Op.or] = [
                    sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('Project.name')),
                        { [Op.like]: `%${lowerQuery}%` }
                    ),
                    sequelize.where(
                        sequelize.fn(
                            'LOWER',
                            sequelize.col('Project.description')
                        ),
                        { [Op.like]: `%${lowerQuery}%` }
                    ),
                ];
            }

            if (priority) {
                projectConditions.priority = priority;
            }

            // Add due date filter if specified (projects use due_date_at field)
            if (dueDateCondition) {
                const projectDueCondition = {
                    due_date_at: dueDateCondition.due_date,
                };
                Object.assign(projectConditions, projectDueCondition);
            }

            const requireProjectTags =
                tagIds.length > 0 || extrasSet.has('has_tags');
            const projectInclude = [];

            if (requireProjectTags) {
                const projectTagInclude = {
                    model: Tag,
                    through: { attributes: [] },
                    attributes: [],
                    required: true,
                };

                if (tagIds.length > 0) {
                    projectTagInclude.where = {
                        id: { [Op.in]: tagIds },
                    };
                }

                projectInclude.push(projectTagInclude);
            }

            // Count total projects if pagination is requested
            if (hasPagination) {
                totalCount += await Project.count({
                    where: projectConditions,
                    include:
                        projectInclude.length > 0 ? projectInclude : undefined,
                    distinct: true,
                });
            }

            const projects = await Project.findAll({
                where: projectConditions,
                include: projectInclude.length > 0 ? projectInclude : undefined,
                limit: limit,
                offset: offset,
                order: [['updated_at', 'DESC']],
            });

            results.push(
                ...projects.map((project) => ({
                    type: 'Project',
                    id: project.id,
                    uid: project.uid,
                    name: project.name,
                    description: project.description,
                    priority: project.priority,
                    status: project.status,
                }))
            );
        }

        // Search Areas
        if (filterTypes.includes('Area')) {
            const areaConditions = {
                user_id: userId,
            };

            if (searchQuery) {
                const lowerQuery = searchQuery.toLowerCase();
                areaConditions[Op.or] = [
                    sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('Area.name')),
                        { [Op.like]: `%${lowerQuery}%` }
                    ),
                    sequelize.where(
                        sequelize.fn(
                            'LOWER',
                            sequelize.col('Area.description')
                        ),
                        { [Op.like]: `%${lowerQuery}%` }
                    ),
                ];
            }

            // Count total areas if pagination is requested
            if (hasPagination) {
                totalCount += await Area.count({
                    where: areaConditions,
                });
            }

            const areas = await Area.findAll({
                where: areaConditions,
                limit: limit,
                offset: offset,
                order: [['updated_at', 'DESC']],
            });

            results.push(
                ...areas.map((area) => ({
                    type: 'Area',
                    id: area.id,
                    uid: area.uid,
                    name: area.name,
                    description: area.description,
                }))
            );
        }

        // Search Notes
        if (filterTypes.includes('Note')) {
            const noteConditions = {
                user_id: userId,
            };

            if (searchQuery) {
                const lowerQuery = searchQuery.toLowerCase();
                noteConditions[Op.or] = [
                    sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('Note.title')),
                        { [Op.like]: `%${lowerQuery}%` }
                    ),
                    sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('Note.content')),
                        { [Op.like]: `%${lowerQuery}%` }
                    ),
                ];
            }

            const noteInclude = [];

            // Add tag filter if specified
            if (tagIds.length > 0) {
                noteInclude.push({
                    model: Tag,
                    where: {
                        id: { [Op.in]: tagIds },
                    },
                    through: { attributes: [] },
                    attributes: [],
                    required: true,
                });
            }

            // Count total notes if pagination is requested
            if (hasPagination) {
                totalCount += await Note.count({
                    where: noteConditions,
                    include: noteInclude.length > 0 ? noteInclude : undefined,
                    distinct: true,
                });
            }

            const notes = await Note.findAll({
                where: noteConditions,
                include: noteInclude.length > 0 ? noteInclude : undefined,
                limit: limit,
                offset: offset,
                order: [['updated_at', 'DESC']],
            });

            results.push(
                ...notes.map((note) => ({
                    type: 'Note',
                    id: note.id,
                    uid: note.uid,
                    name: note.title,
                    title: note.title,
                    description: note.content
                        ? note.content.substring(0, 100)
                        : '',
                }))
            );
        }

        // Search Tags
        if (filterTypes.includes('Tag')) {
            const tagConditions = {
                user_id: userId,
            };

            if (searchQuery) {
                const lowerQuery = searchQuery.toLowerCase();
                tagConditions[Op.and] = [
                    sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('Tag.name')),
                        { [Op.like]: `%${lowerQuery}%` }
                    ),
                ];
            }

            // Count total tags if pagination is requested
            if (hasPagination) {
                totalCount += await Tag.count({
                    where: tagConditions,
                });
            }

            const tags = await Tag.findAll({
                where: tagConditions,
                limit: limit,
                offset: offset,
                order: [['name', 'ASC']],
            });

            results.push(
                ...tags.map((tag) => ({
                    type: 'Tag',
                    id: tag.id,
                    uid: tag.uid,
                    name: tag.name,
                }))
            );
        }

        // Return results with pagination metadata if requested
        if (hasPagination) {
            res.json({
                results,
                pagination: {
                    total: totalCount,
                    limit: limit,
                    offset: offset,
                    hasMore: offset + results.length < totalCount,
                },
            });
        } else {
            res.json({ results });
        }
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

module.exports = router;
