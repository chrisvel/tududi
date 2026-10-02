'use strict';

const crypto = require('crypto');
const { PushSubscription } = require('../../models');

const hashEndpoint = (endpoint) =>
    crypto.createHash('sha256').update(endpoint, 'utf8').digest('hex');

class PushRepository {
    hashEndpoint(endpoint) {
        return hashEndpoint(endpoint);
    }

    async findByEndpoint(endpoint) {
        return PushSubscription.findOne({
            where: { endpoint_hash: hashEndpoint(endpoint) },
        });
    }

    async listForUser(userId) {
        return PushSubscription.findAll({
            where: { user_id: userId },
            order: [['id', 'ASC']],
        });
    }

    async countForUser(userId) {
        return PushSubscription.count({ where: { user_id: userId } });
    }

    async create(attrs) {
        return PushSubscription.create({
            ...attrs,
            endpoint_hash: hashEndpoint(attrs.endpoint),
        });
    }

    async update(subscription, attrs) {
        return subscription.update(attrs);
    }

    async deleteForUser(userId, endpoint) {
        return PushSubscription.destroy({
            where: { user_id: userId, endpoint_hash: hashEndpoint(endpoint) },
        });
    }

    async deleteById(id) {
        return PushSubscription.destroy({ where: { id } });
    }
}

module.exports = new PushRepository();
