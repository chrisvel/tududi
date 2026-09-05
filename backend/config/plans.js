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
            ai_requests_per_day: 0,
        },
        features: {
            ai: false,
            mcp: false,
            caldav: false,
            backups_import: false,
            telegram: false,
            attachments: true,
        },
    },
    pro: {
        name: 'Pro',
        limits: {
            max_tasks: null,
            max_projects: null,
            max_notes: null,
            storage_mb: 5000,
            ai_requests_per_day: 200,
        },
        features: {
            ai: true,
            mcp: true,
            caldav: true,
            backups_import: true,
            telegram: true,
            attachments: true,
        },
    },
};

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
