const cron = require('node-cron');
const { User } = require('../../models');
const TaskSummaryService = require('./taskSummaryService');
const { setConfig, getConfig } = require('../../config/config');
const config = getConfig();

const createSchedulerState = () => ({
    jobs: new Map(),
    isInitialized: false,
});

let schedulerState = createSchedulerState();

const shouldDisableScheduler = () =>
    config.environment === 'test' || config.disableScheduler;

const createJobConfig = () => ({
    scheduled: false,
    timezone: 'UTC',
});

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
        cleanup_tokens: '0 2 * * *',
        deferred_tasks: '*/5 * * * *',
        due_tasks: '*/15 * * * *',
        due_projects: '*/15 * * * *',
    };
    return expressions[frequency];
};

const runJob = async (frequency) => {
    if (frequency === 'cleanup_tokens') {
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

// Each tick takes a per-job lock so that with several app processes only
// one of them sends the summaries or notifications for that tick.
const createJobHandler = (frequency) => async () => {
    const { withJobLock } = require('../../services/jobLock');
    await withJobLock(`task-scheduler:${frequency}`, () => runJob(frequency));
};

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

const startJobs = (jobs) => {
    jobs.forEach((job, frequency) => {
        job.start();
    });
};

const stopJobs = (jobs) => {
    jobs.forEach((job, frequency) => {
        job.stop();
    });
};

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

const sendSummaryToUser = async (userId, frequency) => {
    try {
        const success = await TaskSummaryService.sendSummaryToUser(userId);
        return success;
    } catch (error) {
        return false;
    }
};

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

const cleanupExpiredTokens = async () => {
    const {
        cleanupExpiredTokens: cleanup,
    } = require('../auth/registrationService');
    const count = await cleanup();

    const {
        cleanupExpiredRateLimits,
    } = require('../../middleware/rateLimitStore');
    await cleanupExpiredRateLimits();

    return count;
};

const processDeferredTasks = async () => {
    try {
        const { checkDeferredTasks } = require('./deferredTaskService');
        const result = await checkDeferredTasks();
        return result;
    } catch (error) {
        throw error;
    }
};

const processDueTasks = async () => {
    try {
        const { checkDueTasks } = require('./dueTaskService');
        const result = await checkDueTasks();
        return result;
    } catch (error) {
        throw error;
    }
};

const processDueProjects = async () => {
    try {
        const { checkDueProjects } = require('../projects/dueProjectService');
        const result = await checkDueProjects();
        return result;
    } catch (error) {
        throw error;
    }
};

const initialize = async () => {
    if (schedulerState.isInitialized) {
        return schedulerState;
    }

    if (shouldDisableScheduler()) {
        return schedulerState;
    }

    const jobEntries = createJobEntries();
    const jobs = new Map(jobEntries);

    startJobs(jobs);

    schedulerState = {
        jobs,
        isInitialized: true,
    };

    return schedulerState;
};

const stop = async () => {
    if (!schedulerState.isInitialized) {
        return schedulerState;
    }

    stopJobs(schedulerState.jobs);

    schedulerState = createSchedulerState();

    return schedulerState;
};

const restart = async () => {
    await stop();
    return await initialize();
};

const getStatus = () => ({
    initialized: schedulerState.isInitialized,
    jobCount: schedulerState.jobs.size,
    jobs: Array.from(schedulerState.jobs.keys()),
});

module.exports = {
    initialize,
    stop,
    restart,
    getStatus,
    processSummariesForFrequency,
    cleanupExpiredTokens,
    processDeferredTasks,
    processDueTasks,
    processDueProjects,
    _createSchedulerState: createSchedulerState,
    _shouldDisableScheduler: shouldDisableScheduler,
    _getCronExpression: getCronExpression,
};
