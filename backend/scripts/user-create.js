#!/usr/bin/env node

/**
 * User Creation Script
 * Creates a new user with email and password.
 * If user exists, updated password.
 * Usage: node user-create.js <email> <password> [is_admin]
 */

require('dotenv').config();
const {
    createOrUpdateUser,
    validateEmail,
    validatePassword,
} = require('../services/userService');
const { Role } = require('../models');

async function createUser() {
    const [email, password, isAdminArg] = process.argv.slice(2);

    if (!email || password === undefined) {
        console.error(
            'Usage: npm run user:create <email> <password> [is_admin]'
        );
        console.error(
            'Example: npm run user:create admin@example.com mypassword123 true'
        );
        process.exit(1);
    }

    // Validate email
    if (!validateEmail(email)) {
        console.error('Invalid email format');
        process.exit(1);
    }

    try {
        const { User } = require('../models');

        // Check if user exists to determine if we should validate password
        const existingUser = await User.findOne({ where: { email } });

        // Only validate password for new users
        if (!existingUser && !validatePassword(password)) {
            console.error('Password must be at least 6 characters long');
            process.exit(1);
        }

        console.log(`Creating user with email: ${email}`);

        const { user, created } = await createOrUpdateUser(email, password);

        // Optionally grant admin role
        const shouldBeAdmin = String(isAdminArg).toLowerCase() === 'true';
        if (shouldBeAdmin) {
            // Find or create role, and ensure is_admin is true
            const [role, roleCreated] = await Role.findOrCreate({
                where: { user_id: user.id },
                defaults: { user_id: user.id, is_admin: true },
            });

            // Update to admin if role exists but is not admin
            if (!roleCreated && !role.is_admin) {
                role.is_admin = true;
                await role.save();
            }
        }

        if (!created) {
            console.log('User exists, password updated');
        } else {
            console.log('User created successfully');
        }

        console.log(`Email: ${user.email}`);
        console.log(`User ID: ${user.id}`);
        console.log(`Created: ${user.created_at}`);
        if (isAdminArg !== undefined) {
            console.log(`Admin: ${shouldBeAdmin ? 'yes' : 'no'}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating user:', error.message);
        process.exit(1);
    }
}

createUser();
