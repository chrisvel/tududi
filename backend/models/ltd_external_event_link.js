'use strict';
const { DataTypes: S } = require('sequelize');
// Life-to-Day (T-901, T-903): Google events as an external read model.
// entity_type 'busy' is an imported busy span (no title is stored);
// 'block' is a Life-to-Day block written to the dedicated calendar.
module.exports = (sequelize) =>
    sequelize.define(
        'LtdExternalEventLink',
        {
            id: { type: S.INTEGER, primaryKey: true, autoIncrement: true },
            user_id: {
                type: S.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            source: { type: S.STRING, allowNull: false, defaultValue: 'gcal' },
            calendar_id: { type: S.STRING, allowNull: false },
            event_id: { type: S.STRING, allowNull: false },
            etag: { type: S.STRING, allowNull: true },
            entity_type: { type: S.STRING, allowNull: false },
            entity_uid: { type: S.STRING, allowNull: true },
            last_hash: { type: S.STRING(64), allowNull: true },
            start_at: { type: S.DATE, allowNull: true },
            end_at: { type: S.DATE, allowNull: true },
            time_zone: { type: S.STRING, allowNull: true },
            start_date: { type: S.DATEONLY, allowNull: true },
            end_date: { type: S.DATEONLY, allowNull: true },
        },
        {
            tableName: 'ltd_external_event_links',
            createdAt: false,
            updatedAt: 'updated_at',
            indexes: [
                {
                    unique: true,
                    name: 'ltd_external_event_links_event_unique',
                    fields: ['user_id', 'calendar_id', 'event_id'],
                },
            ],
        }
    );
