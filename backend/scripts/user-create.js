#!/usr/bin/env node

/**
 * User Creation Script
 * Creates a new user with email and password
 * Usage: node user-create.js <email> <password>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');
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
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/tududi');
        console.log('MongoDB Connected for user creation');

        console.log(`Creating user with email: ${email}`);

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.error(`❌ User with email ${email} already exists`);
            process.exit(1);
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user
        const user = await User.create({
            email,
            password_digest: hashedPassword,
        });

        console.log('✅ User created successfully');
        console.log(`📧 Email: ${user.email}`);
        console.log(`🆔 User ID: ${user._id}`); // Use _id for MongoDB
        console.log(`📅 Created: ${user.created_at}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating user:', error.message);
        process.exit(1);
    }
}

createUser();