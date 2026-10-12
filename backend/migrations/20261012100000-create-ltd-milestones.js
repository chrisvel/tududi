'use strict';
const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

// Life-to-Day (T-601): life events and goal milestones on the Life timeline
// (blueprint 13.3). Purely additive; `date` is always an ISO Gregorian day.
module.exports = {
    async up(queryInterface, S) {
        await safeCreateTable(queryInterface, 'ltd_milestones', {
            id: { type: S.INTEGER, primaryKey: true, autoIncrement: true },
            uid: { type: S.STRING, allowNull: false, unique: true },
            user_id: {
                type: S.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            title: { type: S.STRING, allowNull: false },
            date: { type: S.DATEONLY, allowNull: false },
            date_precision: {
                type: S.ENUM('day', 'month', 'year'),
                allowNull: false,
                defaultValue: 'day',
            },
            kind: {
                type: S.ENUM('life_event', 'goal_milestone'),
                allowNull: false,
                defaultValue: 'life_event',
            },
            goal_id: {
                type: S.INTEGER,
                allowNull: true,
                references: { model: 'goals', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            note: { type: S.TEXT, allowNull: true },
            color: { type: S.STRING, allowNull: true },
            created_at: { type: S.DATE, allowNull: false },
            updated_at: { type: S.DATE, allowNull: false },
        });
        await safeAddIndex(queryInterface, 'ltd_milestones', [
            'user_id',
            'date',
        ]);
        await safeAddIndex(queryInterface, 'ltd_milestones', ['goal_id']);
    },
    async down() {
        throw new Error(
            'Life-to-Day milestones migration is additive; restore a backup to roll back.'
        );
    },
};
