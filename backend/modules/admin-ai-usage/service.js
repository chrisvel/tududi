'use strict';

const repository = require('./repository');
const { getPlans } = require('../../config/plans');
const { monthKey } = require('../../services/entitlementsService');
const { isAdmin } = require('../../services/rolesService');
const { ForbiddenError } = require('../../shared/errors');

class AdminAiUsageService {
    async assertAdmin(requesterId) {
        if (!(await isAdmin(requesterId))) {
            throw new ForbiddenError('Forbidden');
        }
    }

    async list(requesterId, query) {
        await this.assertAdmin(requesterId);

        const period = monthKey();
        const page = Number(query.page) || 1;
        const limit = Math.min(Number(query.limit) || 50, 200);

        const [total_credits_used_this_month, { rows, count }] =
            await Promise.all([
                repository.summaryTotal(period),
                repository.listUsers({ q: query.q, page, limit }),
            ]);

        const usageByUserId = await repository.usageByUserIds(
            rows.map((u) => u.id),
            period
        );
        const plans = getPlans();

        return {
            summary: { total_credits_used_this_month },
            total: count,
            users: rows.map((u) => {
                const plan = u.BillingAccount?.plan || 'free';
                const limit = plans[plan]?.limits?.ai_credits_per_month ?? 0;
                const used = usageByUserId.get(u.id) || 0;
                return {
                    id: u.id,
                    email: u.email,
                    name: u.name,
                    plan,
                    ai_credits_used_this_month: used,
                    ai_credits_limit: limit,
                    ai_credits_remaining:
                        limit === null ? null : Math.max(0, limit - used),
                };
            }),
        };
    }
}

module.exports = new AdminAiUsageService();
