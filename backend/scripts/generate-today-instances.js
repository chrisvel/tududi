const {
    generateRecurringTasksWithLock,
} = require('../services/recurringTaskService');
const { User } = require('../models');

async function generateTasks() {
    // Get first user
    const user = await User.findOne();

    if (!user) {
        console.log('No users found');
        process.exit(1);
    }

    console.log(
        `Generating recurring tasks for user ${user.id} (${user.email})`
    );

    const tasks = await generateRecurringTasksWithLock(user.id, 1);

    console.log(`Generated ${tasks.length} task instances`);

    if (tasks.length > 0) {
        console.log('\nGenerated tasks:');
        tasks.forEach((t) => {
            console.log(
                `- ${t.name} (due: ${t.due_date ? t.due_date.toISOString().split('T')[0] : 'none'})`
            );
        });
    }

    process.exit(0);
}

generateTasks().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});
