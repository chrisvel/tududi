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

// AI Settings routes
const { User } = require('../../models');
const { logError } = require('../../services/logService');

router.get('/profile/ai-settings', async (req, res) => {
    try {
        const userId = req.currentUser?.id || req.session?.userId;
        const user = await User.findByPk(userId, {
            attributes: [
                'ai_provider',
                'openai_api_key',
                'ollama_base_url',
                'ollama_model',
            ],
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json({
            ai_provider: user.ai_provider || 'openai',
            has_openai_key: !!user.openai_api_key,
            ollama_base_url: user.ollama_base_url || 'http://localhost:11434',
            ollama_model: user.ollama_model || 'llama3',
        });
    } catch (error) {
        logError('Error fetching AI settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.patch('/profile/ai-settings', async (req, res) => {
    try {
        const userId = req.currentUser?.id || req.session?.userId;
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const { ai_provider, openai_api_key, ollama_base_url, ollama_model } =
            req.body;

        const updates = {};

        if (ai_provider !== undefined) {
            if (!['openai', 'ollama'].includes(ai_provider)) {
                return res.status(400).json({
                    error: 'Invalid AI provider. Use "openai" or "ollama".',
                });
            }
            updates.ai_provider = ai_provider;
        }

        if (openai_api_key && openai_api_key.trim()) {
            updates.openai_api_key = openai_api_key.trim();
        }

        if (ollama_base_url !== undefined) {
            updates.ollama_base_url =
                ollama_base_url || 'http://localhost:11434';
        }

        if (ollama_model !== undefined) {
            updates.ollama_model = ollama_model || 'llama3';
        }

        await user.update(updates);

        res.json({
            success: true,
            ai_provider: user.ai_provider,
            has_openai_key: !!user.openai_api_key,
            ollama_base_url: user.ollama_base_url,
            ollama_model: user.ollama_model,
        });
    } catch (error) {
        logError('Error updating AI settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/profile/ai-settings/test', async (req, res) => {
    try {
        const userId = req.currentUser?.id || req.session?.userId;
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const { ai_provider, openai_api_key, ollama_base_url, ollama_model } =
            req.body;

        const provider = ai_provider || user.ai_provider || 'openai';

        if (provider === 'openai') {
            const apiKey = openai_api_key?.trim() || user.openai_api_key;
            if (!apiKey) {
                return res.status(400).json({
                    error: 'No OpenAI API key configured. Please add your API key.',
                });
            }

            try {
                const OpenAI = require('openai');
                const client = new OpenAI({ apiKey });
                const response = await client.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'user',
                            content: 'Say "Connection successful!"',
                        },
                    ],
                    max_tokens: 20,
                });

                if (response.choices?.[0]?.message?.content) {
                    return res.json({
                        success: true,
                        message: 'OpenAI connection successful!',
                    });
                }
            } catch (openaiError) {
                return res.status(400).json({
                    error: `OpenAI API error: ${openaiError.message}`,
                });
            }
        } else if (provider === 'ollama') {
            const baseUrl =
                ollama_base_url ||
                user.ollama_base_url ||
                'http://localhost:11434';
            const model = ollama_model || user.ollama_model || 'llama3';

            try {
                const response = await fetch(`${baseUrl}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model,
                        prompt: 'Say "Connection successful!"',
                        stream: false,
                    }),
                });

                if (response.ok) {
                    return res.json({
                        success: true,
                        message: `Ollama connection successful! Using model: ${model}`,
                    });
                } else {
                    const errorText = await response.text();
                    return res.status(400).json({
                        error: `Ollama error: ${errorText}`,
                    });
                }
            } catch (ollamaError) {
                return res.status(400).json({
                    error: `Cannot connect to Ollama at ${baseUrl}. Is Ollama running?`,
                });
            }
        }

        res.status(400).json({ error: 'Invalid AI provider' });
    } catch (error) {
        logError('Error testing AI connection:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
