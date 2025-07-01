const { User, Task, Project, Tag } = require('../models');
const { Op } = require('sequelize');
const TelegramPoller = require('./telegramPoller');

// escape markdown special characters
const escapeMarkdown = (text) => {
    if (!text) return '';
    // Characters that need to be escaped in MarkdownV2: _*[]()~`>#+-=|{}.!
    return text.toString().replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
};

// get priority emoji
const getPriorityEmoji = (priority) => {
    const emojiMap = {
        2: '🔴', // high
        1: '🟠', // medium
        0: '🟢', // low
    };
    return emojiMap[priority] || '⚪';
};

// create date range for today
const createTodayDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { today, tomorrow };
};

// format task for display
const formatTaskForDisplay = (task, index, includeStatus = false) => {
    const priorityEmoji = getPriorityEmoji(task.priority);
    const statusEmoji = includeStatus ? '✅ ' : '';
    const taskName = escapeMarkdown(task.name);
    const projectInfo = task.Project
        ? ` \\[${escapeMarkdown(task.Project.name)}\\]`
        : '';
    return `${index + 1}\\. ${statusEmoji}${priorityEmoji} ${taskName}${projectInfo}\n`;
};

// build task section
const buildTaskSection = (tasks, title, includeStatus = false) => {
    if (tasks.length === 0) return '';

    let section = `${title}\n`;
    section += tasks
        .map((task, index) => formatTaskForDisplay(task, index, includeStatus))
        .join('');
    section += '\n';

    return section;
};

// build summary message
const buildSummaryMessage = (taskSections) => {
    let message = "📋 *Today's Task Summary*\n\n";
    message += '━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    message += "✏️ *Today's Plan*\n\n";

    message += taskSections.dueToday;
    message += taskSections.inProgress;
    message += taskSections.suggested;
    message += taskSections.completed;

    message += '━━━━━━━━━━━━━━━━━━━━━━━━\n';
    message += '🎯 *Stay focused and make it happen\\!*';

    return message;
};

// calculate next run time
const calculateNextRunTime = (user, fromTime = new Date()) => {
    const frequency = user.task_summary_frequency;
    const from = new Date(fromTime);

    const calculations = {
        daily: () => {
            const nextDay = new Date(from);
            nextDay.setDate(nextDay.getDate() + 1);
            nextDay.setHours(7, 0, 0, 0);
            return nextDay;
        },

        weekdays: () => {
            const currentDay = from.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            let daysToAdd = 1;
            if (currentDay === 5) {
                // Friday
                daysToAdd = 3; // Skip to Monday
            } else if (currentDay === 6) {
                // Saturday
                daysToAdd = 2; // Skip to Monday
            }
            const nextWeekday = new Date(from);
            nextWeekday.setDate(nextWeekday.getDate() + daysToAdd);
            nextWeekday.setHours(7, 0, 0, 0);
            return nextWeekday;
        },

        weekly: () => {
            const nextWeek = new Date(from);
            nextWeek.setDate(nextWeek.getDate() + 7);
            nextWeek.setHours(7, 0, 0, 0);
            return nextWeek;
        },

        '1h': () => {
            const nextHour = new Date(from);
            nextHour.setHours(nextHour.getHours() + 1);
            return nextHour;
        },

        '2h': () => {
            const next = new Date(from);
            next.setHours(next.getHours() + 2);
            return next;
        },

        '4h': () => {
            const next = new Date(from);
            next.setHours(next.getHours() + 4);
            return next;
        },

        '8h': () => {
            const next = new Date(from);
            next.setHours(next.getHours() + 8);
            return next;
        },

        '12h': () => {
            const next = new Date(from);
            next.setHours(next.getHours() + 12);
            return next;
        },
    };

    const calculator = calculations[frequency];
    return calculator ? calculator() : calculations.daily();
};

// Side effect function to fetch user by ID
const fetchUser = async (userId) => await User.findByPk(userId);

// Side effect function to fetch due today tasks
const fetchDueTodayTasks = async (userId, today, tomorrow) =>
    await Task.findAll({
        where: {
            user_id: userId,
            due_date: {
                [Op.gte]: today,
                [Op.lt]: tomorrow,
            },
            status: { [Op.ne]: 2 }, // not done
        },
        include: [{ model: Project, attributes: ['name'] }],
        order: [['name', 'ASC']],
    });

