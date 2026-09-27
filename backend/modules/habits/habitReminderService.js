'use strict';

const moment = require('moment-timezone');
const { Op } = require('sequelize');
const { Task, User, Notification } = require('../../models');
const habitService = require('./habitService');
const engine = require('./habitEngine');
const { logError } = require('../../services/logService');
const { getSafeTimezone } = require('../../utils/timezone-utils');
const {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
} = require('../../utils/notificationPreferences');

// A reminder that was missed (server down, reminder set later in the day)
// is only sent while it is still this fresh.
const REMINDER_WINDOW_MINUTES = 60;

function minutesOfDay(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

function isReminderDue(habit, now, timezone) {
    const local = moment(now).tz(timezone);
    const todayKey = local.format('YYYY-MM-DD');
    if (habit.habit_reminder_sent_on === todayKey) return false;

    const elapsed =
        local.hours() * 60 +
        local.minutes() -
        minutesOfDay(habit.habit_reminder_time);
    return elapsed >= 0 && elapsed < REMINDER_WINDOW_MINUTES;
}

async function checkHabitReminders(now = new Date()) {
    const habits = await Task.findAll({
        where: {
            habit_mode: true,
            habit_reminder_time: { [Op.ne]: null },
            status: { [Op.notIn]: [3, 5] },
        },
        include: [
            {
                model: User,
                attributes: [
                    'id',
                    'timezone',
                    'first_day_of_week',
                    'notification_preferences',
                    'telegram_bot_token',
                    'telegram_chat_id',
                ],
            },
        ],
    });

    let sent = 0;
    for (const habit of habits) {
        try {
            const user = habit.User;
            if (!user) continue;
            const ctx = {
                timezone: getSafeTimezone(user.timezone),
                firstDayOfWeek: Number.isInteger(user.first_day_of_week)
                    ? user.first_day_of_week
                    : 1,
                now,
            };
            if (!isReminderDue(habit, now, ctx.timezone)) continue;

            const todayKey = engine.toDayKey(now, ctx.timezone);
            const evaluation = await habitService.refresh(habit, ctx);
            const { progress } = evaluation;
            await habit.update({ habit_reminder_sent_on: todayKey });

            const isQuit = habit.habit_polarity === 'quit';
            // Nothing to nudge: done, skipped, or not a scheduled day.
            if (
                !isQuit &&
                (progress.met || progress.skipped || !progress.scheduled_today)
            ) {
                continue;
            }
            if (isQuit && !progress.met) continue;

            const inApp = shouldSendInAppNotification(user, 'habitReminders');
            const telegram =
                !!(user.telegram_bot_token && user.telegram_chat_id) &&
                shouldSendTelegramNotification(user, 'habitReminders');
            // Matches the other reminders: no in-app notification, no send.
            if (!inApp) continue;

            const message = isQuit
                ? `Keep it going: ${evaluation.currentStreak} clean so far for "${habit.name}".`
                : `Time for "${habit.name}".`;

            await Notification.createNotification({
                userId: user.id,
                type: 'reminder',
                title: isQuit ? 'Habit check' : 'Habit reminder',
                message,
                sources: telegram ? ['telegram'] : [],
                data: {
                    habitUid: habit.uid,
                    habitName: habit.name,
                    reason: 'habit_reminder',
                },
                sentAt: now,
            });
            sent++;
        } catch (error) {
            logError(`Error sending reminder for habit ${habit.id}:`, error);
        }
    }

    return { success: true, habitsChecked: habits.length, remindersSent: sent };
}

module.exports = { checkHabitReminders, isReminderDue };
