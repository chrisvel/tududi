const { execSync, spawn } = require('child_process');
const path = require('path');
const { User } = require('../../models');

describe('User Create Script', () => {
    const scriptPath = path.join(__dirname, '../../scripts/user-create.js');

    // Helper function to run the script and capture output
    const runUserCreateScript = (args = []) => {
        return new Promise((resolve, reject) => {
            const child = spawn('node', [scriptPath, ...args], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, NODE_ENV: 'test' },
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                resolve({
                    code,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                });
            });

            child.on('error', (error) => {
                reject(error);
            });
        });
    };

    afterEach(async () => {
        // Clean up any test users created during tests
        await User.destroy({
            where: {
                email: [
                    'testuser@example.com',
                    'admin@example.com',
                    'invalid-email',
                    'existing@example.com',
                ],
            },
        });
    });

    describe('Success Cases', () => {
        it('should create a new user with valid email and password', async () => {
            const email = 'testuser@example.com';
            const password = 'securepassword123';

            const result = await runUserCreateScript([email, password]);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('✅ User created successfully');
            expect(result.stdout).toContain(`📧 Email: ${email}`);
            expect(result.stdout).toContain('🆔 User ID:');
            expect(result.stdout).toContain('📅 Created:');

            // Verify user was actually created in database
            const createdUser = await User.findOne({ where: { email } });
            expect(createdUser).toBeTruthy();
            expect(createdUser.email).toBe(email);
            expect(createdUser.password_digest).toBeTruthy();
            expect(createdUser.password_digest).not.toBe(password); // Should be hashed
        });

        it('should create user with minimum password length', async () => {
            const email = 'testuser2@example.com';
            const password = '123456'; // Exactly 6 characters

            const result = await runUserCreateScript([email, password]);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('✅ User created successfully');

            // Verify user was created
            const createdUser = await User.findOne({ where: { email } });
            expect(createdUser).toBeTruthy();

            // Clean up
            await User.destroy({ where: { email } });
        });

        it('should create user with complex email format', async () => {
            const email = 'user.name+tag@sub.domain.com';
            const password = 'password123';

            const result = await runUserCreateScript([email, password]);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('✅ User created successfully');

            // Verify user was created
            const createdUser = await User.findOne({ where: { email } });
            expect(createdUser).toBeTruthy();

            // Clean up
            await User.destroy({ where: { email } });
        });
    });

    describe('Error Cases', () => {
        it('should show usage when no arguments provided', async () => {
            const result = await runUserCreateScript([]);

            expect(result.code).toBe(1);
            expect(result.stderr).toContain(
                '❌ Usage: npm run user:create <email> <password>'
            );
            expect(result.stderr).toContain(
                'Example: npm run user:create admin@example.com mypassword123'
            );
        });

        it('should show usage when only email provided', async () => {
            const result = await runUserCreateScript(['test@example.com']);

            expect(result.code).toBe(1);
            expect(result.stderr).toContain(
                '❌ Usage: npm run user:create <email> <password>'
            );
        });

        it('should show usage when only password provided', async () => {
            const result = await runUserCreateScript(['', 'password123']);

            expect(result.code).toBe(1);
            expect(result.stderr).toContain(
                '❌ Usage: npm run user:create <email> <password>'
            );
        });

        it('should reject invalid email format', async () => {
            const invalidEmails = [
                'invalid-email',
                'missing@domain',
                '@missing-local.com',
                'spaces in@email.com',
                'double@@domain.com',
                'trailing.dot.@domain.com',
            ];

            for (const email of invalidEmails) {
                const result = await runUserCreateScript([
                    email,
                    'password123',
                ]);

                expect(result.code).toBe(1);
                expect(result.stderr).toContain('❌ Invalid email format');
            }
        });

        it('should reject password shorter than 6 characters', async () => {
            const shortPasswords = ['', '1', '12', '123', '1234', '12345'];

            for (const password of shortPasswords) {
                const result = await runUserCreateScript([
                    'test@example.com',
                    password,
                ]);

                expect(result.code).toBe(1);
                expect(result.stderr).toContain(
                    '❌ Password must be at least 6 characters long'
                );
            }
        });

        it('should reject duplicate email', async () => {
            const email = 'existing@example.com';
            const password = 'password123';

            // Create user first
            await User.create({
                email,
                password_digest: await require('bcrypt').hash(password, 10),
            });

            // Try to create same user again
            const result = await runUserCreateScript([email, password]);

            expect(result.code).toBe(1);
            expect(result.stderr).toContain(
                `❌ User with email ${email} already exists`
            );
        });
    });

    describe('Integration with npm script', () => {
        it('should work when called via npm run command', async () => {
            const email = 'npmtest@example.com';
            const password = 'testpassword123';

            // Clean up any existing user first
            await User.destroy({ where: { email } });

            try {
                // This simulates running: npm run user:create npmtest@example.com testpassword123
                const output = execSync(
                    `npm run user:create ${email} ${password}`,
                    {
                        cwd: path.join(__dirname, '../..'),
                        env: { ...process.env, NODE_ENV: 'test' },
                        encoding: 'utf8',
                        timeout: 10000,
                    }
                );

                expect(output).toContain('User created successfully');

                // Verify user was created
                const createdUser = await User.findOne({ where: { email } });
                expect(createdUser).toBeTruthy();
                expect(createdUser.email).toBe(email);
            } finally {
                // Clean up
                await User.destroy({ where: { email } });
            }
        });
    });

    describe('Database Validation', () => {
        it('should hash password properly', async () => {
            const email = 'hashtest@example.com';
            const password = 'plaintextpassword';

            const result = await runUserCreateScript([email, password]);

            expect(result.code).toBe(0);

            const createdUser = await User.findOne({ where: { email } });
            expect(createdUser).toBeTruthy();

            // Password should be hashed (bcrypt hashes start with $2b$)
            expect(createdUser.password_digest).toMatch(/^\$2b\$10\$/);
            expect(createdUser.password_digest).not.toBe(password);
            expect(createdUser.password_digest.length).toBeGreaterThan(50);

            // Verify the hash is valid
            const bcrypt = require('bcrypt');
            const isValid = await bcrypt.compare(
                password,
                createdUser.password_digest
            );
            expect(isValid).toBe(true);

            // Clean up
            await User.destroy({ where: { email } });
        });

        it('should set correct default values', async () => {
            const email = 'defaultstest@example.com';
            const password = 'password123';

            const result = await runUserCreateScript([email, password]);

            expect(result.code).toBe(0);

            const createdUser = await User.findOne({ where: { email } });
            expect(createdUser).toBeTruthy();

            // Check that created_at and updated_at are set
            expect(createdUser.created_at).toBeTruthy();
            expect(createdUser.updated_at).toBeTruthy();

            // Check that it's a valid date
            expect(createdUser.created_at instanceof Date).toBe(true);
            expect(createdUser.updated_at instanceof Date).toBe(true);

            // Clean up
            await User.destroy({ where: { email } });
        });
    });

    describe('Edge Cases', () => {
        it('should handle special characters in password', async () => {
            const email = 'specialchars@example.com';
            const password = 'p@ssw0rd!@#$%^&*()_+-=[]{}|;:,.<>?';

            const result = await runUserCreateScript([email, password]);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('✅ User created successfully');

            // Verify user was created and password works
            const createdUser = await User.findOne({ where: { email } });
            expect(createdUser).toBeTruthy();

            const bcrypt = require('bcrypt');
            const isValid = await bcrypt.compare(
                password,
                createdUser.password_digest
            );
            expect(isValid).toBe(true);

            // Clean up
            await User.destroy({ where: { email } });
        });

        it('should handle very long email', async () => {
            const longEmail = 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com';
            const password = 'password123';

            const result = await runUserCreateScript([longEmail, password]);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('✅ User created successfully');

            // Clean up
            await User.destroy({ where: { email: longEmail } });
        });

        it('should handle very long password', async () => {
            const email = 'longpassword@example.com';
            const password = 'a'.repeat(200); // Very long password

            const result = await runUserCreateScript([email, password]);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('✅ User created successfully');

            // Clean up
            await User.destroy({ where: { email } });
        });
    });
});
