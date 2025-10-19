const request = require('supertest');
const express = require('express');
const session = require('express-session');
const { User, Setting, sequelize } = require('../../models');
const authRoutes = require('../../routes/auth');
const { getConfig } = require('../../config/config');
const { sendEmail, isEmailEnabled } = require('../../services/emailService');

jest.mock('../../config/config');
jest.mock('../../services/emailService', () => ({
    sendEmail: jest.fn(),
    isEmailEnabled: jest.fn(),
}));
jest.mock('../../services/logService', () => ({
    logError: jest.fn(),
    logInfo: jest.fn(),
    logDebug: jest.fn(),
}));

describe('Registration Integration Tests', () => {
    let app;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    beforeEach(async () => {
        await User.destroy({ where: {}, truncate: true });
        jest.clearAllMocks();

        app = express();
        app.use(express.json());
        app.use(
            session({
                secret: 'test-secret',
                resave: false,
                saveUninitialized: false,
            })
        );
        app.use('/api', authRoutes);

        getConfig.mockReturnValue({
            frontendUrl: 'http://localhost:3000',
            backendUrl: 'http://localhost:3002',
            registrationConfig: {
                tokenExpiryHours: 24,
            },
            emailConfig: {
                enabled: true,
            },
        });

        // Enable registration in database for tests
        await Setting.upsert({
            key: 'registration_enabled',
            value: 'true',
        });

        sendEmail.mockResolvedValue({ success: true });
        isEmailEnabled.mockReturnValue(true);
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('GET /api/registration-status', () => {
        it('should return enabled status', async () => {
            const response = await request(app).get('/api/registration-status');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ enabled: true });
        });

        it('should return disabled status', async () => {
            await Setting.upsert({
                key: 'registration_enabled',
                value: 'false',
            });

            const response = await request(app).get('/api/registration-status');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ enabled: false });
        });
    });

    describe('POST /api/register', () => {
        it('should register new user successfully', async () => {
            const response = await request(app).post('/api/register').send({
                email: 'newuser@example.com',
                password: 'password123',
            });

            expect(response.status).toBe(201);
            expect(response.body.message).toContain('Registration successful');

            const user = await User.findOne({
                where: { email: 'newuser@example.com' },
            });
            expect(user).toBeTruthy();
            expect(user.email_verified).toBe(false);
            expect(user.email_verification_token).toBeTruthy();
            expect(sendEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'newuser@example.com',
                    subject: 'Welcome to Tududi - Verify your email',
                })
            );
        });

        it('should return 404 when registration disabled', async () => {
            await Setting.upsert({
                key: 'registration_enabled',
                value: 'false',
            });

            const response = await request(app).post('/api/register').send({
                email: 'test@example.com',
                password: 'password123',
            });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Registration is not enabled');
        });

        it('should return 400 for missing email', async () => {
            const response = await request(app).post('/api/register').send({
                password: 'password123',
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain(
                'Email and password are required'
            );
        });

        it('should return 400 for missing password', async () => {
            const response = await request(app).post('/api/register').send({
                email: 'test@example.com',
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain(
                'Email and password are required'
            );
        });

        it('should return 400 for invalid email format', async () => {
            const response = await request(app).post('/api/register').send({
                email: 'invalid-email',
                password: 'password123',
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid email format');
        });

        it('should return 400 for short password', async () => {
            const response = await request(app).post('/api/register').send({
                email: 'test@example.com',
                password: '12345',
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe(
                'Password must be at least 6 characters long'
            );
        });

        it('should return 400 for existing email', async () => {
            await User.create({
                email: 'existing@example.com',
                password: 'password123',
                email_verified: true,
            });

            const response = await request(app).post('/api/register').send({
                email: 'existing@example.com',
                password: 'password123',
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Email already registered');
        });
    });

    describe('GET /api/verify-email', () => {
        it('should verify email successfully', async () => {
            const user = await User.create({
                email: 'verify@example.com',
                password: 'password123',
                email_verified: false,
                email_verification_token: 'valid-token',
                email_verification_token_expires_at: new Date(
                    Date.now() + 3600000
                ),
            });

            const response = await request(app).get(
                '/api/verify-email?token=valid-token'
            );

            expect(response.status).toBe(302);
            expect(response.header.location).toBe(
                'http://localhost:3000/login?verified=true'
            );

            const updatedUser = await User.findByPk(user.id);
            expect(updatedUser.email_verified).toBe(true);
            expect(updatedUser.email_verification_token).toBe(null);
        });

        it('should redirect with error for missing token', async () => {
            const response = await request(app).get('/api/verify-email');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Verification token is required');
        });

        it('should redirect with error for invalid token', async () => {
            const response = await request(app).get(
                '/api/verify-email?token=invalid-token'
            );

            expect(response.status).toBe(302);
            expect(response.header.location).toBe(
                'http://localhost:3000/login?verified=false&error=invalid'
            );
        });

        it('should redirect with error for already verified', async () => {
            await User.create({
                email: 'verified@example.com',
                password: 'password123',
                email_verified: true,
                email_verification_token: 'token',
                email_verification_token_expires_at: new Date(
                    Date.now() + 3600000
                ),
            });

            const response = await request(app).get(
                '/api/verify-email?token=token'
            );

            expect(response.status).toBe(302);
            expect(response.header.location).toBe(
                'http://localhost:3000/login?verified=false&error=already_verified'
            );
        });

        it('should redirect with error for expired token', async () => {
            await User.create({
                email: 'expired@example.com',
                password: 'password123',
                email_verified: false,
                email_verification_token: 'expired-token',
                email_verification_token_expires_at: new Date(
                    Date.now() - 3600000
                ),
            });

            const response = await request(app).get(
                '/api/verify-email?token=expired-token'
            );

            expect(response.status).toBe(302);
            expect(response.header.location).toBe(
                'http://localhost:3000/login?verified=false&error=expired'
            );
        });
    });

    describe('POST /api/login', () => {
        it('should prevent login for unverified email', async () => {
            await User.create({
                email: 'unverified@example.com',
                password: 'password123',
                email_verified: false,
            });

            const response = await request(app).post('/api/login').send({
                email: 'unverified@example.com',
                password: 'password123',
            });

            expect(response.status).toBe(403);
            expect(response.body.error).toContain('verify your email');
            expect(response.body.email_not_verified).toBe(true);
        });

        it('should allow login for verified email', async () => {
            await User.create({
                email: 'verified@example.com',
                password: 'password123',
                email_verified: true,
            });

            const response = await request(app).post('/api/login').send({
                email: 'verified@example.com',
                password: 'password123',
            });

            expect(response.status).toBe(200);
            expect(response.body.user).toBeTruthy();
            expect(response.body.user.email).toBe('verified@example.com');
        });
    });

    describe('Full Registration Flow', () => {
        it('should complete full registration and login flow', async () => {
            // Step 1: Register
            const registerResponse = await request(app)
                .post('/api/register')
                .send({
                    email: 'flow@example.com',
                    password: 'password123',
                });

            expect(registerResponse.status).toBe(201);

            // Step 2: Get user and token
            const user = await User.findOne({
                where: { email: 'flow@example.com' },
            });
            const token = user.email_verification_token;

            // Step 3: Try to login before verification
            const loginBeforeResponse = await request(app)
                .post('/api/login')
                .send({
                    email: 'flow@example.com',
                    password: 'password123',
                });

            expect(loginBeforeResponse.status).toBe(403);
            expect(loginBeforeResponse.body.email_not_verified).toBe(true);

            // Step 4: Verify email
            const verifyResponse = await request(app).get(
                `/api/verify-email?token=${token}`
            );

            expect(verifyResponse.status).toBe(302);
            expect(verifyResponse.header.location).toContain('verified=true');

            // Step 5: Login after verification
            const loginAfterResponse = await request(app)
                .post('/api/login')
                .send({
                    email: 'flow@example.com',
                    password: 'password123',
                });

            expect(loginAfterResponse.status).toBe(200);
            expect(loginAfterResponse.body.user.email).toBe('flow@example.com');
        });
    });
});
