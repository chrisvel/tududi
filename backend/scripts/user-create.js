#!/usr/bin/env node

/**
 * User Creation Script
 * Creates a new user with email and password
 * Usage: node user-create.js <email> <password>
 */

require('dotenv').config();
const { User } = require('../models');
const bcrypt = require('bcrypt');

async function createUser() {
    const [email, password] = process.argv.slice(2);

    if (!email || password === undefined) {
        console.error('❌ Usage: npm run user:create <email> <password>');
        console.error(
            'Example: npm run user:create admin@example.com mypassword123'
        );
        process.exit(1);
    }

    // Basic password validation (check for empty or short passwords)
    if (!password || password.length < 6) {
        console.error('❌ Password must be at least 6 characters long');
        process.exit(1);
    }

    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    // Check for common invalid patterns
    if (
        !email.includes('@') ||
        !email.includes('.') ||
        email.includes('@@') ||
        email.includes(' ') ||
        email.startsWith('@') ||
        email.endsWith('@') ||
        email.endsWith('.') ||
        email.includes('@.') ||
        email.includes('.@') ||
        !emailRegex.test(email)
    ) {
        console.error('❌ Invalid email format');
        process.exit(1);
    }

    try {
        console.log(`Creating user with email: ${email}`);

        // Check if user already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            console.error(`❌ User with email ${email} already exists`);
            process.exit(1);
        }

        // Hash the password manually since the hook might not be working in this context
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user
        const user = await User.create({
            email,
            password_digest: hashedPassword,
        });

        console.log('✅ User created successfully');
        console.log(`📧 Email: ${user.email}`);
        console.log(`🆔 User ID: ${user.id}`);
        console.log(`📅 Created: ${user.created_at}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating user:', error.message);
        process.exit(1);
    }
}

createUser();
