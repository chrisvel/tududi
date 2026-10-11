'use strict';
const {
    safeAddColumns,
    safeCreateTable,
    safeAddIndex,
} = require('../utils/migration-utils');

// Life-to-Day (T-502, T-503): Focus sessions and the task starter step.
// Purely additive (blueprint 13.3); energy and original_plan are out of v0.1.
module.exports = {
    async up(queryInterface, S) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'starter_step',
                definition: { type: S.TEXT, allowNull: true },
            },
        ]);
        await safeCreateTable(queryInterface, 'ltd_focus_sessions', {
            id: { type: S.INTEGER, primaryKey: true, autoIncrement: true },
            uid: { type: S.STRING, allowNull: false, unique: true },
            user_id: {
                type: S.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            task_id: {
                type: S.INTEGER,
                allowNull: true,
                references: { model: 'tasks', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            started_at: { type: S.DATE, allowNull: false },
            ended_at: { type: S.DATE, allowNull: true },
            planned_minutes: { type: S.INTEGER, allowNull: false },
            actual_minutes: { type: S.INTEGER, allowNull: true },
            interrupted: {
                type: S.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            resume_note: { type: S.TEXT, allowNull: true },
        });
        await safeAddIndex(queryInterface, 'ltd_focus_sessions', ['user_id']);
        await safeAddIndex(queryInterface, 'ltd_focus_sessions', ['task_id']);
    },
    async down() {
        throw new Error(
            'Life-to-Day today migration is additive; restore a backup to roll back.'
        );
    },
};
