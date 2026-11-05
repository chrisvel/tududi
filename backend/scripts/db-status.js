#!/usr/bin/env node

/**
 * Database Status Script
 * Shows database connection status and basic information
 */

try {
    require('dotenv').config();
} catch (_) {}
const {
    sequelize,
    User,
    Task,
    Project,
    Area,
    Note,
    Tag,
    InboxItem,
} = require('../models');

async function checkDatabaseStatus() {
    try {
        console.log('🔍 Checking database status...\n');

        const { host, port, database } = sequelize.config;

        console.log('📂 Database Configuration:');
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   Host: ${host}:${port}`);
        console.log(`   Database: ${database}`);

        console.log('\n🔌 Testing database connection...');
        await sequelize.authenticate();
        console.log('✅ Database connection successful\n');

        // Get table information
        console.log('📊 Table Statistics:');
        const models = [
            { name: 'Users', model: User },
            { name: 'Areas', model: Area },
            { name: 'Projects', model: Project },
            { name: 'Tasks', model: Task },
            { name: 'Notes', model: Note },
            { name: 'Tags', model: Tag },
            { name: 'Inbox Items', model: InboxItem },
        ];

        for (const { name, model } of models) {
            try {
                const count = await model.count();
                console.log(`   ${name}: ${count} records`);
            } catch (error) {
                console.log(`   ${name}: ❌ Error (${error.message})`);
            }
        }

        console.log('\n✅ Database status check completed');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Database connection failed:', error.message);
        console.error('\n💡 Try running: npm run db:init');
        process.exit(1);
    }
}

checkDatabaseStatus();
