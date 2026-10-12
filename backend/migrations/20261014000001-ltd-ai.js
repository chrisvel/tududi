'use strict';
const {
    safeCreateTable,
    safeAddColumns,
    safeAddIndex,
} = require('../utils/migration-utils');
module.exports = {
    async up(q, S) {
        await safeAddColumns(
            q,
            'users',
            ['provider_type', 'model_fast', 'model_smart'].map((name) => ({
                name,
                definition: { type: S.STRING, allowNull: true },
            }))
        );
        await safeCreateTable(q, 'ltd_ai_runs', {
            id: { type: S.INTEGER, primaryKey: true, autoIncrement: true },
            user_id: {
                type: S.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            feature: { type: S.STRING, allowNull: false },
            provider: { type: S.STRING, allowNull: false },
            model: { type: S.STRING, allowNull: false },
            tokens_in: { type: S.INTEGER, allowNull: false },
            tokens_out: { type: S.INTEGER, allowNull: false },
            latency_ms: { type: S.INTEGER, allowNull: false },
            status: { type: S.STRING, allowNull: false },
            proposal_id: {
                type: S.INTEGER,
                allowNull: true,
                references: { model: 'ltd_proposals', key: 'id' },
                onDelete: 'SET NULL',
            },
            prompt_hash: { type: S.STRING(64), allowNull: false },
            created_at: { type: S.DATE, allowNull: false },
        });
        await safeAddIndex(q, 'ltd_ai_runs', ['user_id', 'created_at']);
    },
    async down() {
        throw new Error('Additive migration; restore a backup to roll back');
    },
};
