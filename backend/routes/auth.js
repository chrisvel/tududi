const express = require('express');
const { User } = require('../models');
const { isAdmin } = require('../services/rolesService');
const { logError } = require('../services/logService');
const { getConfig } = require('../config/config');
const {
    isRegistrationEnabled,
    createUnverifiedUser,
    sendVerificationEmail,
    verifyUserEmail,
} = require('../services/registrationService');
const packageJson = require('../../package.json');
const router = express.Router();

// Get version
router.get('/version', (req, res) => {
    res.json({ version: packageJson.version });
});

// Get registration status
router.get('/registration-status', (req, res) => {
    res.json({ enabled: isRegistrationEnabled() });
});

// Register new user
router.post('/register', async (req, res) => {
    try {
        if (!isRegistrationEnabled()) {
            return res.status(404).json({ error: 'Registration is not enabled' });
        }

        const { email, password } = req.body;

        if (!email || !password) {
            return res
                .status(400)
                .json({ error: 'Email and password are required' });
        }

        const { user, verificationToken } = await createUnverifiedUser(
            email,
            password
        );

        await sendVerificationEmail(user, verificationToken);

        res.status(201).json({
            message:
                'Registration successful. Please check your email to verify your account.',
        });
    } catch (error) {
        if (error.message === 'Email already registered') {
            return res.status(400).json({ error: error.message });
        }
        if (
            error.message === 'Invalid email format' ||
            error.message === 'Password must be at least 6 characters long'
        ) {
            return res.status(400).json({ error: error.message });
        }
        logError('Registration error:', error);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

// Verify email
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ error: 'Verification token is required' });
        }

        await verifyUserEmail(token);

        const config = getConfig();
        res.redirect(`${config.frontendUrl}/login?verified=true`);
    } catch (error) {
        const config = getConfig();
        let errorParam = 'invalid';

        if (error.message === 'Email already verified') {
            errorParam = 'already_verified';
        } else if (error.message === 'Verification token has expired') {
            errorParam = 'expired';
        }

        logError('Email verification error:', error);
        res.redirect(`${config.frontendUrl}/login?verified=false&error=${errorParam}`);
    }
});

// Get current user
router.get('/current_user', async (req, res) => {
    try {
        if (req.session && req.session.userId) {
            const user = await User.findByPk(req.session.userId, {
                attributes: [
                    'uid',
                    'email',
                    'name',
                    'surname',
                    'language',
                    'appearance',
                    'timezone',
                ],
            });
            if (user) {
                const admin = await isAdmin(user.uid);
                return res.json({
                    user: {
                        uid: user.uid,
                        email: user.email,
                        name: user.name,
                        surname: user.surname,
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

        if (!user.email_verified) {
            return res.status(403).json({
                error: 'Please verify your email address before logging in.',
                email_not_verified: true,
            });
        }

        req.session.userId = user.id;

        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const admin = await isAdmin(user.uid);
        res.json({
            user: {
                uid: user.uid,
                email: user.email,
                name: user.name,
                surname: user.surname,
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
