#!/usr/bin/env node

/**
 * Cleanup script for failed migration 20260420000004-make-password-optional
 *
 * This script removes the leftover users_new table if it exists,
 * allowing the migration to run again cleanly.
 *
 * Usage:
 *   node backend/scripts/cleanup-failed-migration.js
 */

const { sequelize } = require('../models');

async function cleanup() {
    console.log('🔍 Checking for leftover migration tables...');

    try {
        const [results] = await sequelize.query(`
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='users_new'
        `);

        if (results.length > 0) {
            console.log(
                '⚠️  Found leftover users_new table from failed migration'
            );
            console.log('🧹 Dropping users_new table...');

            await sequelize.query('DROP TABLE users_new');

            console.log('✅ Cleanup completed successfully');
            console.log(
                '💡 You can now run migrations again: npm run db:migrate'
            );
        } else {
            console.log('✅ No cleanup needed - no leftover tables found');
        }

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
        await sequelize.close();
        process.exit(1);
    }
}

cleanup();
