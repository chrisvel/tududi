const { Op } = require('sequelize');
const { sequelize, RateLimit } = require('../models');
const { isPostgres } = require('../utils/db-dialect');
const { logError } = require('../services/logService');

// express-rate-limit Store backed by the rate_limits table. The default
// MemoryStore keeps counters per process, so limits multiply by the number
// of app processes and vanish on restart. One row per (limiter, client).
//
// increment() is a single upsert: a row past its reset time starts a new
// window at 1, anything else adds one, and both branches happen inside the
// database so concurrent processes never lose a hit.
class DatabaseRateLimitStore {
    constructor(prefix) {
        this.prefix = `${prefix}:`;
        this.windowMs = 60 * 1000;
        this.localKeys = false;
    }

    init(options) {
        this.windowMs = options.windowMs;
    }

    async increment(key) {
        const now = new Date();
        const reset = new Date(now.getTime() + this.windowMs);
        const [rows] = await sequelize.query(
            `INSERT INTO rate_limits (key, hits, reset_at, created_at, updated_at)
             VALUES (:key, 1, :reset, :now, :now)
             ON CONFLICT (key) DO UPDATE SET
                 hits = CASE WHEN rate_limits.reset_at <= :now THEN 1 ELSE rate_limits.hits + 1 END,
                 reset_at = CASE WHEN rate_limits.reset_at <= :now THEN :reset ELSE rate_limits.reset_at END,
                 updated_at = :now
             RETURNING hits, reset_at`,
            { replacements: { key: this.prefix + key, reset, now } }
        );
        const row = rows[0];
        return {
            totalHits: Number(row.hits),
            resetTime: new Date(row.reset_at),
        };
    }

    async get(key) {
        const row = await RateLimit.findByPk(this.prefix + key, { raw: true });
        if (!row || new Date(row.reset_at) <= new Date()) return undefined;
        return { totalHits: row.hits, resetTime: new Date(row.reset_at) };
    }

    async decrement(key) {
        await RateLimit.decrement('hits', {
            by: 1,
            where: { key: this.prefix + key, hits: { [Op.gt]: 0 } },
        });
    }

    async resetKey(key) {
        await RateLimit.destroy({ where: { key: this.prefix + key } });
    }

    async resetAll() {
        await RateLimit.destroy({
            where: { key: { [Op.like]: `${this.prefix}%` } },
        });
    }
}

// Returns a shared store when the database can host one, otherwise
// undefined so express-rate-limit falls back to its in-memory store.
function createRateLimitStore(prefix) {
    if (!isPostgres()) return undefined;
    return new DatabaseRateLimitStore(prefix);
}

async function cleanupExpiredRateLimits() {
    try {
        return await RateLimit.destroy({
            where: { reset_at: { [Op.lte]: new Date() } },
        });
    } catch (error) {
        logError('Failed to clean up expired rate limit rows:', error);
        return 0;
    }
}

module.exports = {
    DatabaseRateLimitStore,
    createRateLimitStore,
    cleanupExpiredRateLimits,
};
