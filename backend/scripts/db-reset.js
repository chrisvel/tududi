#!/usr/bin/env node

/**
 * Database Reset Script
 * Resets the database by dropping it
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/config');

async function resetDatabase() {
    try {
        console.log('Resetting database...');
        console.log('WARNING: This will permanently delete all data!');

        await mongoose.connect(config.mongodb_uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        await mongoose.connection.dropDatabase();

        console.log('✅ Database reset successfully');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting database:', error.message);
        process.exit(1);
    }
}

resetDatabase();
