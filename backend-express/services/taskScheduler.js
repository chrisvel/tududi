const cron = require('node-cron');
const { User } = require('../models');
const TaskSummaryService = require('./taskSummaryService');

class TaskScheduler {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  static getInstance() {
    if (!TaskScheduler.instance) {
      TaskScheduler.instance = new TaskScheduler();
    }
    return TaskScheduler.instance;
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('Task scheduler already initialized');
      return;
    }

    // Don't schedule in test environment
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_SCHEDULER === 'true') {
      console.log('Task scheduler disabled for test environment');
      return;
    }

    console.log('Initializing task scheduler...');

    // Daily schedule at 7 AM (for users with daily frequency)
    const dailyJob = cron.schedule('0 7 * * *', async () => {
      console.log('Running scheduled task: Daily task summary');
      await this.processSummariesForFrequency('daily');
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Weekdays schedule at 7 AM (Monday through Friday)
    const weekdaysJob = cron.schedule('0 7 * * 1-5', async () => {
      console.log('Running scheduled task: Weekday task summary');
      await this.processSummariesForFrequency('weekdays');
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Weekly schedule at 7 AM on Monday
    const weeklyJob = cron.schedule('0 7 * * 1', async () => {
      console.log('Running scheduled task: Weekly task summary');
      await this.processSummariesForFrequency('weekly');
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Hourly schedules
    const hourlyJob = cron.schedule('0 * * * *', async () => {
      console.log('Running scheduled task: Hourly (1h) task summary');
      await this.processSummariesForFrequency('1h');
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    const twoHourlyJob = cron.schedule('0 */2 * * *', async () => {
      console.log('Running scheduled task: 2-hour task summary');
      await this.processSummariesForFrequency('2h');
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    const fourHourlyJob = cron.schedule('0 */4 * * *', async () => {
      console.log('Running scheduled task: 4-hour task summary');
      await this.processSummariesForFrequency('4h');
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    const eightHourlyJob = cron.schedule('0 */8 * * *', async () => {
      console.log('Running scheduled task: 8-hour task summary');
      await this.processSummariesForFrequency('8h');
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    const twelveHourlyJob = cron.schedule('0 */12 * * *', async () => {
      console.log('Running scheduled task: 12-hour task summary');
      await this.processSummariesForFrequency('12h');
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Store jobs for later management
    this.jobs.set('daily', dailyJob);
    this.jobs.set('weekdays', weekdaysJob);
    this.jobs.set('weekly', weeklyJob);
    this.jobs.set('1h', hourlyJob);
    this.jobs.set('2h', twoHourlyJob);
    this.jobs.set('4h', fourHourlyJob);
    this.jobs.set('8h', eightHourlyJob);
    this.jobs.set('12h', twelveHourlyJob);

    // Start all jobs
    this.jobs.forEach((job, frequency) => {
      job.start();
      console.log(`Started scheduler for frequency: ${frequency}`);
    });

    this.isInitialized = true;
    console.log('Task scheduler initialized successfully');
  }

  async processSummariesForFrequency(frequency) {
    try {
      const users = await User.findAll({
        where: {
          telegram_bot_token: { [require('sequelize').Op.ne]: null },
          telegram_chat_id: { [require('sequelize').Op.ne]: null },
          task_summary_enabled: true,
          task_summary_frequency: frequency
        }
      });

      console.log(`Processing ${users.length} users for frequency: ${frequency}`);

      for (const user of users) {
        try {
          const success = await TaskSummaryService.sendSummaryToUser(user.id);
          if (success) {
            console.log(`Sent ${frequency} summary to user ${user.id}`);
          } else {
            console.log(`Failed to send ${frequency} summary to user ${user.id}`);
          }
        } catch (error) {
          console.error(`Error sending ${frequency} summary to user ${user.id}:`, error.message);
        }
      }
    } catch (error) {
      console.error(`Error processing summaries for frequency ${frequency}:`, error);
    }
  }

  async stop() {
    if (!this.isInitialized) {
      console.log('Task scheduler not initialized, nothing to stop');
      return;
    }

    console.log('Stopping task scheduler...');
    this.jobs.forEach((job, frequency) => {
      job.stop();
      console.log(`Stopped scheduler for frequency: ${frequency}`);
    });

    this.jobs.clear();
    this.isInitialized = false;
    console.log('Task scheduler stopped');
  }

  async restart() {
    await this.stop();
    await this.initialize();
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      jobCount: this.jobs.size,
      jobs: Array.from(this.jobs.keys())
    };
  }
}

module.exports = TaskScheduler;