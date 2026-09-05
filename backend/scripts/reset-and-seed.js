#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { getConfig } = require('../config/config');
const { sequelize } = require('../models');

/**
 * Reset database and seed with comprehensive test data
 * Run with: NODE_ENV=development node backend/scripts/reset-and-seed.js
 */

const config = getConfig();

console.log('🔄 Starting database reset and seed...\n');
console.log(
    `📁 Database: ${
        config.db.dialect === 'sqlite'
            ? config.dbFile
            : `${config.db.dialect} ${config.db.database}@${config.db.host}`
    }`
);
console.log(`🌍 Environment: ${config.environment}\n`);

if (config.environment === 'production') {
    console.error(
        '❌ ERROR: Cannot run this script in production environment!'
    );
    process.exit(1);
}

async function main() {
    try {
        // Step 1: Delete existing database
        console.log('1️⃣  Removing existing database...');
        if (config.db.dialect === 'sqlite') {
            if (fs.existsSync(config.dbFile)) {
                fs.unlinkSync(config.dbFile);
                console.log('   ✅ Database removed\n');
            } else {
                console.log('   ℹ️  No existing database found\n');
            }
        } else {
            await sequelize.drop({ cascade: true });
            console.log('   ✅ All tables dropped\n');
        }

        // Step 2: Reset database using sequelize.sync
        console.log('2️⃣  Creating fresh database...');
        await sequelize.sync({ force: true });
        console.log('   ✅ Database created\n');

        // Step 3: Seed basic development data
        console.log('3️⃣  Seeding basic development data...');
        const { seedDatabase } = require('../seeders/dev-seeder');
        await seedDatabase();
        console.log('   ✅ Basic data seeded\n');

        // Step 4: Generate notifications
        console.log('4️⃣  Generating notifications...');

        const { checkDueTasks } = require('../modules/tasks/dueTaskService');
        const {
            checkDeferredTasks,
        } = require('../modules/tasks/deferredTaskService');
        const {
            checkDueProjects,
        } = require('../modules/projects/dueProjectService');

        const dueTasksResult = await checkDueTasks();
        const deferredTasksResult = await checkDeferredTasks();
        const dueProjectsResult = await checkDueProjects();

        const total =
            dueTasksResult.notificationsCreated +
            deferredTasksResult.notificationsCreated +
            dueProjectsResult.notificationsCreated;

        console.log(`   ✅ Generated ${total} notifications\n`);

        // Final summary
        console.log('✅ Database reset and seed completed successfully!\n');
        console.log('📊 Summary:');
        console.log('   • Database: Fresh and ready');
        console.log('   • Users: Test users created');
        console.log('   • Tasks: Sample tasks with various due dates');
        console.log('   • Projects: Sample projects with various due dates');
        console.log(`   • Notifications: ${total} notifications generated`);
        console.log('\n🚀 You can now start the application with:');
        console.log('   npm start\n');

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        await sequelize.close();
        process.exit(1);
    }
}

// Run the main function
main();
