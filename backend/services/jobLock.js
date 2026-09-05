const crypto = require('crypto');
const { sequelize } = require('../models');
const { isPostgres } = require('../utils/db-dialect');
const { logError, logInfo } = require('./logService');

// Background jobs (task summaries, due-task notifications, CalDAV sync,
// Telegram polling) used to run in every process. With two app containers
// that means duplicate notifications and stolen Telegram updates. On
// PostgreSQL an advisory lock makes exactly one process run each job; on
// SQLite there is only ever one process, so a local mutex is enough.

// Stable 32-bit key for pg advisory locks, derived from the job name.
const lockKey = (name) =>
    crypto.createHash('sha256').update(name).digest().readInt32BE(0);

const runningLocally = new Set();

// Runs `fn` if no other process (or this one) is already running the job
// named `name`. Returns { ran: true, result } or { ran: false }.
async function withJobLock(name, fn) {
    if (runningLocally.has(name)) {
        return { ran: false };
    }

    if (!isPostgres()) {
        runningLocally.add(name);
        try {
            return { ran: true, result: await fn() };
        } finally {
            runningLocally.delete(name);
        }
    }

    // A transaction-scoped advisory lock releases itself when the
    // transaction ends, even if the process dies mid-job.
    const tx = await sequelize.transaction();
    try {
        const [[{ locked }]] = await sequelize.query(
            'SELECT pg_try_advisory_xact_lock(:key) AS locked',
            { replacements: { key: lockKey(name) }, transaction: tx }
        );
        if (!locked) {
            await tx.rollback();
            return { ran: false };
        }

        runningLocally.add(name);
        try {
            const result = await fn();
            return { ran: true, result };
        } finally {
            runningLocally.delete(name);
            await tx.rollback();
        }
    } catch (error) {
        if (!tx.finished) {
            await tx.rollback().catch(() => {});
        }
        throw error;
    }
}

// Long-lived leadership for jobs that must not switch processes between
// runs (the Telegram poller keeps per-bot update offsets in memory). The
// lock is held by an open transaction for as long as the process lives.
const leaderTransactions = new Map();

async function tryBecomeLeader(name) {
    if (leaderTransactions.has(name)) {
        return true;
    }

    if (!isPostgres()) {
        leaderTransactions.set(name, null);
        return true;
    }

    const tx = await sequelize.transaction();
    try {
        const [[{ locked }]] = await sequelize.query(
            'SELECT pg_try_advisory_xact_lock(:key) AS locked',
            { replacements: { key: lockKey(name) }, transaction: tx }
        );
        if (!locked) {
            await tx.rollback();
            return false;
        }
        leaderTransactions.set(name, tx);
        logInfo(`This process is now the leader for "${name}"`);
        return true;
    } catch (error) {
        await tx.rollback().catch(() => {});
        logError(`Failed to acquire leader lock for "${name}":`, error);
        return false;
    }
}

async function releaseLeadership(name) {
    const tx = leaderTransactions.get(name);
    leaderTransactions.delete(name);
    if (tx && !tx.finished) {
        await tx.rollback().catch(() => {});
    }
}

function isLeader(name) {
    return leaderTransactions.has(name);
}

module.exports = {
    withJobLock,
    tryBecomeLeader,
    releaseLeadership,
    isLeader,
    _lockKey: lockKey,
};
