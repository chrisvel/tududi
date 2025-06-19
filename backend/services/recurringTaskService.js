const { Task } = require('../models');
const { Op } = require('sequelize');

/**
 * Service for managing recurring tasks
 */
class RecurringTaskService {
  
  /**
   * Generate new tasks from recurring task templates
   * @param {number} userId - Optional user ID to limit processing
   * @returns {Promise<Array>} Array of newly created tasks
   */
  static async generateRecurringTasks(userId = null) {
    try {
      const whereClause = {
        recurrence_type: { [Op.ne]: 'none' },
        status: { [Op.ne]: Task.STATUS.ARCHIVED }
      };

      if (userId) {
        whereClause.user_id = userId;
      }

      // Find all recurring tasks that need processing
      const recurringTasks = await Task.findAll({
        where: whereClause,
        order: [['last_generated_date', 'ASC']]
      });

      const newTasks = [];
      const now = new Date();

      for (const task of recurringTasks) {
        const generatedTasks = await this.processRecurringTask(task, now);
        newTasks.push(...generatedTasks);
      }

      return newTasks;
    } catch (error) {
      console.error('Error generating recurring tasks:', error);
      throw error;
    }
  }

  /**
   * Process a single recurring task and generate new instances if needed
   * @param {Object} task - The recurring task template
   * @param {Date} now - Current timestamp
   * @returns {Promise<Array>} Array of newly created task instances
   */
  static async processRecurringTask(task, now) {
    const newTasks = [];
    
    // Skip if recurrence has ended
    if (task.recurrence_end_date && now > task.recurrence_end_date) {
      return newTasks;
    }

    let nextDueDate = this.calculateNextDueDate(task, now);
    
    // Generate tasks up to current date
    while (nextDueDate && nextDueDate <= now) {
      // Check if this due date already has a task instance
      const existingTask = await Task.findOne({
        where: {
          user_id: task.user_id,
          name: task.name,
          due_date: nextDueDate,
          project_id: task.project_id
        }
      });

      if (!existingTask) {
        const newTask = await this.createTaskInstance(task, nextDueDate);
        newTasks.push(newTask);
      }

      // Update last generated date
      task.last_generated_date = nextDueDate;
      await task.save();

      // Calculate next due date
      nextDueDate = this.calculateNextDueDate(task, nextDueDate);
      
      // Safety check to prevent infinite loops
      if (newTasks.length > 100) {
        console.warn(`Generated 100+ tasks for recurring task ${task.id}, stopping to prevent overflow`);
        break;
      }
    }

    return newTasks;
  }

  /**
   * Create a new task instance from a recurring task template
   * @param {Object} template - The recurring task template
   * @param {Date} dueDate - Due date for the new task instance
   * @returns {Promise<Object>} The newly created task
   */
  static async createTaskInstance(template, dueDate) {
    const taskData = {
      name: template.name,
      description: template.description,
      due_date: dueDate,
      today: false,
      priority: template.priority,
      status: Task.STATUS.NOT_STARTED,
      note: template.note,
      user_id: template.user_id,
      project_id: template.project_id,
      recurrence_type: 'none', // Instances are not recurring themselves
      recurring_parent_id: template.id // Link to the original recurring task
    };

    return await Task.create(taskData);
  }

  /**
   * Calculate the next due date for a recurring task
   * @param {Object} task - The recurring task
   * @param {Date} fromDate - Date to calculate from
   * @returns {Date|null} Next due date or null if no more recurrences
   */
  static calculateNextDueDate(task, fromDate) {
    const baseDate = task.completion_based ? 
      (task.last_generated_date || task.created_at) : 
      (task.due_date || task.created_at);
    
    const startDate = new Date(Math.max(fromDate.getTime(), baseDate.getTime()));
    
    switch (task.recurrence_type) {
      case 'daily':
        return this.calculateDailyRecurrence(startDate, task.recurrence_interval || 1);
      
      case 'weekly':
        return this.calculateWeeklyRecurrence(startDate, task.recurrence_interval || 1, task.recurrence_weekday);
      
      case 'monthly':
        return this.calculateMonthlyRecurrence(startDate, task.recurrence_interval || 1, task.recurrence_month_day);
      
      case 'monthly_weekday':
        return this.calculateMonthlyWeekdayRecurrence(
          startDate, 
          task.recurrence_interval || 1, 
          task.recurrence_weekday, 
          task.recurrence_week_of_month
        );
      
      case 'monthly_last_day':
        return this.calculateMonthlyLastDayRecurrence(startDate, task.recurrence_interval || 1);
      
      default:
        return null;
    }
  }

  /**
   * Calculate next daily recurrence
   * @param {Date} fromDate - Starting date
   * @param {number} interval - Days between recurrences
   * @returns {Date} Next due date
   */
  static calculateDailyRecurrence(fromDate, interval) {
    const nextDate = new Date(fromDate);
    nextDate.setDate(nextDate.getDate() + interval);
    return nextDate;
  }

