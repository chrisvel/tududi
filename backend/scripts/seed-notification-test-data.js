const { User, Task, Project } = require('../models');

/**
 * Seed script to create test tasks and projects for notification testing
 * Run with: NODE_ENV=development node backend/scripts/seed-notification-test-data.js
 */

async function seedNotificationTestData() {
    try {
        console.log('🌱 Starting to seed notification test data...');

        // Get the first user (or create one if none exists)
        let user = await User.findOne();

        if (!user) {
            console.log('📝 No users found, creating test user...');
            const bcrypt = require('bcrypt');
            const passwordHash = await bcrypt.hash('password123', 10);

            user = await User.create({
                email: 'test@tududi.com',
                password_digest: passwordHash,
                name: 'Test',
                surname: 'User',
                appearance: 'light',
                language: 'en',
                timezone: 'UTC',
            });
            console.log(`✅ Created test user: ${user.email}`);
        } else {
            console.log(
                `👤 Using existing user: ${user.email} (ID: ${user.id})`
            );
        }

        const now = new Date();

        // Helper to create date offsets
        const hoursAgo = (hours) =>
            new Date(now.getTime() - hours * 60 * 60 * 1000);
        const hoursFromNow = (hours) =>
            new Date(now.getTime() + hours * 60 * 60 * 1000);
        const daysAgo = (days) =>
            new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const daysFromNow = (days) =>
            new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

        console.log('\n📋 Creating test tasks...');

        const tasks = [
            // Overdue tasks
            {
                name: '🚨 Very overdue task',
                user_id: user.id,
                status: 0,
                due_date: daysAgo(5),
                description: 'This task is 5 days overdue',
            },
            {
                name: '⚠️ Overdue yesterday',
                user_id: user.id,
                status: 0,
                due_date: daysAgo(1),
                description: 'This task was due yesterday',
            },
            {
                name: '🔴 Overdue today',
                user_id: user.id,
                status: 0,
                due_date: hoursAgo(6),
                description: 'This task was due 6 hours ago',
            },

            // Due soon tasks
            {
                name: '🟡 Due in 2 hours',
                user_id: user.id,
                status: 0,
                due_date: hoursFromNow(2),
                description: 'This task is due soon',
            },
            {
                name: '🟢 Due in 12 hours',
                user_id: user.id,
                status: 0,
                due_date: hoursFromNow(12),
                description: 'This task is due within 24 hours',
            },
            {
                name: '📅 Due tomorrow',
                user_id: user.id,
                status: 0,
                due_date: daysFromNow(1),
                description: 'This task is due tomorrow',
            },

            // Deferred tasks
            {
                name: '⏰ Defer until now (should be active)',
                user_id: user.id,
                status: 0,
                defer_until: hoursAgo(1),
                description: 'This task was deferred but is now available',
            },
            {
                name: '⏳ Defer until in 2 hours',
                user_id: user.id,
                status: 0,
                defer_until: hoursFromNow(2),
                description: 'This task will be available in 2 hours',
            },
            {
                name: '📆 Defer until tomorrow',
                user_id: user.id,
                status: 0,
                defer_until: daysFromNow(1),
                description: 'This task will be available tomorrow',
            },

            // Tasks with no due date (should not trigger notifications)
            {
                name: '✨ No due date',
                user_id: user.id,
                status: 0,
                description: 'This task has no due date',
            },

            // Completed task (should not trigger notifications)
            {
                name: '✅ Completed overdue task',
                user_id: user.id,
                status: 2,
                due_date: daysAgo(3),
                description: 'This task is completed so no notification',
                completed_at: new Date(),
            },
        ];

        for (const taskData of tasks) {
            const task = await Task.create(taskData);
            console.log(`  ✓ Created: ${task.name}`);
        }

        console.log('\n📁 Creating test projects...');

        const projects = [
            // Overdue projects
            {
                name: '🚨 Very overdue project',
                user_id: user.id,
                state: 'active',
                due_date_at: daysAgo(7),
                description: 'This project is 7 days overdue',
            },
            {
                name: '⚠️ Project overdue yesterday',
                user_id: user.id,
                state: 'active',
                due_date_at: daysAgo(1),
                description: 'This project was due yesterday',
            },

            // Due soon projects
            {
                name: '🟡 Project due in 6 hours',
                user_id: user.id,
                state: 'active',
                due_date_at: hoursFromNow(6),
                description: 'This project is due soon',
            },
            {
                name: '📅 Project due tomorrow',
                user_id: user.id,
                state: 'active',
                due_date_at: daysFromNow(1),
                description: 'This project is due within 24 hours',
            },

            // Projects with no due date
            {
                name: '✨ Project with no due date',
                user_id: user.id,
                state: 'active',
                description: 'This project has no due date',
            },

            // Completed project (should not trigger notifications)
            {
                name: '✅ Completed overdue project',
                user_id: user.id,
                state: 'completed',
                due_date_at: daysAgo(5),
                description: 'This project is completed so no notification',
            },
        ];

        for (const projectData of projects) {
            const project = await Project.create(projectData);
            console.log(`  ✓ Created: ${project.name}`);
        }

        console.log('\n✅ Seeding complete!');
        console.log('\n📊 Summary:');
        console.log(`  • Created ${tasks.length} tasks`);
        console.log(`  • Created ${projects.length} projects`);
        console.log(`  • For user: ${user.email}\n`);

        console.log(
            '🔔 To generate notifications, run the notification services:'
        );
        console.log(
            '  • Due tasks: NODE_ENV=development node -e "require(\'./services/dueTaskService\').checkDueTasks().then(console.log)"'
        );
        console.log(
            '  • Deferred tasks: NODE_ENV=development node -e "require(\'./services/deferredTaskService\').checkDeferredTasks().then(console.log)"'
        );
        console.log(
            '  • Due projects: NODE_ENV=development node -e "require(\'./services/dueProjectService\').checkDueProjects().then(console.log)"'
        );
        console.log('');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding data:', error);
        process.exit(1);
    }
}

// Run the seeder
if (require.main === module) {
    seedNotificationTestData();
}

module.exports = { seedNotificationTestData };
