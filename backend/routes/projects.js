const express = require('express');
const multer = require('multer');
const path = require('path');
const { getConfig } = require('../config/config');
const config = getConfig();
const fs = require('fs');
const { Project, Task, Tag, Area, Note, sequelize } = require('../models');
const { Op } = require('sequelize');
const { extractUidFromSlug } = require('../utils/slug-utils');
const { validateTagName } = require('../services/tagsService');
const { uid } = require('../utils/uid');
const router = express.Router();

// Helper function to safely format dates
const formatDate = (date) => {
    if (!date) return null;
    try {
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) return null;
        return dateObj.toISOString();
    } catch (error) {
        return null;
    }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(config.uploadPath, 'projects');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'project-' + uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(
            path.extname(file.originalname).toLowerCase()
        );
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    },
});

// Helper function to update project tags
async function updateProjectTags(project, tagsData, userId) {
    if (!tagsData) return;

    // Validate and filter tag names
    const validTagNames = [];
    const invalidTags = [];

    for (const tag of tagsData) {
        const validation = validateTagName(tag.name);
        if (validation.valid) {
            // Check for duplicates
            if (!validTagNames.includes(validation.name)) {
                validTagNames.push(validation.name);
            }
        } else {
            invalidTags.push({ name: tag.name, error: validation.error });
        }
    }

    // If there are invalid tags, throw an error
    if (invalidTags.length > 0) {
        throw new Error(
            `Invalid tag names: ${invalidTags.map((t) => `"${t.name}" (${t.error})`).join(', ')}`
        );
    }

    if (validTagNames.length === 0) {
        await project.setTags([]);
        return;
    }

    // Find existing tags
    const existingTags = await Tag.findAll({
        where: { user_id: userId, name: validTagNames },
    });

    // Create new tags
    const existingTagNames = existingTags.map((tag) => tag.name);
    const newTagNames = validTagNames.filter(
        (name) => !existingTagNames.includes(name)
    );

    const createdTags = await Promise.all(
        newTagNames.map((name) => Tag.create({ name, user_id: userId }))
    );

    // Set all tags to project
    const allTags = [...existingTags, ...createdTags];
    await project.setTags(allTags);
}

