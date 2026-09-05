'use strict';

const { User, sequelize } = require('../../models');
const { isAdmin } = require('../../services/rolesService');
const { logError } = require('../../services/logService');
const { getConfig } = require('../../config/config');
const { isPasswordAuthEnabled } = require('../../config/authConfig');
const {
    isRegistrationEnabled,
    createUnverifiedUser,
    sendVerificationEmail,
    verifyUserEmail,
    resendVerificationEmail,
} = require('./registrationService');
const {
    requestPasswordReset,
    resetPasswordWithToken,
} = require('./passwordResetService');
const { MIN_LENGTH_POLICY_MESSAGE } = require('../users/userService');
const peopleService = require('../people/service');
const packageJson = require('../../../package.json');
const {
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    ServiceUnavailableError,
} = require('../../shared/errors');

class AuthService {
    getVersion() {
        return { version: packageJson.version };
    }

    async getRegistrationStatus() {
        return { enabled: await isRegistrationEnabled() };
    }

    async register(email, password) {
        const transaction = await sequelize.transaction();

        try {
            if (!isPasswordAuthEnabled()) {
                await transaction.rollback();
                throw new ForbiddenError(
                    'Password registration is disabled. Please use SSO to sign in.'
                );
            }

            if (!(await isRegistrationEnabled())) {
                await transaction.rollback();
                throw new NotFoundError('Registration is not enabled');
            }

            if (!email || !password) {
                await transaction.rollback();
                throw new ValidationError('Email and password are required');
            }

            const { user, verificationToken } = await createUnverifiedUser(
                email,
                password,
                transaction
            );

            const emailResult = await sendVerificationEmail(
                user,
                verificationToken
            );

            // Without a verification email the account could never be
            // used, so the user row is not kept. Say why, and say it as a
            // temporary condition: the address itself is fine.
            if (!emailResult.success) {
                await transaction.rollback();
                logError(
                    new Error(emailResult.reason),
                    'Email sending failed during registration, rolling back user creation'
                );
                throw new ServiceUnavailableError(
                    'Registration is temporarily unavailable because verification emails cannot be sent. Please try again later.'
                );
            }

            await transaction.commit();

            try {
                await peopleService.createSelfPerson(user);
            } catch (err) {
                logError(err, 'Failed to create self-person for new user');
            }

            return {
                message:
                    'Registration successful. Please check your email to verify your account.',
            };
        } catch (error) {
            if (!transaction.finished) {
                await transaction.rollback();
            }

            if (error.message === 'Email already registered') {
                throw new ValidationError(error.message);
            }
            if (
                error.message === 'Invalid email format' ||
                error.message === MIN_LENGTH_POLICY_MESSAGE
            ) {
                throw new ValidationError(error.message);
            }
            throw error;
        }
    }

    // Same response whether the address is unknown, already verified, or
    // just got a new link.
    async resendVerification(email) {
        if (!isPasswordAuthEnabled()) {
            throw new ForbiddenError(
                'Password registration is disabled. Please use SSO to sign in.'
            );
        }
        if (!email || typeof email !== 'string') {
            throw new ValidationError('Email is required');
        }

        await resendVerificationEmail(email);

        return {
            message:
                'If that address belongs to an unverified account, a new verification email has been sent.',
        };
    }

    async verifyEmail(token) {
        if (!token) {
            throw new ValidationError('Verification token is required');
        }

        try {
            await verifyUserEmail(token);
            const config = getConfig();
            return { redirect: `${config.frontendUrl}/login?verified=true` };
        } catch (error) {
            const config = getConfig();
            let errorParam = 'invalid';

            if (error.message === 'Email already verified') {
                errorParam = 'already_verified';
            } else if (error.message === 'Verification token has expired') {
                errorParam = 'expired';
            }

            logError('Email verification error:', error);
            return {
                redirect: `${config.frontendUrl}/login?verified=false&error=${errorParam}`,
            };
        }
    }

