'use strict';
const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');
// Life-to-Day (T-1201): a nullable task override, never a second budget.
module.exports = {
    async up(q, S) {
        await safeAddColumns(q, 'tasks', [
            {
                name: 'focus_minutes',
                definition: { type: S.INTEGER, allowNull: true },
            },
        ]);
        await safeAddIndex(q, 'ltd_focus_sessions', ['user_id', 'task_id']);
    },
    async down() {
        throw new Error(
            'Life-to-Day pomodoro migration is additive; restore a backup to roll back.'
        );
    },
};