// POST /api/upload/project-image
router.post('/upload/project-image', upload.single('image'), (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Return the relative URL that can be accessed from the frontend
        const imageUrl = `/api/uploads/projects/${req.file.filename}`;
        res.json({ imageUrl });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: Get all projects for the authenticated user
 *     parameters:
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Filter by project state
 *       - in: query
 *         name: area_id
 *         schema:
 *           type: integer
 *         description: Filter by area ID
 *     responses:
 *       200:
 *         description: List of projects
 */
router.get('/projects', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { state, active, pin_to_sidebar, area_id, area } = req.query;

        let whereClause = { user_id: req.session.userId };

        // Filter by state (new primary filter)
        if (state && state !== 'all') {
            if (Array.isArray(state)) {
                whereClause.state = { [Op.in]: state };
            } else {
                whereClause.state = state;
            }
        }

        // Legacy support for active filter - map to states
        if (active === 'true') {
            whereClause.state = {
                [Op.in]: ['planned', 'in_progress', 'blocked'],
            };
        } else if (active === 'false') {
            whereClause.state = { [Op.in]: ['idea', 'completed'] };
        }

        // Filter by pinned status
        if (pin_to_sidebar === 'true') {
            whereClause.pin_to_sidebar = true;
        } else if (pin_to_sidebar === 'false') {
            whereClause.pin_to_sidebar = false;
        }

        // Filter by area - support both numeric area_id and uid-slug area
        if (area && area !== '') {
            // Extract uid from uid-slug format
            const uid = extractUidFromSlug(area);
            if (uid) {
                const areaRecord = await Area.findOne({
                    where: { uid: uid, user_id: req.session.userId },
                    attributes: ['id'],
                });
                if (areaRecord) {
                    whereClause.area_id = areaRecord.id;
                }
            }
        } else if (area_id && area_id !== '') {
            // Legacy support for numeric area_id
            whereClause.area_id = area_id;
        }

        const projects = await Project.findAll({
            where: whereClause,
            include: [
                {
                    model: Task,
                    required: false,
                    attributes: ['id', 'status'],
                },
                {
                    model: Area,
                    required: false,
                    attributes: ['name'],
                },
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                },
            ],
            order: [['name', 'ASC']],
        });

        const { grouped } = req.query;

        // Calculate task status counts for each project
        const taskStatusCounts = {};
        const enhancedProjects = projects.map((project) => {
            const tasks = project.Tasks || [];
            const taskStatus = {
                total: tasks.length,
                done: tasks.filter((t) => t.status === 2).length,
                in_progress: tasks.filter((t) => t.status === 1).length,
                not_started: tasks.filter((t) => t.status === 0).length,
            };

            taskStatusCounts[project.id] = taskStatus;

            const projectJson = project.toJSON();
            return {
                ...projectJson,
                tags: projectJson.Tags || [], // Normalize Tags to tags
                due_date_at: formatDate(project.due_date_at),
                task_status: taskStatus,
                completion_percentage:
                    taskStatus.total > 0
                        ? Math.round((taskStatus.done / taskStatus.total) * 100)
                        : 0,
            };
        });

        // If grouped=true, return grouped format
        if (grouped === 'true') {
            const groupedProjects = {};
            enhancedProjects.forEach((project) => {
                const areaName = project.Area ? project.Area.name : 'No Area';
                if (!groupedProjects[areaName]) {
                    groupedProjects[areaName] = [];
                }
                groupedProjects[areaName].push(project);
            });
            res.json(groupedProjects);
        } else {
            res.json({
                projects: enhancedProjects,
            });
        }
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/project/:uidSlug (UID-slug format only)
router.get('/project/:uidSlug', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Extract UID from the slug (part before first hyphen)
        const uidPart = req.params.uidSlug.split('-')[0];

        const project = await Project.findOne({
            where: {
                uid: uidPart,
                user_id: req.session.userId,
            },
            include: [
                {
                    model: Task,
                    required: false,
                    where: {
                        parent_task_id: null,
                        recurring_parent_id: null, // Exclude recurring task instances, only show templates
                        // Include ALL tasks regardless of status for client-side filtering
                    },
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name', 'uid'],
                            through: { attributes: [] },
                            required: false,
                        },
                        {
                            model: Task,
                            as: 'Subtasks',
                            include: [
                                {
                                    model: Tag,
                                    attributes: ['id', 'name', 'uid'],
                                    through: { attributes: [] },
                                    required: false,
                                },
                            ],
                            required: false,
                        },
                    ],
                },
                {
                    model: Note,
                    required: false,
                    attributes: [
                        'id',
                        'uid',
                        'title',
                        'content',
                        'created_at',
                        'updated_at',
                    ],
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name', 'uid'],
                            through: { attributes: [] },
                        },
                    ],
                },
                { model: Area, required: false, attributes: ['id', 'name'] },
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                },
            ],
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const projectJson = project.toJSON();

        // Normalize task data to match frontend expectations
        const normalizedTasks = projectJson.Tasks
            ? projectJson.Tasks.map((task) => {
                  const normalizedTask = {
                      ...task,
                      tags: task.Tags || [], // Normalize Tags to tags for each task
                      subtasks: task.Subtasks || [], // Normalize Subtasks to subtasks for each task
                      due_date: task.due_date
                          ? typeof task.due_date === 'string'
                              ? task.due_date.split('T')[0]
                              : task.due_date.toISOString().split('T')[0]
                          : null,
                  };
                  // Remove the original Tags and Subtasks properties to avoid confusion
                  delete normalizedTask.Tags;
                  delete normalizedTask.Subtasks;
                  return normalizedTask;
              })
            : [];

        // Normalize note data to match frontend expectations
        const normalizedNotes = projectJson.Notes
            ? projectJson.Notes.map((note) => {
                  const normalizedNote = {
                      ...note,
                      tags: note.Tags || [], // Normalize Tags to tags for each note
                  };
                  // Remove the original Tags property to avoid confusion
                  delete normalizedNote.Tags;
                  return normalizedNote;
              })
            : [];

        const result = {
            ...projectJson,
            tags: projectJson.Tags || [], // Normalize Tags to tags
            Tasks: normalizedTasks, // Keep as Tasks (capital T) to match expected structure
            Notes: normalizedNotes, // Include normalized notes with tags
            due_date_at: formatDate(project.due_date_at),
        };

        res.json(result);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /project:
 *   post:
 *     summary: Create a new project
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               state:
 *                 type: string
 *               area_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Project created
 */
