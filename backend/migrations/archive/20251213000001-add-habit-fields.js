'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'habit_mode',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                    comment: 'Flag to identify habit-mode tasks',
                },
            },
            {
                name: 'habit_target_count',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    comment:
                        'Target completions per period (e.g., 3 times per week)',
                },
            },
            {
                name: 'habit_frequency_period',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                    comment:
                        'Period for target frequency: daily, weekly, monthly',
                },
            },
            {
                name: 'habit_streak_mode',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    defaultValue: 'calendar',
                    comment:
                        'Streak calculation mode: calendar (daily) or scheduled (follows recurrence)',
                },
            },
            {
                name: 'habit_flexibility_mode',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    defaultValue: 'flexible',
                    comment:
                        'Strict: exact schedule. Flexible: anytime within period',
                },
            },
            {
                name: 'habit_current_streak',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                    comment: 'Current streak counter (cached for performance)',
                },
            },
            {
                name: 'habit_best_streak',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                    comment: 'Best streak ever (cached for motivation)',
                },
            },
            {
                name: 'habit_total_completions',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                    comment: 'Total completions counter (cached for analytics)',
                },
            },
            {
                name: 'habit_last_completion_at',
                definition: {
                    type: Sequelize.DATE,
                    allowNull: true,
                    comment:
                        'Last completion date (cached to avoid DB queries for streak logic)',
                },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(
            queryInterface,
            'tasks',
            'habit_last_completion_at'
        );
        await safeRemoveColumn(
            queryInterface,
            'tasks',
            'habit_total_completions'
        );
        await safeRemoveColumn(queryInterface, 'tasks', 'habit_best_streak');
        await safeRemoveColumn(queryInterface, 'tasks', 'habit_current_streak');
        await safeRemoveColumn(
            queryInterface,
            'tasks',
            'habit_flexibility_mode'
        );
        await safeRemoveColumn(queryInterface, 'tasks', 'habit_streak_mode');
        await safeRemoveColumn(
            queryInterface,
            'tasks',
            'habit_frequency_period'
        );
        await safeRemoveColumn(queryInterface, 'tasks', 'habit_target_count');
        await safeRemoveColumn(queryInterface, 'tasks', 'habit_mode');
    },
};