// Side effect function to fetch in progress tasks
const fetchInProgressTasks = async (userId) =>
    await Task.findAll({
        where: {
            user_id: userId,
            status: 1, // in_progress
        },
        include: [{ model: Project, attributes: ['name'] }],
        order: [['name', 'ASC']],
    });

// Side effect function to fetch completed today tasks
const fetchCompletedTodayTasks = async (userId, today, tomorrow) =>
    await Task.findAll({
        where: {
            user_id: userId,
            status: 2, // done
            updated_at: {
                [Op.gte]: today,
                [Op.lt]: tomorrow,
            },
        },
        include: [{ model: Project, attributes: ['name'] }],
        order: [['name', 'ASC']],
    });

// Side effect function to fetch suggested tasks
const fetchSuggestedTasks = async (userId, excludedIds) =>
    await Task.findAll({
        where: {
            user_id: userId,
            status: { [Op.ne]: 2 }, // not done
            id: { [Op.notIn]: excludedIds },
        },
        include: [{ model: Project, attributes: ['name'] }],
        order: [
            ['priority', 'DESC'],
            ['name', 'ASC'],
        ],
        limit: 5,
    });

// Side effect function to send telegram message
const sendTelegramMessage = async (token, chatId, message) => {
    const poller = TelegramPoller;
    return await poller.sendTelegramMessage(token, chatId, message);
};

// Side effect function to update user tracking fields
const updateUserTracking = async (user, lastRun, nextRun) =>
    await user.update({
        task_summary_last_run: lastRun,
        task_summary_next_run: nextRun,
    });

// Function to generate summary for user (contains side effects)
const generateSummaryForUser = async (userId) => {
    try {
        const user = await fetchUser(userId);
        if (!user) return null;

        const { today, tomorrow } = createTodayDateRange();

        // Fetch all task data in parallel
        const [dueToday, inProgress, completedToday] = await Promise.all([
            fetchDueTodayTasks(userId, today, tomorrow),
            fetchInProgressTasks(userId),
            fetchCompletedTodayTasks(userId, today, tomorrow),
        ]);

        // Get suggested tasks (excluding already fetched ones)
        const excludedIds = [
            ...dueToday.map((t) => t.id),
            ...inProgress.map((t) => t.id),
        ];
        const suggestedTasks = await fetchSuggestedTasks(userId, excludedIds);

        // Build task sections
        const taskSections = {
            dueToday: buildTaskSection(dueToday, '🚀 *Tasks Due Today:*'),
            inProgress: buildTaskSection(inProgress, '⚙️ *In Progress Tasks:*'),
            suggested: buildTaskSection(
                suggestedTasks,
                '💡 *Suggested Tasks:*'
            ),
            completed: buildTaskSection(
                completedToday,
                '✅ *Completed Today:*',
                true
            ),
        };

        return buildSummaryMessage(taskSections);
    } catch (error) {
        console.error('Error generating task summary:', error);
        return null;
    }
};

// Function to send summary to user (contains side effects)
const sendSummaryToUser = async (userId) => {
    try {
        const user = await fetchUser(userId);
        if (!user || !user.telegram_bot_token || !user.telegram_chat_id) {
            return false;
        }

        const summary = await generateSummaryForUser(userId);
        if (!summary) return false;

        // Send the message via Telegram
        await sendTelegramMessage(
            user.telegram_bot_token,
            user.telegram_chat_id,
            summary
        );

        // Update tracking fields
        const now = new Date();
        const nextRun = calculateNextRunTime(user, now);
        await updateUserTracking(user, now, nextRun);

        return true;
    } catch (error) {
        console.error(
            `Error sending task summary to user ${userId}:`,
            error.message
        );
        return false;
    }
};

// Export functional interface
module.exports = {
    generateSummaryForUser,
    sendSummaryToUser,
    calculateNextRunTime,
    // For testing
    _escapeMarkdown: escapeMarkdown,
    _getPriorityEmoji: getPriorityEmoji,
    _createTodayDateRange: createTodayDateRange,
    _formatTaskForDisplay: formatTaskForDisplay,
    _buildTaskSection: buildTaskSection,
    _buildSummaryMessage: buildSummaryMessage,
};