    async getCurrentUser(session) {
        if (session && session.userId) {
            const user = await User.findByPk(session.userId, {
                attributes: [
                    'uid',
                    'email',
                    'name',
                    'surname',
                    'language',
                    'appearance',
                    'timezone',
                    'avatar_image',
                    'features',
                    'ui_settings',
                ],
            });
            if (user) {
                const admin = await isAdmin(user.uid);
                let features = user.features;
                if (features && typeof features === 'string') {
                    try {
                        features = JSON.parse(features);
                    } catch {
                        features = {};
                    }
                }
                let uiSettings = user.ui_settings;
                if (uiSettings && typeof uiSettings === 'string') {
                    try {
                        uiSettings = JSON.parse(uiSettings);
                    } catch {
                        uiSettings = null;
                    }
                }
                return {
                    user: {
                        uid: user.uid,
                        email: user.email,
                        name: user.name,
                        surname: user.surname,
                        language: user.language,
                        appearance: user.appearance,
                        timezone: user.timezone,
                        avatar_image: user.avatar_image,
                        features: features || {},
                        ui_settings: uiSettings || null,
                        is_admin: admin,
                    },
                };
            }
        }

        return { user: null };
    }

    async login(email, password, session) {
        if (!isPasswordAuthEnabled()) {
            throw new ForbiddenError(
                'Password login is disabled. Please use SSO to sign in.'
            );
        }

        if (!email || !password) {
            throw new ValidationError('Invalid login parameters.');
        }

        // Emails are stored lowercased (see the User beforeValidate hook)
        const user = await User.findOne({
            where: { email: String(email).trim().toLowerCase() },
        });
        if (!user) {
            throw new UnauthorizedError('Invalid credentials');
        }

        if (!user.password_digest) {
            const oidcEnabled =
                (process.env.OIDC_ENABLED || '').toLowerCase() === 'true';
            if (oidcEnabled) {
                throw new UnauthorizedError(
                    'This account has no password set. Please sign in with your SSO provider, or contact an administrator to set a password.'
                );
            }
            throw new UnauthorizedError(
                'This account has no password set. Use "Forgot password" to create one.'
            );
        }

        const isValidPassword = await User.checkPassword(
            password,
            user.password_digest
        );
        if (!isValidPassword) {
            throw new UnauthorizedError('Invalid credentials');
        }

        if (!user.email_verified) {
            const error = new ForbiddenError(
                'Please verify your email address before logging in.'
            );
            error.email_not_verified = true;
            throw error;
        }

        session.userId = user.id;

        await new Promise((resolve, reject) => {
            session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const admin = await isAdmin(user.uid);
        return {
            user: {
                uid: user.uid,
                email: user.email,
                name: user.name,
                surname: user.surname,
                language: user.language,
                appearance: user.appearance,
                timezone: user.timezone,
                avatar_image: user.avatar_image,
                is_admin: admin,
            },
        };
    }

    // Always answers the same way: whether an address has an account is not
    // something an unauthenticated caller gets to learn here.
    async forgotPassword(email) {
        if (!isPasswordAuthEnabled()) {
            throw new ForbiddenError(
                'Password login is disabled. Please use SSO to sign in.'
            );
        }
        if (!email || typeof email !== 'string') {
            throw new ValidationError('Email is required');
        }

        await requestPasswordReset(email);

        return {
            message:
                'If an account exists for that email, a password reset link has been sent.',
        };
    }

    async resetPassword(token, password) {
        if (!isPasswordAuthEnabled()) {
            throw new ForbiddenError(
                'Password login is disabled. Please use SSO to sign in.'
            );
        }
        if (!token || typeof token !== 'string') {
            throw new ValidationError('Reset token is required');
        }

        const user = await resetPasswordWithToken(token, password);
        return { message: 'Password updated', email: user.email };
    }

    logout(session) {
        return new Promise((resolve, reject) => {
            session.destroy((err) => {
                if (err) {
                    logError('Logout error:', err);
                    reject(new Error('Could not log out'));
                } else {
                    resolve({ message: 'Logged out successfully' });
                }
            });
        });
    }
}

module.exports = new AuthService();
