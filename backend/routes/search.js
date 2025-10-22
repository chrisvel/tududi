const express = require('express');
const { Task, Tag, Project, Area, Note, sequelize } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
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
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.currentUser?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { q: query, filters, priority, due, tags: tagsParam } = req.query;
        const searchQuery = query ? query.trim() : '';
        const filterTypes = filters
            ? filters.split(',').map((f) => f.trim())
            : ['Task', 'Project', 'Area', 'Note', 'Tag'];
        const tagNames = tagsParam
            ? tagsParam.split(',').map((t) => t.trim())
            : [];

        const results = [];

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
            const now = moment().startOf('day');
            let startDate, endDate;

            switch (due) {
                case 'today':
                    startDate = now.clone();
                    endDate = now.clone().endOf('day');
                    break;
                case 'tomorrow':
                    startDate = now.clone().add(1, 'day');
                    endDate = now.clone().add(1, 'day').endOf('day');
                    break;
                case 'next_week':
                    startDate = now.clone();
                    endDate = now.clone().add(7, 'days').endOf('day');
                    break;
                case 'next_month':
                    startDate = now.clone();
                    endDate = now.clone().add(1, 'month').endOf('day');
                    break;
            }

            if (startDate && endDate) {
                dueDateCondition = {
                    due_date: {
                        [Op.between]: [
                            startDate.toISOString(),
                            endDate.toISOString(),
                        ],
                    },
                };
            }
        }

        // Search Tasks
        if (filterTypes.includes('Task')) {
            const taskConditions = {
                user_id: userId,
            };

            // Add search query filter if specified
            if (searchQuery) {
                taskConditions[Op.or] = [
                    { name: { [Op.like]: `%${searchQuery}%` } },
                    { note: { [Op.like]: `%${searchQuery}%` } },
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
                Object.assign(taskConditions, dueDateCondition);
            }

            const taskInclude = [
                {
                    model: Project,
                    attributes: ['id', 'uid', 'name'],
                },
            ];

            // Add tag filter if specified
            if (tagIds.length > 0) {
                taskInclude.push({
                    model: Tag,
                    where: {
                        id: { [Op.in]: tagIds },
                    },
                    through: { attributes: [] },
                    attributes: [],
                    required: true,
                });
            }

            const tasks = await Task.findAll({
                where: taskConditions,
                include: taskInclude,
                limit: 20,
                order: [['updated_at', 'DESC']],
            });

            results.push(
                ...tasks.map((task) => ({
                    type: 'Task',
                    id: task.id,
                    uid: task.uid,
                    name: task.name,
                    description: task.note,
                    priority: task.priority,
                    status: task.status,
                }))
            );
        }

        // Search Projects
        if (filterTypes.includes('Project')) {
            const projectConditions = {
                user_id: userId,
            };

            if (searchQuery) {
                projectConditions[Op.or] = [
                    { name: { [Op.like]: `%${searchQuery}%` } },
                    { description: { [Op.like]: `%${searchQuery}%` } },
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

            const projectInclude = [];

            // Add tag filter if specified
            if (tagIds.length > 0) {
                projectInclude.push({
                    model: Tag,
                    where: {
                        id: { [Op.in]: tagIds },
                    },
                    through: { attributes: [] },
                    attributes: [],
                    required: true,
                });
            }

            const projects = await Project.findAll({
                where: projectConditions,
                include: projectInclude.length > 0 ? projectInclude : undefined,
                limit: 20,
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
                    status: project.state,
                }))
            );
        }

        // Search Areas
        if (filterTypes.includes('Area')) {
            const areaConditions = {
                user_id: userId,
            };

            if (searchQuery) {
                areaConditions[Op.or] = [
                    { name: { [Op.like]: `%${searchQuery}%` } },
                    { description: { [Op.like]: `%${searchQuery}%` } },
                ];
            }

            const areas = await Area.findAll({
                where: areaConditions,
                limit: 20,
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
                noteConditions[Op.or] = [
                    { title: { [Op.like]: `%${searchQuery}%` } },
                    { content: { [Op.like]: `%${searchQuery}%` } },
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

            const notes = await Note.findAll({
                where: noteConditions,
                include: noteInclude.length > 0 ? noteInclude : undefined,
                limit: 20,
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
                tagConditions.name = { [Op.like]: `%${searchQuery}%` };
            }

            const tags = await Tag.findAll({
                where: tagConditions,
                limit: 20,
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

        res.json({ results });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

module.exports = router;
