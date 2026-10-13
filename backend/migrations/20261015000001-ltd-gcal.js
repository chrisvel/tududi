'use strict';
// Life-to-Day (T-901): Google Calendar account and the external event read
// model (blueprint 13.3). Times are UTC plus an IANA zone; all-day is a date.
const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');
const user = (S) => ({
    type: S.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE',
});
module.exports = {
    async up(q, S) {
        await safeCreateTable(q, 'ltd_gcal_accounts', {
            id: { type: S.INTEGER, primaryKey: true, autoIncrement: true },
            user_id: { ...user(S), unique: true },
            google_sub: { type: S.STRING, allowNull: true },
            refresh_token_enc: { type: S.TEXT, allowNull: false },
            scopes: { type: S.TEXT, allowNull: false },
            target_calendar_id: { type: S.STRING, allowNull: true },
            sync_token: { type: S.TEXT, allowNull: true },
            status: { type: S.STRING, allowNull: false },
            last_sync_at: { type: S.DATE, allowNull: true },
            last_error: { type: S.STRING, allowNull: true },
            created_at: { type: S.DATE, allowNull: false },
            updated_at: { type: S.DATE, allowNull: false },
        });
        await safeCreateTable(q, 'ltd_external_event_links', {
            id: { type: S.INTEGER, primaryKey: true, autoIncrement: true },
            user_id: user(S),
            source: { type: S.STRING, allowNull: false },
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
            updated_at: { type: S.DATE, allowNull: false },
        });
        await safeAddIndex(
            q,
            'ltd_external_event_links',
            ['user_id', 'calendar_id', 'event_id'],
            { unique: true, name: 'ltd_external_event_links_event_unique' }
        );
    },
    async down() {
        throw new Error('Additive migration; restore a backup to roll back');
    },
};
