'use strict';
const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

// Life-to-Day (T-1102): life lessons, their links and review checks
// (blueprint 13.3, 14.7). Purely additive; days are ISO Gregorian.
module.exports = {
    async up(q, S) {
        await safeCreateTable(q, 'ltd_lessons', {
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
            expected: { type: S.TEXT, allowNull: true },
            happened: { type: S.TEXT, allowNull: true },
            if_text: { type: S.TEXT, allowNull: true },
            then_text: { type: S.TEXT, allowNull: true },
            learned_on: { type: S.DATEONLY, allowNull: false },
            source_type: {
                type: S.ENUM('free', 'milestone', 'task', 'goal'),
                allowNull: true,
            },
            source_uid: { type: S.STRING, allowNull: true },
            status: {
                type: S.ENUM('active', 'parked', 'retired'),
                allowNull: false,
                defaultValue: 'active',
            },
            review_on: { type: S.DATEONLY, allowNull: true },
            created_at: { type: S.DATE, allowNull: false },
            updated_at: { type: S.DATE, allowNull: false },
        });
        await safeAddIndex(q, 'ltd_lessons', ['user_id', 'status']);
        await safeAddIndex(q, 'ltd_lessons', ['user_id', 'review_on']);

        const lesson = {
            type: S.INTEGER,
            allowNull: false,
            references: { model: 'ltd_lessons', key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        };
        await safeCreateTable(q, 'ltd_lesson_links', {
            id: { type: S.INTEGER, primaryKey: true, autoIncrement: true },
            lesson_id: lesson,
            target_type: {
                type: S.ENUM('goal', 'project', 'area', 'tag'),
                allowNull: false,
            },
            target_id: { type: S.INTEGER, allowNull: false },
        });
        await safeAddIndex(
            q,
            'ltd_lesson_links',
            ['lesson_id', 'target_type', 'target_id'],
            { unique: true, name: 'ltd_lesson_links_target_unique' }
        );
        await safeAddIndex(q, 'ltd_lesson_links', ['target_type', 'target_id']);

        await safeCreateTable(q, 'ltd_lesson_checks', {
            id: { type: S.INTEGER, primaryKey: true, autoIncrement: true },
            uid: { type: S.STRING, allowNull: false, unique: true },
            lesson_id: lesson,
            checked_on: { type: S.DATEONLY, allowNull: false },
            verdict: {
                type: S.ENUM('holds', 'not_yet', 'park'),
                allowNull: false,
            },
            note: { type: S.TEXT, allowNull: true },
            created_at: { type: S.DATE, allowNull: false },
        });
        await safeAddIndex(q, 'ltd_lesson_checks', ['lesson_id']);
    },
    async down() {
        throw new Error(
            'Life-to-Day lessons migration is additive; restore a backup to roll back.'
        );
    },
};
