'use strict';
const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

// Life-to-Day (T-701, T-704, T-706): Proposals (blueprint 13.3), the embedded
// OAuth server's storage and the per-user MCP controls. Purely additive.
module.exports = {
    async up(queryInterface, S) {
        await safeCreateTable(queryInterface, 'ltd_proposals', {
            id: { type: S.INTEGER, primaryKey: true, autoIncrement: true },
            uid: { type: S.STRING, allowNull: false, unique: true },
            user_id: {
                type: S.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            origin: {
                type: S.ENUM('in_app_ai', 'mcp', 'rule'),
                allowNull: false,
            },
            client_id: { type: S.STRING, allowNull: true },
            title: { type: S.STRING, allowNull: false },
            rationale: { type: S.TEXT, allowNull: true },
            ops: { type: S.JSON, allowNull: false },
            risk_tier: {
                type: S.ENUM('R0', 'R1', 'R2', 'R3'),
                allowNull: false,
            },
            status: {
                type: S.ENUM(
                    'pending',
                    'applied',
                    'partially_applied',
                    'rejected',
                    'expired',
                    'reverted'
                ),
                allowNull: false,
                defaultValue: 'pending',
            },
            expires_at: { type: S.DATE, allowNull: false },
            created_at: { type: S.DATE, allowNull: false },
            decided_at: { type: S.DATE, allowNull: true },
        });
        await safeAddIndex(queryInterface, 'ltd_proposals', [
            'user_id',
            'status',
        ]);

        await safeCreateTable(queryInterface, 'ltd_oauth_models', {
            key: { type: S.STRING, primaryKey: true },
            model: { type: S.STRING, allowNull: false },
            payload: { type: S.JSON, allowNull: false },
            grant_id: { type: S.STRING, allowNull: true },
            uid: { type: S.STRING, allowNull: true },
            account_id: { type: S.STRING, allowNull: true },
            client_id: { type: S.STRING, allowNull: true },
            expires_at: { type: S.DATE, allowNull: true },
            consumed_at: { type: S.DATE, allowNull: true },
            created_at: { type: S.DATE, allowNull: false },
        });
        await safeAddIndex(queryInterface, 'ltd_oauth_models', ['grant_id']);
        await safeAddIndex(queryInterface, 'ltd_oauth_models', ['uid']);
        await safeAddIndex(queryInterface, 'ltd_oauth_models', [
            'account_id',
            'model',
        ]);

        await safeCreateTable(queryInterface, 'ltd_mcp_settings', {
            user_id: {
                type: S.INTEGER,
                primaryKey: true,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE',
            },
            read_only: {
                type: S.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            tokens_revoked_at: { type: S.DATE, allowNull: true },
            clients: { type: S.JSON, allowNull: true },
            updated_at: { type: S.DATE, allowNull: false },
        });
    },
    async down() {
        throw new Error(
            'Life-to-Day MCP migration is additive; restore a backup to roll back.'
        );
    },
};
