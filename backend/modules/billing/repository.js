'use strict';

const { Op } = require('sequelize');
const {
    BillingAccount,
    BillingEvent,
    User,
    sequelize,
} = require('../../models');

class BillingRepository {
    findAccountByUserId(userId) {
        return BillingAccount.findOne({ where: { user_id: userId } });
    }

    findAccountByCustomerId(customerId) {
        return BillingAccount.findOne({
            where: { provider_customer_id: customerId },
        });
    }

    findAccountBySubscriptionId(subscriptionId) {
        return BillingAccount.findOne({
            where: { provider_subscription_id: subscriptionId },
        });
    }

    findUserByUid(uid) {
        return User.findOne({ where: { uid }, attributes: ['id', 'email'] });
    }

    findUserById(id) {
        return User.findByPk(id, {
            attributes: ['id', 'uid', 'email', 'name'],
        });
    }

    // Returns null when the event was seen before (unique violation).
    async recordEvent(providerEventId, type) {
        try {
            return await BillingEvent.create({
                provider_event_id: providerEventId,
                type,
                status: 'received',
            });
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') return null;
            throw error;
        }
    }

    async listAccounts({ q, page = 1, limit = 50 }) {
        const offset = (Math.max(1, page) - 1) * limit;
        const userWhere = q ? { email: { [Op.like]: `%${q}%` } } : undefined;
        const { rows, count } = await BillingAccount.findAndCountAll({
            include: [
                {
                    model: User,
                    as: 'User',
                    attributes: ['id', 'uid', 'email', 'name'],
                    where: userWhere,
                    required: true,
                },
            ],
            order: [['updated_at', 'DESC']],
            limit,
            offset,
        });
        return { rows, count };
    }

    async summary() {
        const rows = await BillingAccount.findAll({
            attributes: [
                'plan',
                'status',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            ],
            group: ['plan', 'status'],
            raw: true,
        });
        return rows.map((r) => ({
            plan: r.plan,
            status: r.status,
            count: Number(r.count),
        }));
    }
}

module.exports = new BillingRepository();
