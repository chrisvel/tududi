const express = require('express');
const multer = require('multer');
const path = require('path');
const { getConfig } = require('../config/config');
const config = getConfig();
const fs = require('fs');
const {
    Project,
    Task,
    Tag,
    Area,
    Note,
    User,
    Permission,
    sequelize,
} = require('../models');
const permissionsService = require('../services/permissionsService');
const { Op } = require('sequelize');
const { extractUidFromSlug } = require('../utils/slug-utils');
const { validateTagName } = require('../services/tagsService');
const { uid } = require('../utils/uid');
const { logError } = require('../services/logService');
const router = express.Router();
const { getAuthenticatedUserId } = require('../utils/request-utils');

router.use((req, res, next) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.authUserId = userId;
    next();
});
const { hasAccess } = require('../middleware/authorize');
const { requireAuth } = require('../middleware/auth');

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
        fileSize: 10 * 1024 * 1024, // 10MB limit
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
router.post(
    '/upload/project-image',
    requireAuth,
    upload.single('image'),
    (req, res) => {
        try {
            if (!req.file) {
                return res
                    .status(400)
                    .json({ error: 'No image file provided' });
            }

            // Return the relative URL that can be accessed from the frontend
            const imageUrl = `/api/uploads/projects/${req.file.filename}`;
            res.json({ imageUrl });
        } catch (error) {
            logError('Error uploading image:', error);
            res.status(500).json({ error: 'Failed to upload image' });
        }
    }
);

