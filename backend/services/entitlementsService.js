const { Op } = require('sequelize');
const { getConfig } = require('../config/config');
const { getPlans, UNLIMITED } = require('../config/plans');
const { isAdmin } = require('./rolesService');
const { PlanLimitError, FeatureNotInPlanError } = require('../shared/errors');

// What a user may do right now, derived from their billing account and the
// plan catalog. With hosted mode off every function answers "unlimited"
// before touching the database, so self-hosted installs pay nothing for
// these checks.

const CACHE_TTL_MS = 30 * 1000;
const cache = new Map();

const ACTIVE_TASK_STATUSES_EXCLUDED = [2, 3, 5]; // done, archived, cancelled

const RESOURCE_LIMIT = {
    task: 'max_tasks',
    project: 'max_projects',
    note: 'max_notes',
};

function isHostedMode() {
    return getConfig().hosted?.enabled === true;
}

function models() {
    return require('../models');
}

// Pure: which plan applies, and why. `account` may be null (no row yet).
function resolvePlan(
    account,
    user,
    { isAdmin: admin = false, now = new Date() } = {}
) {
    const config = getConfig();
    if (!config.hosted?.enabled) {
        return { plan: UNLIMITED, reason: 'hosted_off', status: 'none' };
    }

    const plans = getPlans();
    const pro = plans.pro;
    const free = plans.free;
    const status = account?.status || 'none';
    const graceMs = (config.hosted.graceDays || 0) * 24 * 60 * 60 * 1000;

    if (admin && config.hosted.exemptAdmins !== false) {
        return { plan: pro, reason: 'admin', status };
    }

    if (account?.override_plan) {
        const expires = account.override_expires_at
            ? new Date(account.override_expires_at)
            : null;
        if (!expires || expires > now) {
            const overridden = plans[account.override_plan] || pro;
            return { plan: overridden, reason: 'override', status };
        }
    }

    if (status === 'active' || status === 'trialing') {
        return {
            plan: plans[account.plan] || pro,
            reason: 'subscription',
            status,
        };
    }

    if (status === 'past_due' && account?.current_period_end) {
        const graceUntil = new Date(
            new Date(account.current_period_end).getTime() + graceMs
        );
        if (graceUntil > now) {
            return {
                plan: plans[account.plan] || pro,
                reason: 'grace',
                status,
                graceUntil,
            };
        }
    }

    const trialEnd = account?.trial_ends_at
        ? new Date(account.trial_ends_at)
        : null;
    if (trialEnd && trialEnd > now) {
        return { plan: pro, reason: 'trial', status, trialEndsAt: trialEnd };
    }

    return { plan: free, reason: 'free', status };
}

async function ensureAccount(userId) {
    const { BillingAccount, User } = models();
    const existing = await BillingAccount.findOne({
        where: { user_id: userId },
    });
    if (existing) return existing;

    const user = await User.findByPk(userId, {
        attributes: ['id', 'created_at'],
    });
    if (!user) return null;

    const trialDays = getConfig().hosted.trialDays || 0;
    const createdAt = user.created_at ? new Date(user.created_at) : new Date();
    const trialEndsAt =
        trialDays > 0
            ? new Date(createdAt.getTime() + trialDays * 24 * 60 * 60 * 1000)
            : null;

    const [account] = await BillingAccount.findOrCreate({
        where: { user_id: userId },
        defaults: { user_id: userId, trial_ends_at: trialEndsAt },
    });
    return account;
}

async function getEntitlements(userId, { includeUsage = false } = {}) {
    if (!isHostedMode()) {
        return {
            hosted: false,
            plan: UNLIMITED.key,
            planName: UNLIMITED.name,
            status: 'none',
            reason: 'hosted_off',
            limits: UNLIMITED.limits,
            features: UNLIMITED.features,
            usage: includeUsage ? await getUsage(userId) : undefined,
        };
    }

    const cached = cache.get(userId);
    let resolved = cached && cached.expires > Date.now() ? cached.value : null;

    if (!resolved) {
        const account = await ensureAccount(userId);
        const admin = await isAdmin(userId);
        const r = resolvePlan(account, null, { isAdmin: admin });
        resolved = {
            hosted: true,
            plan: r.plan.key,
            planName: r.plan.name,
            status: r.status,
            reason: r.reason,
            limits: r.plan.limits,
            features: r.plan.features,
            trial_ends_at: account?.trial_ends_at || null,
            current_period_end: account?.current_period_end || null,
            cancel_at_period_end: account?.cancel_at_period_end || false,
            grace_until: r.graceUntil || null,
            override: account?.override_plan
                ? {
                      plan: account.override_plan,
                      expires_at: account.override_expires_at,
                      reason: account.override_reason,
                  }
                : null,
        };
        cache.set(userId, {
            value: resolved,
            expires: Date.now() + CACHE_TTL_MS,
        });
    }

    return includeUsage
        ? { ...resolved, usage: await getUsage(userId) }
        : resolved;
}

