const express = require('express');
const { User } = require('../models');
const { isAdmin } = require('../services/rolesService');
const { logError } = require('../services/logService');
const packageJson = require('../../package.json');
const router = express.Router();

// Get version
router.get('/version', (req, res) => {
    res.json({ version: packageJson.version });
});

// Get current user
router.get('/current_user', async (req, res) => {
    try {
        if (req.session && req.session.userId) {
            const user = await User.findByPk(req.session.userId, {
                attributes: [
                    'uid',
                    'email',
                    'language',
                    'appearance',
                    'timezone',
                ],
            });
            if (user) {
                const admin = await isAdmin(user.id);
                return res.json({
                    user: {
                        uid: user.uid,
                        email: user.email,
                        language: user.language,
                        appearance: user.appearance,
                        timezone: user.timezone,
                        is_admin: admin,
                    },
                });
            }
        }

        res.json({ user: null });
    } catch (error) {
        logError('Error fetching current user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Invalid login parameters.' });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ errors: ['Invalid credentials'] });
        }

        const isValidPassword = await User.checkPassword(
            password,
            user.password_digest
        );
        if (!isValidPassword) {
            return res.status(401).json({ errors: ['Invalid credentials'] });
        }

        req.session.userId = user.id;

        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const admin = await isAdmin(user.id);
        res.json({
            user: {
                uid: user.uid,
                email: user.email,
                language: user.language,
                appearance: user.appearance,
                timezone: user.timezone,
                is_admin: admin,
            },
        });
    } catch (error) {
        logError('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            logError('Logout error:', err);
            return res.status(500).json({ error: 'Could not log out' });
        }

        res.json({ message: 'Logged out successfully' });
    });
});

module.exports = router;
