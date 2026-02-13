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

        // SQLite requires disabling foreign keys for ALTER TABLE operations
        // (Sequelize uses backup-drop-recreate approach which fails with FK constraints)
        const isSqlite = sequelize.getDialect() === 'sqlite';
        if (isSqlite) {
            await sequelize.query('PRAGMA foreign_keys = OFF;');
        }

        await sequelize.sync({ alter: true });

        if (isSqlite) {
            await sequelize.query('PRAGMA foreign_keys = ON;');
        }

        console.log('✅ Database migrated successfully');
        console.log('All tables have been updated to match current models');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error migrating database:', error.message);
        process.exit(1);
    }
}

migrateDatabase();
