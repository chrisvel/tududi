const { checkDueTasks } = require('../services/dueTaskService');
const { checkDeferredTasks } = require('../services/deferredTaskService');
const { checkDueProjects } = require('../services/dueProjectService');

/**
 * Run all notification services
 * Run with: NODE_ENV=development node backend/scripts/run-notification-services.js
 */

async function runAllNotificationServices() {
    console.log('🔔 Running all notification services...\n');

    try {
        // Run due tasks service
        console.log('📋 Checking due tasks...');
        const dueTasksResult = await checkDueTasks();
        console.log('   Result:', JSON.stringify(dueTasksResult, null, 2));

        // Run deferred tasks service
        console.log('\n⏰ Checking deferred tasks...');
        const deferredTasksResult = await checkDeferredTasks();
        console.log('   Result:', JSON.stringify(deferredTasksResult, null, 2));

        // Run due projects service
        console.log('\n📁 Checking due projects...');
        const dueProjectsResult = await checkDueProjects();
        console.log('   Result:', JSON.stringify(dueProjectsResult, null, 2));

        console.log('\n✅ All notification services completed!');
        console.log('\n📊 Summary:');
        console.log(
            `   • Due tasks: ${dueTasksResult.notificationsCreated} notifications created`
        );
        console.log(
            `   • Deferred tasks: ${deferredTasksResult.notificationsCreated} notifications created`
        );
        console.log(
            `   • Due projects: ${dueProjectsResult.notificationsCreated} notifications created`
        );
        console.log(
            `   • Total: ${dueTasksResult.notificationsCreated + deferredTasksResult.notificationsCreated + dueProjectsResult.notificationsCreated} notifications created\n`
        );

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error running notification services:', error);
        process.exit(1);
    }
}

// Run the services
if (require.main === module) {
    runAllNotificationServices();
}

module.exports = { runAllNotificationServices };