  /**
   * Calculate next weekly recurrence
   * @param {Date} fromDate - Starting date
   * @param {number} interval - Weeks between recurrences
   * @param {number} weekday - Target day of week (0=Sunday, 6=Saturday)
   * @returns {Date} Next due date
   */
  static calculateWeeklyRecurrence(fromDate, interval, weekday) {
    const nextDate = new Date(fromDate);
    
    if (weekday !== null && weekday !== undefined) {
      // Find next occurrence of the specified weekday
      const currentWeekday = nextDate.getDay();
      const daysUntilTarget = (weekday - currentWeekday + 7) % 7;
      
      if (daysUntilTarget === 0 && nextDate.getTime() === fromDate.getTime()) {
        // If today is the target weekday and we're calculating from today, add interval weeks
        nextDate.setDate(nextDate.getDate() + (interval * 7));
      } else {
        nextDate.setDate(nextDate.getDate() + daysUntilTarget);
        if (nextDate <= fromDate) {
          nextDate.setDate(nextDate.getDate() + (interval * 7));
        }
      }
    } else {
      // No specific weekday, just add interval weeks
      nextDate.setDate(nextDate.getDate() + (interval * 7));
    }
    
    return nextDate;
  }

  /**
   * Calculate next monthly recurrence on specific day
   * @param {Date} fromDate - Starting date
   * @param {number} interval - Months between recurrences
   * @param {number} dayOfMonth - Target day of month (1-31)
   * @returns {Date} Next due date
   */
  static calculateMonthlyRecurrence(fromDate, interval, dayOfMonth) {
    const nextDate = new Date(fromDate);
    const targetDay = dayOfMonth || fromDate.getDate();
    
    // Move to next month
    nextDate.setMonth(nextDate.getMonth() + interval);
    
    // Set the target day, handling month overflow
    const maxDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
    nextDate.setDate(Math.min(targetDay, maxDay));
    
    return nextDate;
  }

  /**
   * Calculate next monthly recurrence on specific weekday of month
   * @param {Date} fromDate - Starting date
   * @param {number} interval - Months between recurrences
   * @param {number} weekday - Target weekday (0=Sunday, 6=Saturday)
   * @param {number} weekOfMonth - Which occurrence in month (1-5)
   * @returns {Date} Next due date
   */
  static calculateMonthlyWeekdayRecurrence(fromDate, interval, weekday, weekOfMonth) {
    const nextDate = new Date(fromDate);
    nextDate.setMonth(nextDate.getMonth() + interval);
    
    // Find the first day of the month
    const firstOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
    const firstWeekday = firstOfMonth.getDay();
    
    // Calculate the first occurrence of the target weekday
    const daysToAdd = (weekday - firstWeekday + 7) % 7;
    const firstOccurrence = new Date(firstOfMonth);
    firstOccurrence.setDate(1 + daysToAdd);
    
    // Add weeks to get to the target week of month
    const targetDate = new Date(firstOccurrence);
    targetDate.setDate(firstOccurrence.getDate() + ((weekOfMonth - 1) * 7));
    
    // Make sure we're still in the same month
    if (targetDate.getMonth() !== nextDate.getMonth()) {
      // Week doesn't exist in this month, use last occurrence
      targetDate.setDate(targetDate.getDate() - 7);
    }
    
    return targetDate;
  }

  /**
   * Calculate next monthly recurrence on last day of month
   * @param {Date} fromDate - Starting date
   * @param {number} interval - Months between recurrences
   * @returns {Date} Next due date
   */
  static calculateMonthlyLastDayRecurrence(fromDate, interval) {
    const nextDate = new Date(fromDate);
    nextDate.setMonth(nextDate.getMonth() + interval);
    
    // Set to last day of month
    nextDate.setMonth(nextDate.getMonth() + 1, 0);
    
    return nextDate;
  }

  /**
   * Handle task completion for recurring tasks
   * @param {Object} task - The completed task
   * @returns {Promise<Object|null>} Next task instance if applicable
   */
  static async handleTaskCompletion(task) {
    console.log('🔄 RecurringTaskService.handleTaskCompletion called for task:', {
      id: task.id,
      name: task.name,
      recurrence_type: task.recurrence_type,
      completion_based: task.completion_based
    });

    // Check if the completed task itself is a recurring task
    if (!task.recurrence_type || task.recurrence_type === 'none') {
      console.log('❌ Task is not recurring, skipping');
      return null;
    }

    // Only generate next task if completion_based is true
    if (!task.completion_based) {
      console.log('❌ Task is not completion_based, skipping (will be handled by scheduler)');
      return null;
    }

    console.log('✅ Task is recurring and completion_based, generating next instance');

    // Update the task's last generated date to completion date
    task.last_generated_date = new Date();
    await task.save();

    // For completion-based tasks, create the next instance immediately
    const nextDueDate = this.calculateNextDueDate(task, new Date());
    console.log('📅 Calculated next due date:', nextDueDate);
    
    if (!nextDueDate) {
      console.log('❌ No next due date calculated');
      return null;
    }

    // Check if this due date already has a task instance
    const existingTask = await Task.findOne({
      where: {
        user_id: task.user_id,
        name: task.name,
        due_date: nextDueDate,
        project_id: task.project_id
      }
    });

    if (existingTask) {
      console.log('❌ Task already exists for this date:', nextDueDate);
      return null; // Task already exists for this date
    }

    // Create the next task instance
    console.log('✅ Creating new task instance');
    const nextTask = await this.createTaskInstance(task, nextDueDate);
    console.log('🆕 Created new task:', {
      id: nextTask.id,
      name: nextTask.name,
      due_date: nextTask.due_date,
      status: nextTask.status
    });
    return nextTask;
  }
}

module.exports = RecurringTaskService;