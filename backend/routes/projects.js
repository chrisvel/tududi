const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Project = require('../models-mongo/project');
const Task = require('../models-mongo/task');
const Tag = require('../models-mongo/tag');
const Area = require('../models-mongo/area');
const Note = require('../models-mongo/note');
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
    if (!tagsData) {
        project.tags = [];
        return;
    }

    const tagNames = tagsData
        .map((tag) => tag.name)
        .filter((name) => name && name.trim())
        .filter((name, index, arr) => arr.indexOf(name) === index); // unique

    if (tagNames.length === 0) {
        project.tags = [];
        return;
    }

    // Find existing tags
    const existingTags = await Tag.find({
        user: userId,
        name: { $in: tagNames },
    });

    // Create new tags
    const existingTagNames = existingTags.map((tag) => tag.name);
    const newTagNames = tagNames.filter(
        (name) => !existingTagNames.includes(name)
    );

    const createdTags = await Promise.all(
        newTagNames.map((name) => {
            const newTag = new Tag({ name, user: userId });
            return newTag.save();
        })
    );

    // Set all tags to project
    const allTags = [...existingTags, ...createdTags];
    project.tags = allTags.map(tag => tag._id);
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

        let whereClause = { user: req.session.userId };

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
            whereClause.area = area_id;
        }

        const projects = await Project.find(whereClause)
            .populate('area', 'name')
            .populate('tags', 'id name')
            .sort({ name: 'asc' });

        const enhancedProjects = await Promise.all(projects.map(async (project) => {
            const tasks = await Task.find({ project: project._id });
            const taskStatus = {
                total: tasks.length,
                done: tasks.filter((t) => t.status === 2).length,
                in_progress: tasks.filter((t) => t.status === 1).length,
                not_started: tasks.filter((t) => t.status === 0).length,
            };

            const projectJson = project.toObject();
            return {
                ...projectJson,
                id: projectJson._id,
                due_date_at: formatDate(project.due_date_at),
                task_status: taskStatus,
                completion_percentage:
                    taskStatus.total > 0
                        ? Math.round((taskStatus.done / taskStatus.total) * 100)
                        : 0,
            };
        }));

        const { grouped } = req.query;

        // If grouped=true, return grouped format
        if (grouped === 'true') {
            const groupedProjects = {};
            enhancedProjects.forEach((project) => {
                const areaName = project.area ? project.area.name : 'No Area';
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

        const project = await Project.findOne({ _id: req.params.id, user: req.session.userId })
            .populate({
                path: 'tasks',
                populate: {
                    path: 'tags',
                    select: 'id name'
                }
            })
            .populate('notes', 'id title content created_at updated_at')
            .populate('area', 'id name')
            .populate('tags', 'id name');

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const projectJson = project.toObject();
        
        // Normalize task data to match frontend expectations
        const normalizedTasks = projectJson.tasks ? projectJson.tasks.map(task => {
            const normalizedTask = {
                ...task,
                id: task._id,
                due_date: task.due_date ? (typeof task.due_date === 'string' ? task.due_date.split('T')[0] : task.due_date.toISOString().split('T')[0]) : null
            };
            return normalizedTask;
        }) : [];
        
        const result = {
            ...projectJson,
            id: projectJson._id,
            Tasks: normalizedTasks, // Keep as Tasks (capital T) to match expected structure
            Notes: projectJson.notes || [], // Include notes
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
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        const project = new Project({
            name: name.trim(),
            description: description || '',
            area: area_id || null,
            active: true,
            pin_to_sidebar: false,
            priority: priority || null,
            due_date_at: due_date_at || null,
            image_url: image_url || null,
            user: req.session.userId,
        });

        await updateProjectTags(project, tags, req.session.userId);
        await project.save();

        await project.populate('tags', 'id name');

        const projectJson = project.toObject();

        res.status(201).json({
            ...projectJson,
            id: projectJson._id,
            due_date_at: formatDate(project.due_date_at),
        });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(400).json({
            error: 'There was a problem creating the project.',
            details: error.message,
        });
    }
});

// PATCH /api/project/:id
router.patch('/project/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const project = await Project.findOne({ _id: req.params.id, user: req.session.userId });

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
        } = req.body;

        if (name !== undefined) project.name = name;
        if (description !== undefined) project.description = description;
        if (area_id !== undefined) project.area = area_id;
        if (active !== undefined) project.active = active;
        if (pin_to_sidebar !== undefined) project.pin_to_sidebar = pin_to_sidebar;
        if (priority !== undefined) project.priority = priority;
        if (due_date_at !== undefined) project.due_date_at = due_date_at;
        if (image_url !== undefined) project.image_url = image_url;

        await updateProjectTags(project, tags, req.session.userId);
        await project.save();

        await project.populate('tags', 'id name');

        const projectJson = project.toObject();

        res.json({
            ...projectJson,
            id: projectJson._id,
            due_date_at: formatDate(project.due_date_at),
        });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(400).json({
            error: 'There was a problem updating the project.',
            details: error.message,
        });
    }
});

// DELETE /api/project/:id
router.delete('/project/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const project = await Project.findOneAndDelete({ _id: req.params.id, user: req.session.userId });

        if (!project) {
            return res.status(404).json({ error: 'Project not found.' });
        }

        res.json({ message: 'Project successfully deleted' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(400).json({
            error: 'There was a problem deleting the project.',
        });
    }
});

module.exports = router;
