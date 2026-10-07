'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getConfig } = require('../../config/config');
const { requireCapability } = require('../../middleware/roles');
const config = getConfig();
const router = express.Router();
const projectsController = require('./controller');
const attachmentRoutes = require('./attachmentRoutes');
const { hasAccess } = require('../../middleware/authorize');
const { requireAuth } = require('../../middleware/auth');
const { numericIdParam } = require('../../middleware/numericIdParam');
const { Project } = require('../../models');
const {
    imageFileFilter,
    randomUploadName,
} = require('../../utils/image-upload');

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
        cb(null, randomUploadName('project', file.mimetype));
    },
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: config.fileUploadLimitMB * 1024 * 1024,
    },
    fileFilter: imageFileFilter('Only image files are allowed!'),
});

// All routes require authentication (handled by app.js middleware)

// Upload project image
router.post(
    '/upload/project-image',
    requireAuth,
    upload.single('image'),
    projectsController.uploadImage
);

router.param('uid', numericIdParam('project', Project));
router.param('uidSlug', numericIdParam('project', Project));

// List all projects
router.get('/projects', projectsController.list);

// Save the current user's custom order of projects
router.put('/projects/order', projectsController.reorder);

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
router.post(
    '/project',
    requireCapability('create_projects'),
    projectsController.create
);

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

router.use(attachmentRoutes);

module.exports = router;
