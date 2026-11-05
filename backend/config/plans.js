'use strict';

// Plan catalog for hosted mode. Limits are per user; null means unlimited.
// Feature keys gate whole capabilities. TUDUDI_PLANS_JSON (a JSON object
// with the same shape) is deep-merged over these defaults, so an operator
// can change a number without a code change.

const DEFAULT_PLANS = {
    free: {
        name: 'Free',
        limits: {
            max_tasks: 200,
            max_projects: 10,
            max_notes: 50,
            storage_mb: 50,
            ai_requests_per_month: 0,
            ai_credits_per_month: 0,
            // Members an owner may add; a Team plan sets it to its seats minus one.
            max_members: 0,
        },
        features: {
            ai: false,
            mcp: false,
            caldav: false,
            backups_import: false,
            telegram: false,
            attachments: true,
            public_notes: true,
            webhooks: false,
        },
    },
    pro: {
        name: 'Pro',
        limits: {
            max_tasks: null,
            max_projects: null,
            max_notes: null,
            storage_mb: 5000,
            ai_requests_per_month: 200,
            ai_credits_per_month: 50,
            // One person. Members come with a Team plan.
            max_members: 0,
        },
        features: {
            ai: true,
            mcp: true,
            caldav: true,
            backups_import: true,
            telegram: true,
            attachments: true,
            public_notes: true,
            webhooks: true,
        },
    },
    // A new Cloud account before it pays: Pro, with a small AI budget (each
    // call costs money) and one member to try sharing with. Public notes
    // stay off, since they could host spam on our domain, and so do
    // webhooks, which send requests to any address from our servers.
    trial: {
        name: 'Pro',
        limits: {
            max_tasks: null,
            max_projects: null,
            max_notes: null,
            storage_mb: 5000,
            ai_requests_per_month: 30,
            ai_credits_per_month: 10,
            max_members: 1,
        },
        features: {
            ai: true,
            mcp: true,
            caldav: true,
            backups_import: true,
            telegram: true,
            attachments: true,
            public_notes: false,
            webhooks: false,
        },
    },
};

// Team plans are sold in fixed seat buckets, like monday.com: a team of four
// buys team_5 and may add a fifth person at no extra cost. Each bucket is
// Pro for everyone in it, and the owner holds one of the seats.
const TEAM_SEATS = [3, 5, 10, 15, 20, 25, 30, 40];

for (const seats of TEAM_SEATS) {
    DEFAULT_PLANS[`team_${seats}`] = {
        name: `Team (${seats} seats)`,
        seats,
        limits: { ...DEFAULT_PLANS.pro.limits, max_members: seats - 1 },
        features: { ...DEFAULT_PLANS.pro.features },
    };
}

const LIMIT_KEYS = Object.keys(DEFAULT_PLANS.free.limits);
const FEATURE_KEYS = Object.keys(DEFAULT_PLANS.free.features);

// What a self-hosted instance (hosted mode off) gets: no limits at all.
const UNLIMITED = Object.freeze({
    key: 'unlimited',
    name: 'Unlimited',
    limits: Object.freeze(
        Object.fromEntries(LIMIT_KEYS.map((key) => [key, null]))
    ),
    features: Object.freeze(
        Object.fromEntries(FEATURE_KEYS.map((key) => [key, true]))
    ),
});

function deepMerge(base, override) {
    if (!override || typeof override !== 'object' || Array.isArray(override)) {
        return base;
    }
    const out = { ...base };
    for (const [key, value] of Object.entries(override)) {
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            base[key] &&
            typeof base[key] === 'object'
        ) {
            out[key] = deepMerge(base[key], value);
        } else {
            out[key] = value;
        }
    }
    return out;
}

function parseOverrides(json) {
    if (!json) return null;
    try {
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('TUDUDI_PLANS_JSON must be a JSON object');
        }
        return parsed;
    } catch (error) {
        console.error(
            `Ignoring TUDUDI_PLANS_JSON: ${error.message}. Using default plans.`
        );
        return null;
    }
}

let cache = null;
let cachedFrom;

function getPlans(env = process.env) {
    const json = env.TUDUDI_PLANS_JSON || '';
    if (cache && cachedFrom === json) return cache;

    const merged = deepMerge(DEFAULT_PLANS, parseOverrides(json));
    const plans = {};
    for (const [key, plan] of Object.entries(merged)) {
        plans[key] = {
            key,
            name: plan.name || key,
            seats: plan.seats || 1,
            limits: { ...UNLIMITED.limits, ...(plan.limits || {}) },
            features: {
                ...Object.fromEntries(FEATURE_KEYS.map((k) => [k, false])),
                ...(plan.features || {}),
            },
        };
    }
    cache = plans;
    cachedFrom = json;
    return plans;
}

function getPlan(key, env = process.env) {
    return getPlans(env)[key] || null;
}

module.exports = {
    DEFAULT_PLANS,
    TEAM_SEATS,
    UNLIMITED,
    LIMIT_KEYS,
    FEATURE_KEYS,
    getPlans,
    getPlan,
    _resetCache: () => {
        cache = null;
        cachedFrom = undefined;
    },
};
