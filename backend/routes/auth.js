const express = require('express');
const { User } = require('../models');
const router = express.Router();

// Get current user
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

// Logout
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
