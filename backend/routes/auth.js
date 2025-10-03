const express = require('express');
const { User } = require('../models');
const packageJson = require('../../package.json');
const router = express.Router();

/**
 * @swagger
 * /version:
 *   get:
 *     summary: Get application version
 *     responses:
 *       200:
 *         description: Version info
 */
router.get('/version', (req, res) => {
    res.json({ version: packageJson.version });
});

/**
 * @swagger
 * /current_user:
 *   get:
 *     summary: Get current authenticated user info
 *     responses:
 *       200:
 *         description: User info or null if not authenticated
 */
router.get('/current_user', async (req, res) => {
    try {
        if (req.session && req.session.userId) {
            const user = await User.findByPk(req.session.userId);
            if (user) {
                return res.json({
                    user: {
                        id: user.id,
                        email: user.email,
                        language: user.language,
                        appearance: user.appearance,
                        timezone: user.timezone,
                    },
                });
            }
        }

        res.json({ user: null });
    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Authenticate user and create session
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *             required:
 *               - email
 *               - password
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
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

        res.json({
            user: {
                id: user.id,
                email: user.email,
                language: user.language,
                appearance: user.appearance,
                timezone: user.timezone,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /logout:
 *   get:
 *     summary: Logout and destroy session
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Could not log out' });
        }

        res.json({ message: 'Logged out successfully' });
    });
});

module.exports = router;
