'use strict';

// Migrations run on SQLite and PostgreSQL. Keep them dialect-safe: this one
// only reads rows and clears a column, so it needs no safe* helper, no PRAGMA
// and no dialect branch. Booleans come back as true/false on PostgreSQL and as
// 0/1 on SQLite, so the due_has_time check accepts both.
//
// What this repairs
// -----------------
// Until this release the CalDAV importer turned a VTODO `DTSTART` into
// `defer_until` unconditionally. Clients that send DTSTART together with DUE,
// set to the same value, for a task the user never gave a start date (2Do, and
// Apple Reminders/EventKit) therefore gave every synced task a defer date equal
// to its due date. A defer date in the future hides a task from Today and from
// the metrics until that day, so those tasks were invisible until their due
// date (#1906). The importer now ignores such a DTSTART; this clears the ones
// already stored.
//
// How a row is recognised
// -----------------------
// A task with no start date is indistinguishable locally from one whose
// DTSTART equalled DUE - there is no CalDAV column on `tasks`, and a task
// created by a client PUT carries no marker at all. So the repair keys off the
// value the old importer produced, which no other writer produces:
//
//   A. a whole-day due date, stored as the end of the day in the owner's
//      timezone, with the defer date at the start of that same day. That is
//      `DTSTART;VALUE=DATE` equal to a `DUE;VALUE=DATE`.
//   B. a defer date at the exact same instant as the due date while
//      `due_has_time` says the due date is a whole day. Tududi's own writers set
//      that flag whenever the user picks a due time, so a row contradicting its
//      own flag was written by a client, not by Tududi.
//
// Both are piles of evidence rather than proof: a user who explicitly picks
// 00:00 as the defer time on the due day gets case A too, and that value cannot
// be told apart from the importer's output. That is why every cleared id is
// logged, and why the repair is limited to rows whose defer date carries no
// information the due date does not already carry. The reminder of an affected
// row was computed from the same wrong base, but the trigger duration is not
// stored, so it cannot be recomputed here; the client rewrites it when it next
// pushes the task.
//
// Deliberately not repaired
// -------------------------
// Priority. The old mapping turned both "no PRIORITY" and "PRIORITY:7-9" into
// Low (0), and the fixed mapping still stores Low for 7-9 (Apple Reminders
// sends 9 for a user-chosen Low), so every stored 0 is ambiguous: clearing them
// would delete real priorities. Re-importing from the client is the only way to
// tell the two apart.

const moment = require('moment-timezone');

// SQLite hands booleans back as 0/1, PostgreSQL as true/false.
function isTrue(value) {
    return value === true || value === 1 || value === '1';
}

function safeTimezone(value) {
    return typeof value === 'string' && moment.tz.zone(value) ? value : 'UTC';
}

function isImportedDeferDate(row) {
    const due = moment.utc(row.due_date);
    const defer = moment.utc(row.defer_until);
    if (!due.isValid() || !defer.isValid()) {
        return false;
    }

    if (isTrue(row.due_has_time)) {
        return false;
    }

    // B: the same instant, on a row whose flag says the due date is a whole day.
    if (defer.isSame(due)) {
        return true;
    }

    // A: the whole day of the due date, start against end.
    const timezone = safeTimezone(row.timezone);
    const day = due.tz(timezone).format('YYYY-MM-DD');
    return (
        due.isSame(moment.tz(day, timezone).endOf('day')) &&
        defer.isSame(moment.tz(day, timezone).startOf('day'))
    );
}

module.exports = {
    async up(queryInterface, Sequelize) {
        const { sequelize } = queryInterface;
        const { QueryTypes } = Sequelize;

        const candidates = await sequelize.query(
            `SELECT t.id, t.due_date, t.defer_until, t.due_has_time, u.timezone AS timezone
             FROM tasks t
             JOIN users u ON u.id = t.user_id
             WHERE t.defer_until IS NOT NULL
               AND t.due_date IS NOT NULL
               AND t.defer_until <= t.due_date`,
            { type: QueryTypes.SELECT }
        );

        const cleared = candidates.filter(isImportedDeferDate);
        if (cleared.length === 0) {
            return;
        }

        const transaction = await sequelize.transaction();
        try {
            const chunkSize = 500;
            for (let i = 0; i < cleared.length; i += chunkSize) {
                const ids = cleared
                    .slice(i, i + chunkSize)
                    .map((row) => row.id);
                await sequelize.query(
                    'UPDATE tasks SET defer_until = NULL WHERE id IN (:ids)',
                    { replacements: { ids }, transaction }
                );
            }
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        console.log(
            `Cleared the CalDAV defer date on ${cleared.length} task(s): ${cleared
                .map((row) => row.id)
                .join(', ')}`
        );
    },

    async down() {
        // The cleared value was the due date's own day, so it is not restored:
        // every affected task can be deferred again from the UI if wanted.
    },
};
