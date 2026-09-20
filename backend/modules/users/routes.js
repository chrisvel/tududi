'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getConfig } = require('../../config/config');
const config = getConfig();
const router = express.Router();
const { blockDemoUser } = require('../../middleware/demo');
const {
    imageFileFilter,
    randomUploadName,
} = require('../../utils/image-upload');
const usersController = require('./controller');
const {
    apiKeyManagementLimiter,
    createResourceLimiter,
    passwordConfirmLimiter,
} = require('../../middleware/rateLimiter');

// Configure multer for avatar uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(config.uploadPath, 'avatars');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const userId = req.currentUser?.id || req.session?.userId;
        cb(null, randomUploadName(`avatar-${userId}`, file.mimetype));
    },
});

const fileFilter = imageFileFilter(
    'Only image files (JPEG, PNG, GIF, WebP) are allowed!'
);

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
router.patch(
    '/profile',
    passwordConfirmLimiter,
    blockDemoUser,
    usersController.updateProfile
);
router.delete(
    '/profile',
    passwordConfirmLimiter,
    blockDemoUser,
    usersController.deleteAccount
);

// Avatar routes
router.post(
    '/profile/avatar',
    createResourceLimiter,
    upload.single('avatar'),
    usersController.uploadAvatar
);
router.delete(
    '/profile/avatar',
    createResourceLimiter,
    usersController.deleteAvatar
);

// Password change
router.post(
    '/profile/change-password',
    passwordConfirmLimiter,
    blockDemoUser,
    usersController.changePassword
);

// API keys (with rate limiting)
router.get(
    '/profile/api-keys',
    apiKeyManagementLimiter,
    usersController.listApiKeys
);
// Closed to the demo account: a token would keep working after the sandbox
// is wiped, which is the one thing the reset exists to prevent.
router.post(
    '/profile/api-keys',
    apiKeyManagementLimiter,
    blockDemoUser,
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
router.get('/profile/ai-settings', usersController.getAiSettings);
router.put('/profile/ai-settings', usersController.updateAiSettings);

module.exports = router;
