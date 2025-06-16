const { User, Task, Project, Tag } = require('../models');
const { Op } = require('sequelize');
const TelegramPoller = require('./telegramPoller');

class TaskSummaryService {
  // Helper method to escape special characters for MarkdownV2
  static escapeMarkdown(text) {
    if (!text) return '';
    // Characters that need to be escaped in MarkdownV2: _*[]()~`>#+-=|{}.!
    return text.toString().replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  static async generateSummaryForUser(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) return null;

      // Get today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's tasks, in progress tasks, etc.
      const dueToday = await Task.findAll({
        where: {
          user_id: userId,
          due_date: {
            [Op.gte]: today,
            [Op.lt]: tomorrow
          },
          status: { [Op.ne]: 2 } // not done
        },
        include: [{ model: Project, attributes: ['name'] }],
        order: [['name', 'ASC']]
      });

      const inProgress = await Task.findAll({
        where: {
          user_id: userId,
          status: 1 // in_progress
        },
        include: [{ model: Project, attributes: ['name'] }],
        order: [['name', 'ASC']]
      });

      const completedToday = await Task.findAll({
        where: {
          user_id: userId,
          status: 2, // done
          updated_at: {
            [Op.gte]: today,
            [Op.lt]: tomorrow
          }
        },
        include: [{ model: Project, attributes: ['name'] }],
        order: [['name', 'ASC']]
      });

      // Generate summary message
      let message = "📋 *Today's Task Summary*\n\n";
      message += "━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
      message += "✏️ *Today's Plan*\n\n";

      // Add due today tasks
      if (dueToday.length > 0) {
        message += "🚀 *Tasks Due Today:*\n";
        dueToday.forEach((task, index) => {
          const priorityEmoji = this.getPriorityEmoji(task.priority);
          const taskName = this.escapeMarkdown(task.name);
          const projectInfo = task.Project ? ` \\[${this.escapeMarkdown(task.Project.name)}\\]` : '';
          message += `${index + 1}\\. ${priorityEmoji} ${taskName}${projectInfo}\n`;
        });
        message += "\n";
      }

      // Add in progress tasks
      if (inProgress.length > 0) {
        message += "⚙️ *In Progress Tasks:*\n";
        inProgress.forEach((task, index) => {
          const priorityEmoji = this.getPriorityEmoji(task.priority);
          const taskName = this.escapeMarkdown(task.name);
          const projectInfo = task.Project ? ` \\[${this.escapeMarkdown(task.Project.name)}\\]` : '';
          message += `${index + 1}\\. ${priorityEmoji} ${taskName}${projectInfo}\n`;
        });
        message += "\n";
      }

      // Get suggested tasks (not done, not in due today or in progress)
      const excludedIds = [...dueToday.map(t => t.id), ...inProgress.map(t => t.id)];
      
      const suggestedTasks = await Task.findAll({
        where: {
          user_id: userId,
          status: { [Op.ne]: 2 }, // not done
          id: { [Op.notIn]: excludedIds }
        },
        include: [{ model: Project, attributes: ['name'] }],
        order: [['priority', 'DESC'], ['name', 'ASC']],
        limit: 5
      });

      if (suggestedTasks.length > 0) {
        message += "💡 *Suggested Tasks:*\n";
        suggestedTasks.forEach((task, index) => {
          const priorityEmoji = this.getPriorityEmoji(task.priority);
          const taskName = this.escapeMarkdown(task.name);
          const projectInfo = task.Project ? ` \\[${this.escapeMarkdown(task.Project.name)}\\]` : '';
          message += `${index + 1}\\. ${priorityEmoji} ${taskName}${projectInfo}\n`;
        });
        message += "\n";
      }

      // Add completed tasks
      if (completedToday.length > 0) {
        message += "✅ *Completed Today:*\n";
        completedToday.forEach((task, index) => {
          const taskName = this.escapeMarkdown(task.name);
          const projectInfo = task.Project ? ` \\[${this.escapeMarkdown(task.Project.name)}\\]` : '';
          message += `${index + 1}\\. ✅ ${taskName}${projectInfo}\n`;
        });
        message += "\n";
      }

      // Add footer
      message += "━━━━━━━━━━━━━━━━━━━━━━━━\n";
      message += "🎯 *Stay focused and make it happen\\!*";

      return message;
    } catch (error) {
      console.error('Error generating task summary:', error);
      return null;
    }
  }

  static getPriorityEmoji(priority) {
    switch (priority) {
      case 2: return '🔴'; // high
      case 1: return '🟠'; // medium
      case 0: return '🟢'; // low
      default: return '⚪';
    }
  }

  static async sendSummaryToUser(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user || !user.telegram_bot_token || !user.telegram_chat_id) {
        return false;
      }

      const summary = await this.generateSummaryForUser(userId);
      if (!summary) return false;

      // Send the message via Telegram
      const poller = TelegramPoller.getInstance();
      await poller.sendTelegramMessage(
        user.telegram_bot_token,
        user.telegram_chat_id,
        summary
      );

      // Update the last run time and calculate the next run time
      const now = new Date();
      const nextRun = this.calculateNextRunTime(user, now);

      // Update the user's tracking fields
      await user.update({
        task_summary_last_run: now,
        task_summary_next_run: nextRun
      });

      return true;
    } catch (error) {
      console.error(`Error sending task summary to user ${userId}:`, error.message);
      return false;
    }
  }

  static calculateNextRunTime(user, fromTime = new Date()) {
    const frequency = user.task_summary_frequency;
    const from = new Date(fromTime);

    switch (frequency) {
      case 'daily':
        // Next day at 7 AM
        const nextDay = new Date(from);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(7, 0, 0, 0);
        return nextDay;

      case 'weekdays':
        // Next weekday at 7 AM
        const currentDay = from.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        let daysToAdd = 1;
        if (currentDay === 5) { // Friday
          daysToAdd = 3; // Skip to Monday
        } else if (currentDay === 6) { // Saturday
          daysToAdd = 2; // Skip to Monday
        }
        const nextWeekday = new Date(from);
        nextWeekday.setDate(nextWeekday.getDate() + daysToAdd);
        nextWeekday.setHours(7, 0, 0, 0);
        return nextWeekday;

      case 'weekly':
        // Next Monday at 7 AM
        const nextWeek = new Date(from);
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextWeek.setHours(7, 0, 0, 0);
        return nextWeek;

      case '1h':
        return new Date(from.getTime() + 60 * 60 * 1000);

      case '2h':
        return new Date(from.getTime() + 2 * 60 * 60 * 1000);

      case '4h':
        return new Date(from.getTime() + 4 * 60 * 60 * 1000);

      case '8h':
        return new Date(from.getTime() + 8 * 60 * 60 * 1000);

      case '12h':
        return new Date(from.getTime() + 12 * 60 * 60 * 1000);

      default:
        // Default to daily
        const defaultNext = new Date(from);
        defaultNext.setDate(defaultNext.getDate() + 1);
        defaultNext.setHours(7, 0, 0, 0);
        return defaultNext;
    }
  }
}

module.exports = TaskSummaryService;