router.get('/projects', async (req, res) => {
    try {
        const { state, active, pin_to_sidebar, area_id, area } = req.query;

        // Base: owned or shared projects
        const ownedOrShared =
            await permissionsService.ownershipOrPermissionWhere(
                'project',
                req.authUserId
            );
        let whereClause = ownedOrShared;

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
                    where: { uid: uid },
                    attributes: ['id'],
                });
                if (areaRecord) {
                    // add to AND filter
                    whereClause = {
                        [Op.and]: [whereClause, { area_id: areaRecord.id }],
                    };
                }
            }
        } else if (area_id && area_id !== '') {
            // Legacy support for numeric area_id
            whereClause = { [Op.and]: [whereClause, { area_id }] };
        }

        const projects = await Project.findAll({
            where: whereClause,
            include: [
                {
                    model: Task,
                    required: false,
                    attributes: ['id', 'status'],
                    where: {
                        parent_task_id: null,
                        recurring_parent_id: null,
                    },
                },
                {
                    model: Area,
                    required: false,
                    attributes: ['id', 'uid', 'name'],
                },
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                },
                {
                    model: User,
                    required: false,
                    attributes: ['uid'],
                },
            ],
            order: [['name', 'ASC']],
        });

        const { grouped } = req.query;

        // Calculate task status counts and share counts for each project
        const projectIds = projects.map((p) => p.id);
        const projectUids = projects.map((p) => p.uid).filter(Boolean);

        // Get share counts for all projects in one query using permissions table
        const shareCountMap = {};
        if (projectUids.length > 0) {
            const shareCounts = await Permission.findAll({
                attributes: [
                    'resource_uid',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                ],
                where: {
                    resource_type: 'project',
                    resource_uid: { [Op.in]: projectUids },
                },
                group: ['resource_uid'],
                raw: true,
            });

            // Create a map of project_uid to share_count
            const uidToCountMap = {};
            shareCounts.forEach((item) => {
                uidToCountMap[item.resource_uid] = parseInt(item.count, 10);
            });

            // Map uids back to project ids
            projects.forEach((project) => {
                if (project.uid && uidToCountMap[project.uid]) {
                    shareCountMap[project.id] = uidToCountMap[project.uid];
                }
            });
        }

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
            const shareCount = shareCountMap[project.id] || 0;

            return {
                ...projectJson,
                tags: projectJson.Tags || [], // Normalize Tags to tags
                due_date_at: formatDate(project.due_date_at),
                task_status: taskStatus,
                completion_percentage:
                    taskStatus.total > 0
                        ? Math.round((taskStatus.done / taskStatus.total) * 100)
                        : 0,
                user_uid: projectJson.User?.uid,
                share_count: shareCount,
                is_shared: shareCount > 0,
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
        logError('Error fetching projects:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/project/:uidSlug (UID-slug format only)
router.get(
    '/project/:uidSlug',
    hasAccess(
        'ro',
        'project',
        async (req) => {
            const uid = extractUidFromSlug(req.params.uidSlug);
            // Check if project exists - return null if it doesn't (triggers 404)
            const project = await Project.findOne({
                where: { uid },
                attributes: ['uid'],
            });
            return project ? project.uid : null;
        },
        { notFoundMessage: 'Project not found' }
    ),
    async (req, res) => {
        try {
            const uidPart = extractUidFromSlug(req.params.uidSlug);
            const project = await Project.findOne({
                where: { uid: uidPart },
                include: [
                    {
                        model: Task,
                        required: false,
                        where: {
                            parent_task_id: null,
                            recurring_parent_id: null,
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
                    {
                        model: Area,
                        required: false,
                        attributes: ['id', 'uid', 'name'],
                    },
                    {
                        model: Tag,
                        attributes: ['id', 'name', 'uid'],
                        through: { attributes: [] },
                    },
                ],
            });

            const projectJson = project.toJSON();

            // Normalize task data to match frontend expectations
            const normalizedTasks = projectJson.Tasks
                ? projectJson.Tasks.map((task) => {
                      const normalizedTask = {
                          ...task,
                          tags: task.Tags || [],
                          subtasks: task.Subtasks || [],
                          due_date: task.due_date
                              ? typeof task.due_date === 'string'
                                  ? task.due_date.split('T')[0]
                                  : task.due_date.toISOString().split('T')[0]
                              : null,
                      };
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
                          tags: note.Tags || [],
                      };
                      delete normalizedNote.Tags;
                      return normalizedNote;
                  })
                : [];

            // Get share count for this project
            let shareCount = 0;
            if (project.uid) {
                const shareCountResult = await Permission.count({
                    where: {
                        resource_type: 'project',
                        resource_uid: project.uid,
                    },
                });
                shareCount = shareCountResult || 0;
            }

            const result = {
                ...projectJson,
                tags: projectJson.Tags || [],
                Tasks: normalizedTasks,
                Notes: normalizedNotes,
                due_date_at: formatDate(project.due_date_at),
                user_id: project.user_id,
                share_count: shareCount,
                is_shared: shareCount > 0,
            };

            res.json(result);
        } catch (error) {
            logError('Error fetching project:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

router.post('/project', async (req, res) => {
    try {
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
            user_id: req.authUserId,
        };

        // Create is always allowed for the authenticated user; project is owned by creator
        const project = await Project.create(projectData);

        // Update tags if provided, but don't let tag errors break project creation
        try {
            await updateProjectTags(project, tagsData, req.authUserId);
        } catch (tagError) {
            logError(
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
        logError('Error creating project:', error);
        res.status(400).json({
            error: 'There was a problem creating the project.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

router.patch(
    '/project/:uid',
    hasAccess(
        'rw',
        'project',
        async (req) => {
            const uid = extractUidFromSlug(req.params.uid);
            // Check if project exists - return null if it doesn't (triggers 404)
            const project = await Project.findOne({
                where: { uid },
                attributes: ['uid'],
            });
            return project ? project.uid : null;
        },
        { notFoundMessage: 'Project not found.' }
    ),
    async (req, res) => {
        try {
            const project = await Project.findOne({
                where: { uid: req.params.uid },
            });

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
            await updateProjectTags(project, tagsData, req.authUserId);

            // Reload project with associations
            const projectWithAssociations = await Project.findByPk(project.id, {
                include: [
                    {
                        model: Tag,
                        attributes: ['id', 'name', 'uid'],
                        through: { attributes: [] },
                    },
                    {
                        model: Area,
                        required: false,
                        attributes: ['id', 'uid', 'name'],
                    },
                ],
            });

            const projectJson = projectWithAssociations.toJSON();

            res.json({
                ...projectJson,
                tags: projectJson.Tags || [],
                due_date_at: formatDate(projectWithAssociations.due_date_at),
            });
        } catch (error) {
            logError('Error updating project:', error);
            res.status(400).json({
                error: 'There was a problem updating the project.',
                details: error.errors
                    ? error.errors.map((e) => e.message)
                    : [error.message],
            });
        }
    }
);

router.delete(
    '/project/:uid',
    requireAuth,
    hasAccess(
        'rw',
        'project',
        async (req) => {
            const uid = extractUidFromSlug(req.params.uid);
            // Check if project exists - return null if it doesn't (triggers 404)
            const project = await Project.findOne({
                where: { uid },
                attributes: ['uid'],
            });
            return project ? project.uid : null;
        },
        { notFoundMessage: 'Project not found.' }
    ),
    async (req, res) => {
        try {
            const project = await Project.findOne({
                where: { uid: req.params.uid },
            });

            // Use a transaction to ensure atomicity
            await sequelize.transaction(async (transaction) => {
                // Disable foreign key constraints for this operation
                await sequelize.query('PRAGMA foreign_keys = OFF', {
                    transaction,
                });

                try {
                    // First, orphan all tasks associated with this project by setting project_id to NULL
                    await Task.update(
                        { project_id: null },
                        {
                            where: {
                                project_id: project.id,
                                user_id: req.authUserId,
                            },
                            transaction,
                        }
                    );

                    // Also orphan all notes associated with this project by setting project_id to NULL
                    await Note.update(
                        { project_id: null },
                        {
                            where: {
                                project_id: project.id,
                                user_id: req.authUserId,
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
            logError('Error deleting project:', error);
            res.status(400).json({
                error: 'There was a problem deleting the project.',
            });
        }
    }
);

module.exports = router;