function invalidate(userId) {
    if (userId === undefined) cache.clear();
    else cache.delete(userId);
}

async function hasFeature(userId, feature) {
    if (!isHostedMode()) return true;
    const ent = await getEntitlements(userId);
    return ent.features[feature] !== false;
}

async function assertFeature(userId, feature) {
    if (!isHostedMode()) return;
    const ent = await getEntitlements(userId);
    if (ent.features[feature] === false) {
        throw new FeatureNotInPlanError(feature, ent.plan);
    }
}

async function countResource(userId, resource) {
    const { Task, Project, Note } = models();
    if (resource === 'task') {
        return Task.count({
            where: {
                user_id: userId,
                status: { [Op.notIn]: ACTIVE_TASK_STATUSES_EXCLUDED },
            },
        });
    }
    if (resource === 'project') {
        return Project.count({ where: { user_id: userId } });
    }
    if (resource === 'note') {
        return Note.count({ where: { user_id: userId } });
    }
    throw new Error(`Unknown resource: ${resource}`);
}

// Throws when creating `n` more of `resource` would exceed the plan.
async function assertCanCreate(userId, resource, n = 1) {
    if (!isHostedMode()) return;
    const ent = await getEntitlements(userId);
    const limit = ent.limits[RESOURCE_LIMIT[resource]];
    if (limit === null || limit === undefined) return;

    const current = await countResource(userId, resource);
    if (current + n > limit) {
        throw new PlanLimitError(resource, limit, current, ent.plan);
    }
}

async function storageBytesUsed(userId) {
    const { TaskAttachment } = models();
    const total = await TaskAttachment.sum('file_size', {
        where: { user_id: userId },
    });
    return Number(total) || 0;
}

async function assertStorage(userId, additionalBytes) {
    if (!isHostedMode()) return;
    const ent = await getEntitlements(userId);
    const limitMb = ent.limits.storage_mb;
    if (limitMb === null || limitMb === undefined) return;

    const used = await storageBytesUsed(userId);
    const limitBytes = limitMb * 1024 * 1024;
    if (used + additionalBytes > limitBytes) {
        throw new PlanLimitError('storage', limitBytes, used, ent.plan);
    }
}

function todayKey(now = new Date()) {
    return now.toISOString().slice(0, 10);
}

// Atomically records one use of a per-day metric and throws when the
// day's budget is exhausted. Returns the new count.
async function consumeUsage(userId, metric, n = 1) {
    if (!isHostedMode()) return 0;
    const ent = await getEntitlements(userId);
    const limitKey = `${metric}_per_day`;
    const limit = ent.limits[limitKey];

    const { UsageCounter } = models();
    const period = todayKey();
    const [row] = await UsageCounter.findOrCreate({
        where: { user_id: userId, metric, period_key: period },
        defaults: { user_id: userId, metric, period_key: period, count: 0 },
    });

    if (limit !== null && limit !== undefined && row.count + n > limit) {
        throw new PlanLimitError(metric, limit, row.count, ent.plan);
    }

    // increment() mutates the instance on PostgreSQL but not on SQLite, so
    // re-read rather than add locally.
    await row.increment('count', { by: n });
    await row.reload();
    return row.count;
}

async function getUsage(userId) {
    const { UsageCounter } = models();
    const [tasks, projects, notes, storage_bytes, ai] = await Promise.all([
        countResource(userId, 'task'),
        countResource(userId, 'project'),
        countResource(userId, 'note'),
        storageBytesUsed(userId),
        UsageCounter.findOne({
            where: {
                user_id: userId,
                metric: 'ai_requests',
                period_key: todayKey(),
            },
            attributes: ['count'],
            raw: true,
        }),
    ]);
    return {
        tasks,
        projects,
        notes,
        storage_bytes,
        ai_requests_today: ai ? ai.count : 0,
    };
}

module.exports = {
    isHostedMode,
    resolvePlan,
    ensureAccount,
    getEntitlements,
    invalidate,
    hasFeature,
    assertFeature,
    assertCanCreate,
    assertStorage,
    consumeUsage,
    getUsage,
};
