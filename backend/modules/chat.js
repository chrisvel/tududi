const express = require('express');
const aiChatService = require('../services/aiChatService');
const { logError } = require('../services/logService');
const { Task, Project, Note, Tag } = require('../models');
const router = express.Router();

// Check if AI is enabled
router.get('/chat/enabled', (req, res) => {
    res.json({
        enabled: aiChatService.isEnabled(),
        provider: process.env.AI_PROVIDER || 'openai',
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
    });
});

// Send message (non-streaming)
router.post('/chat/message', async (req, res) => {
    try {
        const { message, history, conversationId } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!aiChatService.isEnabled()) {
            return res.status(503).json({
                error: 'AI chat is not enabled. Please configure API keys.',
            });
        }

        const result = await aiChatService.chat(
            req.session.userId,
            message,
            history || [],
            conversationId || null
        );

        res.json(result);
    } catch (error) {
        logError('Chat error:', error);

        // Handle specific OpenAI errors
        if (error.code === 'invalid_api_key') {
            return res
                .status(401)
                .json({ error: 'Invalid API key configured' });
        }

        if (error.code === 'rate_limit_exceeded') {
            return res
                .status(429)
                .json({ error: 'Rate limit exceeded. Please try again later.' });
        }

        res.status(500).json({
            error: 'Failed to process chat message. Please try again.',
        });
    }
});

// Send message (streaming with Server-Sent Events)
router.post('/chat/stream', async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!aiChatService.isEnabled()) {
            return res.status(503).json({
                error: 'AI chat is not enabled. Please configure API keys.',
            });
        }

        // Set up Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        try {
            const stream = aiChatService.chatStream(
                req.session.userId,
                message,
                history || []
            );

            for await (const chunk of stream) {
                res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
            }

            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
        } catch (error) {
            logError('Stream error:', error);
            res.write(
                `data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`
            );
            res.end();
        }
    } catch (error) {
        logError('Stream setup error:', error);
        res.status(500).json({ error: 'Failed to setup stream' });
    }
});

// Get item details (task, project, or note)
router.get('/chat/item/:type/:uid', async (req, res) => {
    try {
        const { type, uid } = req.params;
        const userId = req.session.userId;

        let item = null;

        switch (type) {
            case 'task':
                item = await Task.findOne({
                    where: { uid, user_id: userId },
                    include: [
                        { model: Project, attributes: ['uid', 'name'] },
                        { model: Tag, attributes: ['uid', 'name'] },
                    ],
                });
                break;
            case 'project':
                item = await Project.findOne({
                    where: { uid, user_id: userId },
                    include: [{ model: Tag, attributes: ['uid', 'name'] }],
                });
                break;
            case 'note':
                item = await Note.findOne({
                    where: { uid, user_id: userId },
                    include: [
                        { model: Project, attributes: ['uid', 'name'] },
                        { model: Tag, attributes: ['uid', 'name'] },
                    ],
                });
                break;
            default:
                return res.status(400).json({ error: 'Invalid item type' });
        }

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json({ type, item });
    } catch (error) {
        logError('Get item error:', error);
        res.status(500).json({ error: 'Failed to fetch item' });
    }
});

module.exports = router;
