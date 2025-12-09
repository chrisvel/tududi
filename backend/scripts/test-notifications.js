#!/usr/bin/env node

/**
 * Script to manually trigger test notifications
 * Usage: node backend/scripts/test-notifications.js [userId] [notificationType]
 *
 * Notification Types:
 *   - task_due_soon
 *   - task_overdue
 *   - project_due_soon
 *   - project_overdue
 *   - defer_until
 *   - all (trigger all types)
 */

const { Notification, User } = require('../models');
const { v4: uuid } = require('uuid');

const NOTIFICATION_TEMPLATES = {
    task_due_soon: {
        title: '📌 Task Due Soon',
        message: 'Your test task "Complete project documentation" is due in 2 hours',
        level: 'warning',
        data: {
            taskUid: uuid(),
            taskName: 'Complete project documentation',
            dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            isOverdue: false,
        },
    },
    task_overdue: {
        title: '⚠️ Task Overdue',
        message: 'Your test task "Review pull request #123" is 3 days overdue',
        level: 'error',
        data: {
            taskUid: uuid(),
            taskName: 'Review pull request #123',
            dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            isOverdue: true,
        },
    },
    project_due_soon: {
        title: '📁 Project Due Soon',
        message: 'Your test project "Q4 Planning" is due in 6 hours',
        level: 'warning',
        data: {
            projectUid: uuid(),
            projectName: 'Q4 Planning',
            dueDate: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
            isOverdue: false,
        },
    },
    project_overdue: {
        title: '⚠️ Project Overdue',
        message: 'Your test project "Website Redesign" is 1 day overdue',
        level: 'error',
        data: {
            projectUid: uuid(),
            projectName: 'Website Redesign',
            dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            isOverdue: true,
        },
    },
    defer_until: {
        title: '🕐 Task Now Active',
        message: 'Your test task "Follow up with client" is now available to work on',
        level: 'info',
        data: {
            taskUid: uuid(),
            taskName: 'Follow up with client',
            deferUntil: new Date().toISOString(),
            reason: 'defer_until_reached',
        },
    },
};

async function getSources(user, notificationType) {
    const sources = [];

    // Check notification preferences
    const prefs = user.notification_preferences;
    if (!prefs) return sources;

    // Map notification type to preference key
    const typeMapping = {
        task_due_soon: 'dueTasks',
        task_overdue: 'overdueTasks',
        project_due_soon: 'dueProjects',
        project_overdue: 'overdueProjects',
        defer_until: 'deferUntil',
    };

    const prefKey = typeMapping[notificationType];
    if (!prefKey || !prefs[prefKey]) return sources;

    // Add telegram to sources if enabled
    if (prefs[prefKey].telegram === true) {
        sources.push('telegram');
    }

    // Add email to sources if enabled
    if (prefs[prefKey].email === true) {
        sources.push('email');
    }

    return sources;
}

async function triggerNotification(userId, notificationType) {
    const user = await User.findByPk(userId, {
        attributes: ['id', 'email', 'notification_preferences', 'telegram_bot_token', 'telegram_chat_id'],
    });

    if (!user) {
        console.error(`❌ User with ID ${userId} not found`);
        return;
    }

    const template = NOTIFICATION_TEMPLATES[notificationType];
    if (!template) {
        console.error(`❌ Unknown notification type: ${notificationType}`);
        console.log('Available types:', Object.keys(NOTIFICATION_TEMPLATES).join(', '));
        return;
    }

    // Get sources based on user preferences
    const sources = await getSources(user, notificationType);

    console.log(`\n📬 Triggering ${notificationType} notification for ${user.email}`);
    console.log(`   Sources: ${sources.length > 0 ? sources.join(', ') : 'none (in-app only)'}`);

    if (sources.includes('telegram') && !user.telegram_bot_token) {
        console.log('   ⚠️  Warning: Telegram enabled but bot not configured');
    }

    try {
        const notification = await Notification.createNotification({
            userId: user.id,
            type: notificationType,
            title: template.title,
            message: template.message,
            level: template.level,
            data: template.data,
            sources: sources,
            sentAt: new Date(),
        });

        console.log(`✅ Notification created (ID: ${notification.id})`);
        console.log(`   Title: ${template.title}`);
        console.log(`   Message: ${template.message}`);

        if (sources.includes('telegram')) {
            console.log('   📱 Telegram message sent!');
        }
    } catch (error) {
        console.error(`❌ Error creating notification:`, error.message);
    }
}

async function triggerAllNotifications(userId) {
    console.log('\n🚀 Triggering all notification types...\n');

    for (const type of Object.keys(NOTIFICATION_TEMPLATES)) {
        await triggerNotification(userId, type);
        // Small delay between notifications
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n✨ All notifications triggered!\n');
}

async function listUsers() {
    const users = await User.findAll({
        attributes: ['id', 'email', 'telegram_bot_token', 'telegram_chat_id'],
    });

    console.log('\n📋 Available users:\n');
    users.forEach(user => {
        const telegramStatus = user.telegram_bot_token && user.telegram_chat_id
            ? '✅'
            : '❌';
        console.log(`   ${user.id}. ${user.email} (Telegram: ${telegramStatus})`);
    });
    console.log('');
}

async function main() {
    const args = process.argv.slice(2);

    // Show help
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
🔔 Test Notifications Script

Usage:
  node backend/scripts/test-notifications.js [userId] [notificationType]
  node backend/scripts/test-notifications.js --list

Options:
  --list, -l        List all users
  --help, -h        Show this help message

Notification Types:
  task_due_soon     Task due within 24 hours
  task_overdue      Task past due date
  project_due_soon  Project due within 24 hours
  project_overdue   Project past due date
  defer_until       Deferred task now active
  all               Trigger all types

Examples:
  node backend/scripts/test-notifications.js --list
  node backend/scripts/test-notifications.js 1 task_due_soon
  node backend/scripts/test-notifications.js 1 all
        `);
        process.exit(0);
    }

    // List users
    if (args.includes('--list') || args.includes('-l')) {
        await listUsers();
        process.exit(0);
    }

    // Parse arguments
    const userId = parseInt(args[0]);
    const notificationType = args[1] || 'all';

    if (!userId) {
        console.log('❌ Error: User ID is required\n');
        console.log('Usage: node backend/scripts/test-notifications.js [userId] [notificationType]');
        console.log('Run with --help for more information');
        console.log('\nTip: Run with --list to see available users');
        process.exit(1);
    }

    // Trigger notifications
    if (notificationType === 'all') {
        await triggerAllNotifications(userId);
    } else {
        await triggerNotification(userId, notificationType);
    }

    process.exit(0);
}

// Run the script
main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});
