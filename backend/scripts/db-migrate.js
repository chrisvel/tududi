#!/usr/bin/env node

/**
 * Database Migration Script
 * Migrates the database by altering existing tables to match current models
 */

require('dotenv').config();
const { sequelize } = require('../models');

async function migrateDatabase() {
    try {
        console.log('Migrating database...');
        console.log('This will alter existing tables to match current models');

        await sequelize.sync({ alter: true });

        console.log('✅ Database migrated successfully');
        console.log('All tables have been updated to match current models');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error migrating database:', error.message);
        process.exit(1);
    }
}

migrateDatabase();
