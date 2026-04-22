#!/usr/bin/env node

require('dotenv').config();
const { sequelize } = require('../models');

async function diagnosePasswordMigration() {
    console.log('='.repeat(70));
    console.log('Password Migration Diagnostic Tool');
    console.log('='.repeat(70));
    console.log('');

    try {
        const [results] = await sequelize.query(`
            PRAGMA table_info(users);
        `);

        console.log('Database Schema Analysis:');
        console.log('-'.repeat(70));

        const passwordColumnExists = results.some(
            (col) => col.name === 'password'
        );
        const passwordDigestColumnExists = results.some(
            (col) => col.name === 'password_digest'
        );

        console.log(`✓ Column 'password' exists: ${passwordColumnExists}`);
        console.log(
            `✓ Column 'password_digest' exists: ${passwordDigestColumnExists}`
        );
        console.log('');

        const [users] = await sequelize.query(`
            SELECT
                COUNT(*) as total_users,
                SUM(CASE WHEN password_digest IS NOT NULL THEN 1 ELSE 0 END) as count_with_digest,
                SUM(CASE WHEN password_digest IS NULL THEN 1 ELSE 0 END) as count_without_digest
            FROM users;
        `);

        const stats = users[0];
        console.log('User Password Statistics:');
        console.log('-'.repeat(70));
        console.log(`Total users: ${stats.total_users}`);
        console.log(`Users with password_digest: ${stats.count_with_digest}`);
        console.log(
            `Users without password_digest: ${stats.count_without_digest}`
        );
        console.log('');

        if (stats.count_without_digest > 0) {
            const [affectedUsers] = await sequelize.query(`
                SELECT id, email, password_digest
                FROM users
                WHERE password_digest IS NULL;
            `);

            console.log('⚠️  Users Affected (NULL password_digest):');
            console.log('-'.repeat(70));
            affectedUsers.forEach((user) => {
                console.log(`  - ${user.email} (ID: ${user.id})`);
            });
            console.log('');

            console.log('🔧 Recommended Actions:');
            console.log('-'.repeat(70));
            console.log('1. Backup your database before proceeding:');
            console.log('   cp database.sqlite database.sqlite.backup');
            console.log('');
            console.log('2. Re-run the migration:');
            console.log('   npm run db:migrate');
            console.log('');
            console.log('3. If the issue persists, check the migration file:');
            console.log(
                '   backend/migrations/20260420000004-make-password-optional.js'
            );
            console.log(
                '   Line 67 should use: COALESCE(password_digest, password) as password_digest'
            );
            console.log('');
        } else {
            console.log('✅ All users have password_digest values set.');
            console.log('No password migration issues detected.');
            console.log('');
        }

        console.log('Database Connection: OK');
        console.log('Diagnostic Complete');
        console.log('='.repeat(70));
    } catch (error) {
        console.error('Error running diagnostic:', error.message);
        console.error('');
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

if (require.main === module) {
    diagnosePasswordMigration();
}

module.exports = diagnosePasswordMigration;
