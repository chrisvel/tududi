'use strict';

const { Op } = require('sequelize');
const { User, BillingAccount, UsageCounter } = require('../../models');

class AdminAiUsageRepository {
    // Total ai_credits consumed by every user for the given month, in one
    // aggregate query - the "all users combined" number for the admin page.
    async summaryTotal(periodKey) {
        const total = await UsageCounter.sum('count', {
            where: { metric: 'ai_credits', period_key: periodKey },
        });
        return Number(total) || 0;
    }

    async listUsers({ q, page = 1, limit = 50 }) {
        const offset = (Math.max(1, page) - 1) * limit;
        const where = q ? { email: { [Op.like]: `%${q}%` } } : undefined;
        const { rows, count } = await User.findAndCountAll({
            attributes: ['id', 'uid', 'email', 'name'],
            where,
            include: [
                {
                    model: BillingAccount,
                    as: 'BillingAccount',
                    attributes: ['plan'],
                    required: false,
                },
            ],
            order: [['email', 'ASC']],
            limit,
            offset,
        });
        return { rows, count };
    }

    // Per-user counts for one page's worth of users, keyed by user_id -
    // kept separate from listUsers() rather than a join, since aggregating
    // a filtered/paginated join portably across SQLite and Postgres is more
    // trouble than a second flat query.
    async usageByUserIds(userIds, periodKey) {
        if (userIds.length === 0) return new Map();
        const rows = await UsageCounter.findAll({
            where: {
                metric: 'ai_credits',
                period_key: periodKey,
                user_id: { [Op.in]: userIds },
            },
            attributes: ['user_id', 'count'],
            raw: true,
        });
        return new Map(rows.map((r) => [r.user_id, r.count]));
    }
}

module.exports = new AdminAiUsageRepository();
