'use strict';

const { User, sequelize } = require('../../models');
const { isAdmin } = require('../../services/rolesService');
const { logError } = require('../../services/logService');
const { getConfig } = require('../../config/config');
const {
    isRegistrationEnabled,
    createUnverifiedUser,
    sendVerificationEmail,
    verifyUserEmail,
} = require('./registrationService');
const packageJson = require('../../../package.json');
const {
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
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

            if (!emailResult.success) {
                await transaction.rollback();
                logError(
                    new Error(emailResult.reason),
                    'Email sending failed during registration, rolling back user creation'
                );
                throw new Error(
                    'Failed to send verification email. Please try again later.'
                );
            }

            await transaction.commit();

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
                error.message === 'Password must be at least 6 characters long'
            ) {
                throw new ValidationError(error.message);
            }
            throw error;
        }
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
                ],
            });
            if (user) {
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
        }

        return { user: null };
    }

    async login(email, password, session) {
        if (!email || !password) {
            throw new ValidationError('Invalid login parameters.');
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            throw new UnauthorizedError('Invalid credentials');
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
