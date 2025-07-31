#!/usr/bin/env node

/**
 * User Creation Script
 * Creates a new user with email and password.
 * If user exists, updated password.
 * Usage: node user-create.js <email> <password>
 */

require('dotenv').config();
const {
    createOrUpdateUser,
    validateEmail,
    validatePassword,
} = require('../services/userService');

async function createUser() {
    const [email, password] = process.argv.slice(2);

    if (!email || password === undefined) {
        console.error('Usage: npm run user:create <email> <password>');
        console.error(
            'Example: npm run user:create admin@example.com mypassword123'
        );
        process.exit(1);
    }

    // Validate password
    if (!validatePassword(password)) {
        console.error('Password must be at least 6 characters long');
        process.exit(1);
    }

    // Validate email
    if (!validateEmail(email)) {
        console.error('Invalid email format');
        process.exit(1);
    }

    try {
        console.log(`Creating user with email: ${email}`);

        const { user, created } = await createOrUpdateUser(email, password);

        if (!created) {
            console.log('User exists, password updated');
        } else {
            console.log('User created successfully');
        }

        console.log(`Email: ${user.email}`);
        console.log(`User ID: ${user.id}`);
        console.log(`Created: ${user.created_at}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating user:', error.message);
        process.exit(1);
    }
}

createUser();
