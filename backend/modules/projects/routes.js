'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getConfig } = require('../../config/config');
const config = getConfig();
const router = express.Router();
const projectsController = require('./controller');
const { hasAccess } = require('../../middleware/authorize');
const { requireAuth } = require('../../middleware/auth');

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

// All routes require authentication (handled by app.js middleware)

// Upload project image
router.post(
    '/upload/project-image',
    requireAuth,
    upload.single('image'),
    projectsController.uploadImage
);

// List all projects
router.get('/projects', projectsController.list);

// Get a single project (requires read access)
router.get(
    '/project/:uidSlug',
    hasAccess(
        'ro',
        'project',
        (req) => projectsController.getProjectUidForAuth(req),
        { notFoundMessage: 'Project not found' }
    ),
    projectsController.getOne
);

// Create a new project
router.post('/project', projectsController.create);

// Update a project (requires write access)
router.patch(
    '/project/:uid',
    hasAccess(
        'rw',
        'project',
        (req) => projectsController.getProjectUidForAuth(req),
        { notFoundMessage: 'Project not found.' }
    ),
    projectsController.update
);

// Delete a project (requires write access)
router.delete(
    '/project/:uid',
    requireAuth,
    hasAccess(
        'rw',
        'project',
        (req) => projectsController.getProjectUidForAuth(req),
        { notFoundMessage: 'Project not found.' }
    ),
    projectsController.delete
);

module.exports = router;
