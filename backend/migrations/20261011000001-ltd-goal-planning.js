'use strict';
const {
    safeAddColumns,
    safeCreateTable,
    safeAddIndex,
} = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, S) {
        // Extend the existing PostgreSQL enum; SQLite stores ENUM as TEXT.
        // No goals rebuild and no rewriting existing season/year values.
        if (queryInterface.sequelize.getDialect() === 'postgres') {
            for (const value of ['vision', 'five_year', 'month', 'week']) {
                await queryInterface.sequelize.query(
                    `ALTER TYPE "enum_goals_horizon" ADD VALUE IF NOT EXISTS '${value}'`
                );
            }
        }
        await safeAddColumns(queryInterface, 'goals', [
            {
                name: 'parent_goal_id',
                definition: {
                    type: S.INTEGER,
                    allowNull: true,
                    references: { model: 'goals', key: 'id' },
                    onDelete: 'SET NULL',
                    onUpdate: 'CASCADE',
                },
            },
            {
                name: 'period_start',
                definition: { type: S.DATEONLY, allowNull: true },
            },
            {
                name: 'period_end',
                definition: { type: S.DATEONLY, allowNull: true },
            },
            {
                name: 'achieved_at',
                definition: { type: S.DATE, allowNull: true },
            },
        ]);
        await safeAddIndex(queryInterface, 'goals', ['parent_goal_id']);
        for (const table of ['tasks', 'projects']) {
            await safeAddColumns(queryInterface, table, [
                {
                    name: 'goal_id',
                    definition: {
                        type: S.INTEGER,
                        allowNull: true,
                        references: { model: 'goals', key: 'id' },
                        onDelete: 'SET NULL',
                    },
                },
            ]);
            await safeAddIndex(queryInterface, table, ['goal_id']);
        }
        const identity = () => ({
            id: { type: S.INTEGER, primaryKey: true, autoIncrement: true },
            uid: { type: S.STRING, allowNull: false, unique: true },
        });
        await safeCreateTable(queryInterface, 'ltd_goal_metrics', {
            ...identity(),
            goal_id: {
                type: S.INTEGER,
                allowNull: false,
                references: { model: 'goals', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            name: { type: S.STRING, allowNull: false },
            unit: { type: S.STRING, allowNull: true },
            baseline: { type: S.DOUBLE, allowNull: false },
            target: { type: S.DOUBLE, allowNull: false },
            direction: {
                type: S.ENUM('increase', 'decrease'),
                allowNull: false,
                defaultValue: 'increase',
            },
            current_value: { type: S.DOUBLE, allowNull: false },
            weight: { type: S.DOUBLE, allowNull: false, defaultValue: 1 },
            source: {
                type: S.ENUM('manual', 'habit', 'task_count'),
                allowNull: false,
                defaultValue: 'manual',
            },
            created_at: { type: S.DATE, allowNull: false },
            updated_at: { type: S.DATE, allowNull: false },
        });
        await safeCreateTable(queryInterface, 'ltd_metric_checkins', {
            ...identity(),
            metric_id: {
                type: S.INTEGER,
                allowNull: false,
                references: { model: 'ltd_goal_metrics', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            value: { type: S.DOUBLE, allowNull: false },
            recorded_at: {
                type: S.DATE,
                allowNull: false,
                defaultValue: S.literal('CURRENT_TIMESTAMP'),
            },
            note: { type: S.TEXT, allowNull: true },
            source: {
                type: S.ENUM('user', 'ai', 'mcp', 'habit'),
                allowNull: false,
                defaultValue: 'user',
            },
        });
        await safeCreateTable(queryInterface, 'ltd_journal', {
            ...identity(),
            user_id: {
                type: S.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            actor_type: {
                type: S.ENUM('user', 'ai', 'mcp', 'system', 'sync'),
                allowNull: false,
                defaultValue: 'user',
            },
            actor_id: { type: S.STRING, allowNull: true },
            op: { type: S.STRING, allowNull: false },
            entity_type: { type: S.STRING, allowNull: false },
            entity_uid: { type: S.STRING, allowNull: false },
            before: { type: S.JSON, allowNull: true },
            after: { type: S.JSON, allowNull: true },
            proposal_id: { type: S.INTEGER, allowNull: true },
            created_at: {
                type: S.DATE,
                allowNull: false,
                defaultValue: S.literal('CURRENT_TIMESTAMP'),
            },
            reverted_at: { type: S.DATE, allowNull: true },
        });
        await safeAddIndex(queryInterface, 'ltd_goal_metrics', ['goal_id']);
        await safeAddIndex(queryInterface, 'ltd_metric_checkins', [
            'metric_id',
        ]);
        await safeAddIndex(queryInterface, 'ltd_journal', ['user_id']);
        await safeAddIndex(queryInterface, 'ltd_journal', ['entity_uid']);
    },
    async down() {
        // Additive migration: rollback must not drop user data or rebuild goals.
        throw new Error(
            'Life-to-Day planning migration is additive; restore a backup to roll back.'
        );
    },
};