router.post('/project', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const {
            name,
            description,
            area_id,
            priority,
            due_date_at,
            image_url,
            state,
            tags,
            Tags,
        } = req.body;

        // Handle both tags and Tags (Sequelize association format)
        const tagsData = tags || Tags;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        // Generate UID explicitly to avoid Sequelize caching issues
        const projectUid = uid();

        const projectData = {
            uid: projectUid,
            name: name.trim(),
            description: description || '',
            area_id: area_id || null,
            pin_to_sidebar: false,
            priority: priority || null,
            due_date_at: due_date_at || null,
            image_url: image_url || null,
            state: state || 'idea',
            user_id: req.session.userId,
        };

        const project = await Project.create(projectData);

        // Update tags if provided, but don't let tag errors break project creation
        try {
            await updateProjectTags(project, tagsData, req.session.userId);
        } catch (tagError) {
            console.warn(
                'Tag update failed, but project created successfully:',
                tagError.message
            );
        }

        res.status(201).json({
            ...project.toJSON(),
            uid: projectUid, // Use the UID we explicitly generated
            tags: [], // Start with empty tags - they can be added later
            due_date_at: formatDate(project.due_date_at),
        });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(400).json({
            error: 'There was a problem creating the project.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

/**
 * @swagger
 * /project/{id}:
 *   patch:
 *     summary: Update a project
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               state:
 *                 type: string
 *               area_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Project updated
 */
router.patch('/project/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const project = await Project.findOne({
            where: { id: req.params.id, user_id: req.session.userId },
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found.' });
        }

        const {
            name,
            description,
            area_id,
            pin_to_sidebar,
            priority,
            due_date_at,
            image_url,
            state,
            tags,
            Tags,
        } = req.body;

        // Handle both tags and Tags (Sequelize association format)
        const tagsData = tags || Tags;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (area_id !== undefined) updateData.area_id = area_id;
        if (pin_to_sidebar !== undefined)
            updateData.pin_to_sidebar = pin_to_sidebar;
        if (priority !== undefined) updateData.priority = priority;
        if (due_date_at !== undefined) updateData.due_date_at = due_date_at;
        if (image_url !== undefined) updateData.image_url = image_url;
        if (state !== undefined) updateData.state = state;

        await project.update(updateData);
        await updateProjectTags(project, tagsData, req.session.userId);

        // Reload project with associations
        const projectWithAssociations = await Project.findByPk(project.id, {
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                },
            ],
        });

        const projectJson = projectWithAssociations.toJSON();

        res.json({
            ...projectJson,
            tags: projectJson.Tags || [], // Normalize Tags to tags
            due_date_at: formatDate(projectWithAssociations.due_date_at),
        });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(400).json({
            error: 'There was a problem updating the project.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// DELETE /api/project/:id
router.delete('/project/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const project = await Project.findOne({
            where: { id: req.params.id, user_id: req.session.userId },
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found.' });
        }

        // Use a transaction to ensure atomicity
        await sequelize.transaction(async (transaction) => {
            // Disable foreign key constraints for this operation
            await sequelize.query('PRAGMA foreign_keys = OFF', { transaction });

            try {
                // First, orphan all tasks associated with this project by setting project_id to NULL
                await Task.update(
                    { project_id: null },
                    {
                        where: {
                            project_id: req.params.id,
                            user_id: req.session.userId,
                        },
                        transaction,
                    }
                );

                // Then delete the project
                await project.destroy({ transaction });
            } finally {
                // Re-enable foreign key constraints
                await sequelize.query('PRAGMA foreign_keys = ON', {
                    transaction,
                });
            }
        });

        res.json({ message: 'Project successfully deleted' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(400).json({
            error: 'There was a problem deleting the project.',
        });
    }
});

module.exports = router;
