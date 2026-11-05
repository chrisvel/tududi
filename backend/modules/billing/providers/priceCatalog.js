'use strict';

const { getPlans } = require('../../../config/plans');

// The prices a provider sells, by plan: { pro: { month, year }, team_5: … }.
// Pro comes from its own two settings and Team plans from one JSON map, so
// both providers read their config the same way. A team key that is not in
// the plan catalog, or has neither interval, is left out.
function buildCatalog({ proMonthly, proAnnual, team } = {}) {
    const plans = getPlans();
    const catalog = {
        pro: { month: proMonthly || null, year: proAnnual || null },
    };
    for (const [key, ids] of Object.entries(team || {})) {
        if (!key.startsWith('team_') || !plans[key] || !ids) continue;
        const month = ids.month ? String(ids.month) : null;
        const year = ids.year ? String(ids.year) : null;
        if (month || year) catalog[key] = { month, year };
    }
    return catalog;
}

// Which plan and interval a price or variant id belongs to, or nulls.
function lookupPrice(catalog, priceId) {
    const id = priceId == null ? null : String(priceId);
    if (id) {
        for (const [plan, prices] of Object.entries(catalog)) {
            if (id === prices.month) return { plan, interval: 'month' };
            if (id === prices.year) return { plan, interval: 'year' };
        }
    }
    return { plan: null, interval: null };
}

module.exports = { buildCatalog, lookupPrice };
