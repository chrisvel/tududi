'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    // Habits v2: quit habits, measurable habits, schedules, reminders,
    // time-of-day groups and a strength score. Check-ins can carry an amount
    // and a note.
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'habit_polarity',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    defaultValue: 'build',
                },
            },
            {
                name: 'habit_unit',
                definition: { type: Sequelize.STRING, allowNull: true },
            },
            {
                name: 'habit_target_value',
                definition: { type: Sequelize.FLOAT, allowNull: true },
            },
            {
                name: 'habit_schedule_days',
                definition: { type: Sequelize.JSON, allowNull: true },
            },
            {
                name: 'habit_interval_days',
                definition: { type: Sequelize.INTEGER, allowNull: true },
            },
            {
                name: 'habit_time_of_day',
                definition: { type: Sequelize.STRING, allowNull: true },
            },
            {
                name: 'habit_reminder_time',
                definition: { type: Sequelize.STRING, allowNull: true },
            },
            {
                name: 'habit_reminder_sent_on',
                definition: { type: Sequelize.STRING, allowNull: true },
            },
            {
                name: 'habit_strength',
                definition: {
                    type: Sequelize.FLOAT,
                    allowNull: false,
                    defaultValue: 0,
                },
            },
        ]);

        await safeAddColumns(queryInterface, 'recurring_completions', [
            {
                name: 'value',
                definition: { type: Sequelize.FLOAT, allowNull: true },
            },
            {
                name: 'note',
                definition: { type: Sequelize.TEXT, allowNull: true },
            },
        ]);
    },

    async down(queryInterface) {
        for (const column of [
            'habit_polarity',
            'habit_unit',
            'habit_target_value',
            'habit_schedule_days',
            'habit_interval_days',
            'habit_time_of_day',
            'habit_reminder_time',
            'habit_reminder_sent_on',
            'habit_strength',
        ]) {
            await safeRemoveColumn(queryInterface, 'tasks', column);
        }
        await safeRemoveColumn(
            queryInterface,
            'recurring_completions',
            'value'
        );
        await safeRemoveColumn(queryInterface, 'recurring_completions', 'note');
    },
};
