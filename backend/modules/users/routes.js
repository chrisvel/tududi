'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();
const usersController = require('./controller');
const { apiKeyManagementLimiter } = require('../../middleware/rateLimiter');

// Configure multer for avatar uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/avatars');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error, uploadDir);
        }
    },
    filename: (req, file, cb) => {
        const userId = req.currentUser?.id || req.session?.userId;
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${userId}-${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed!'));
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: fileFilter,
});

// All routes require authentication (handled by app.js middleware)

// Users list
router.get('/users', usersController.list);

// Profile routes
router.get('/profile', usersController.getProfile);
router.patch('/profile', usersController.updateProfile);

// Avatar routes
router.post(
    '/profile/avatar',
    upload.single('avatar'),
    usersController.uploadAvatar
);
router.delete('/profile/avatar', usersController.deleteAvatar);

// Password change
router.post('/profile/change-password', usersController.changePassword);

// API keys (with rate limiting)
router.get(
    '/profile/api-keys',
    apiKeyManagementLimiter,
    usersController.listApiKeys
);
router.post(
    '/profile/api-keys',
    apiKeyManagementLimiter,
    usersController.createApiKey
);
router.post(
    '/profile/api-keys/:id/revoke',
    apiKeyManagementLimiter,
    usersController.revokeApiKey
);
router.delete(
    '/profile/api-keys/:id',
    apiKeyManagementLimiter,
    usersController.deleteApiKey
);

// Task summary routes
router.post('/profile/task-summary/toggle', usersController.toggleTaskSummary);
router.post(
    '/profile/task-summary/frequency',
    usersController.updateTaskSummaryFrequency
);
router.post(
    '/profile/task-summary/send-now',
    usersController.sendTaskSummaryNow
);
router.get(
    '/profile/task-summary/status',
    usersController.getTaskSummaryStatus
);

// Settings routes
router.put('/profile/today-settings', usersController.updateTodaySettings);
router.put('/profile/sidebar-settings', usersController.updateSidebarSettings);
router.put('/profile/ui-settings', usersController.updateUiSettings);

module.exports = router;
