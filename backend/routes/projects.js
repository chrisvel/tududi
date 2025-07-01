const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Project, Task, Tag, Area, sequelize } = require('../models');
const { Op } = require('sequelize');
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
        const uploadDir = path.join(__dirname, '../uploads/projects');
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

    const tagNames = tagsData
        .map((tag) => tag.name)
        .filter((name) => name && name.trim())
        .filter((name, index, arr) => arr.indexOf(name) === index); // unique

    if (tagNames.length === 0) {
        await project.setTags([]);
        return;
    }

    // Find existing tags
    const existingTags = await Tag.findAll({
        where: { user_id: userId, name: tagNames },
    });

    // Create new tags
    const existingTagNames = existingTags.map((tag) => tag.name);
    const newTagNames = tagNames.filter(
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

// GET /api/projects
router.get('/projects', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { active, pin_to_sidebar, area_id } = req.query;

        let whereClause = { user_id: req.session.userId };

        // Filter by active status
        if (active === 'true') {
            whereClause.active = true;
        } else if (active === 'false') {
            whereClause.active = false;
        }

        // Filter by pinned status
        if (pin_to_sidebar === 'true') {
            whereClause.pin_to_sidebar = true;
        } else if (pin_to_sidebar === 'false') {
            whereClause.pin_to_sidebar = false;
        }

        // Filter by area
        if (area_id && area_id !== '') {
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
                    attributes: ['id', 'name'],
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

// GET /api/project/:id
router.get('/project/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const project = await Project.findOne({
            where: { id: req.params.id, user_id: req.session.userId },
            include: [
                {
                    model: Task,
                    required: false,
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name'],
                            through: { attributes: [] },
                            required: false,
                        },
                    ],
                },
                { model: Area, required: false, attributes: ['id', 'name'] },
                {
                    model: Tag,
                    attributes: ['id', 'name'],
                    through: { attributes: [] },
                },
            ],
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const projectJson = project.toJSON();
        const result = {
            ...projectJson,
            tags: projectJson.Tags || [], // Normalize Tags to tags
            due_date_at: formatDate(project.due_date_at),
        };

        res.json(result);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/project
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
            tags,
            Tags,
        } = req.body;

        // Handle both tags and Tags (Sequelize association format)
        const tagsData = tags || Tags;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        const projectData = {
            name: name.trim(),
            description: description || '',
            area_id: area_id || null,
            active: true,
            pin_to_sidebar: false,
            priority: priority || null,
            due_date_at: due_date_at || null,
            image_url: image_url || null,
            user_id: req.session.userId,
        };

        const project = await Project.create(projectData);
        await updateProjectTags(project, tagsData, req.session.userId);

        // Reload project with associations
        const projectWithAssociations = await Project.findByPk(project.id, {
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name'],
                    through: { attributes: [] },
                },
            ],
        });

        const projectJson = projectWithAssociations.toJSON();

        res.status(201).json({
            ...projectJson,
            tags: projectJson.Tags || [], // Normalize Tags to tags
            due_date_at: formatDate(projectWithAssociations.due_date_at),
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

// PATCH /api/project/:id
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
            active,
            pin_to_sidebar,
            priority,
            due_date_at,
            image_url,
            tags,
            Tags,
        } = req.body;

        // Handle both tags and Tags (Sequelize association format)
        const tagsData = tags || Tags;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (area_id !== undefined) updateData.area_id = area_id;
        if (active !== undefined) updateData.active = active;
        if (pin_to_sidebar !== undefined)
            updateData.pin_to_sidebar = pin_to_sidebar;
        if (priority !== undefined) updateData.priority = priority;
        if (due_date_at !== undefined) updateData.due_date_at = due_date_at;
        if (image_url !== undefined) updateData.image_url = image_url;

        await project.update(updateData);
        await updateProjectTags(project, tagsData, req.session.userId);

        // Reload project with associations
        const projectWithAssociations = await Project.findByPk(project.id, {
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name'],
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

        await project.destroy();
        res.json({ message: 'Project successfully deleted' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(400).json({
            error: 'There was a problem deleting the project.',
        });
    }
});

module.exports = router;
