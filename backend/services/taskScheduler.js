const cron = require('node-cron');
const { User } = require('../models');
const TaskSummaryService = require('./taskSummaryService');
const { setConfig, getConfig } = require('../config/config');
const config = getConfig();

// Create scheduler state
const createSchedulerState = () => ({
    jobs: new Map(),
    isInitialized: false,
});

// Global mutable state (will be managed functionally)
let schedulerState = createSchedulerState();

// Check if scheduler should be disabled
const shouldDisableScheduler = () =>
    config.environment === 'test' || config.disableScheduler;

// Create job configuration
const createJobConfig = () => ({
    scheduled: false,
    timezone: 'UTC',
});

// Create cron expressions
const getCronExpression = (frequency) => {
    const expressions = {
        daily: '0 7 * * *',
        weekdays: '0 7 * * 1-5',
        weekly: '0 7 * * 1',
        '1h': '0 * * * *',
        '2h': '0 */2 * * *',
        '4h': '0 */4 * * *',
        '8h': '0 */8 * * *',
        '12h': '0 */12 * * *',
        recurring_tasks: '0 6 * * *', // Daily at 6 AM for recurring task generation
        cleanup_tokens: '0 2 * * *', // Daily at 2 AM for cleaning up expired tokens
        deferred_tasks: '*/5 * * * *', // Every 5 minutes to check deferred tasks
        due_tasks: '*/15 * * * *', // Every 15 minutes to check due/overdue tasks
        due_projects: '*/15 * * * *', // Every 15 minutes to check due/overdue projects
    };
    return expressions[frequency];
};

// Create job handler
const createJobHandler = (frequency) => async () => {
    if (frequency === 'recurring_tasks') {
        await processRecurringTasks();
    } else if (frequency === 'cleanup_tokens') {
        await cleanupExpiredTokens();
    } else if (frequency === 'deferred_tasks') {
        await processDeferredTasks();
    } else if (frequency === 'due_tasks') {
        await processDueTasks();
    } else if (frequency === 'due_projects') {
        await processDueProjects();
    } else {
        await processSummariesForFrequency(frequency);
    }
};

// Create job entries
const createJobEntries = () => {
    const frequencies = [
        'daily',
        'weekdays',
        'weekly',
        '1h',
        '2h',
        '4h',
        '8h',
        '12h',
        'recurring_tasks',
        'cleanup_tokens',
        'deferred_tasks',
        'due_tasks',
        'due_projects',
    ];

    return frequencies.map((frequency) => {
        const cronExpression = getCronExpression(frequency);
        const jobHandler = createJobHandler(frequency);
        const jobConfig = createJobConfig();
        const job = cron.schedule(cronExpression, jobHandler, jobConfig);

        return [frequency, job];
    });
};

// Start all jobs
const startJobs = (jobs) => {
    jobs.forEach((job, frequency) => {
        job.start();
    });
};

// Stop all jobs
const stopJobs = (jobs) => {
    jobs.forEach((job, frequency) => {
        job.stop();
    });
};

// Side effect function to fetch users for frequency
const fetchUsersForFrequency = async (frequency) => {
    return await User.findAll({
        where: {
            telegram_bot_token: { [require('sequelize').Op.ne]: null },
            telegram_chat_id: { [require('sequelize').Op.ne]: null },
            task_summary_enabled: true,
            task_summary_frequency: frequency,
        },
    });
};

// Side effect function to send summary to user
const sendSummaryToUser = async (userId, frequency) => {
    try {
        const success = await TaskSummaryService.sendSummaryToUser(userId);
        return success;
    } catch (error) {
        return false;
    }
};

// Function to process summaries for frequency (contains side effects)
const processSummariesForFrequency = async (frequency) => {
    try {
        const users = await fetchUsersForFrequency(frequency);

        const results = await Promise.allSettled(
            users.map((user) => sendSummaryToUser(user.id, frequency))
        );

        return results;
    } catch (error) {
        throw error;
    }
};

// Function to process recurring tasks (contains side effects)
const processRecurringTasks = async () => {
    try {
        const { generateRecurringTasks } = require('./recurringTaskService');
        const newTasks = await generateRecurringTasks();
        return newTasks;
    } catch (error) {
        throw error;
    }
};

// Function to cleanup expired verification tokens (contains side effects)
const cleanupExpiredTokens = async () => {
    try {
        const {
            cleanupExpiredTokens: cleanup,
        } = require('./registrationService');
        const count = await cleanup();
        return count;
    } catch (error) {
        throw error;
    }
};

// Function to process deferred tasks (contains side effects)
const processDeferredTasks = async () => {
    try {
        const { checkDeferredTasks } = require('./deferredTaskService');
        const result = await checkDeferredTasks();
        return result;
    } catch (error) {
        throw error;
    }
};

// Function to process due tasks (contains side effects)
const processDueTasks = async () => {
    try {
        const { checkDueTasks } = require('./dueTaskService');
        const result = await checkDueTasks();
        return result;
    } catch (error) {
        throw error;
    }
};

// Function to process due projects (contains side effects)
const processDueProjects = async () => {
    try {
        const { checkDueProjects } = require('./dueProjectService');
        const result = await checkDueProjects();
        return result;
    } catch (error) {
        throw error;
    }
};

// Function to initialize scheduler (contains side effects)
const initialize = async () => {
    if (schedulerState.isInitialized) {
        return schedulerState;
    }

    if (shouldDisableScheduler()) {
        return schedulerState;
    }

    // Create job entries
    const jobEntries = createJobEntries();
    const jobs = new Map(jobEntries);

    // Start all jobs
    startJobs(jobs);

    // Update state immutably
    schedulerState = {
        jobs,
        isInitialized: true,
    };

    return schedulerState;
};

// Function to stop scheduler (contains side effects)
const stop = async () => {
    if (!schedulerState.isInitialized) {
        return schedulerState;
    }

    // Stop all jobs
    stopJobs(schedulerState.jobs);

    // Reset state immutably
    schedulerState = createSchedulerState();

    return schedulerState;
};

// Function to restart scheduler
const restart = async () => {
    await stop();
    return await initialize();
};

// Get scheduler status
const getStatus = () => ({
    initialized: schedulerState.isInitialized,
    jobCount: schedulerState.jobs.size,
    jobs: Array.from(schedulerState.jobs.keys()),
});

// Export functional interface
module.exports = {
    initialize,
    stop,
    restart,
    getStatus,
    processSummariesForFrequency,
    processRecurringTasks,
    cleanupExpiredTokens,
    processDeferredTasks,
    processDueTasks,
    processDueProjects,
    // For testing
    _createSchedulerState: createSchedulerState,
    _shouldDisableScheduler: shouldDisableScheduler,
    _getCronExpression: getCronExpression,
};
