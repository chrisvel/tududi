'use strict';
const { DataTypes: S } = require('sequelize');
// Life-to-Day (T-901): one Google Calendar connection per user. The refresh
// token is stored only through secretCipher and never serialized.
module.exports = (sequelize) =>
    sequelize.define(
        'LtdGcalAccount',
        {
            id: { type: S.INTEGER, primaryKey: true, autoIncrement: true },
            user_id: {
                type: S.INTEGER,
                allowNull: false,
                unique: true,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            google_sub: { type: S.STRING, allowNull: true },
            refresh_token_enc: { type: S.TEXT, allowNull: false },
            scopes: { type: S.TEXT, allowNull: false },
            target_calendar_id: { type: S.STRING, allowNull: true },
            // JSON map of calendarId -> nextSyncToken.
            sync_token: { type: S.TEXT, allowNull: true },
            status: { type: S.STRING, allowNull: false },
            last_sync_at: { type: S.DATE, allowNull: true },
            last_error: { type: S.STRING, allowNull: true },
        },
        {
            tableName: 'ltd_gcal_accounts',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );
