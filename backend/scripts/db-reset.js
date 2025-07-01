#!/usr/bin/env node

/**
 * Database Reset Script
 * Resets the database by dropping and recreating all tables
 */

require('dotenv').config();
const { sequelize } = require('../models');

async function resetDatabase() {
    try {
        console.log('Resetting database...');
        console.log('WARNING: This will permanently delete all data!');

        await sequelize.sync({ force: true });

        console.log('✅ Database reset successfully');
        console.log('All tables have been dropped and recreated');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting database:', error.message);
        process.exit(1);
    }
}

resetDatabase();
