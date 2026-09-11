'use strict';

const BaseRepository = require('../../shared/database/BaseRepository');
const { WebhookEndpoint } = require('../../models');

class WebhooksRepository extends BaseRepository {
    constructor() {
        super(WebhookEndpoint);
    }

    async findByUidAndUser(uid, userId) {
        return this.model.findOne({ where: { uid, user_id: userId } });
    }

    async listForUser(userId) {
        return this.model.findAll({
            where: { user_id: userId },
            order: [['created_at', 'DESC']],
        });
    }

    async findActiveForUserAndType(userId, type) {
        const endpoints = await this.model.findAll({
            where: { user_id: userId, active: true },
        });
        return endpoints.filter((endpoint) => endpoint.matchesType(type));
    }
}

module.exports = new WebhooksRepository();
