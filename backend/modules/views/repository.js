'use strict';

const BaseRepository = require('../../shared/database/BaseRepository');
const { View } = require('../../models');

class ViewsRepository extends BaseRepository {
    constructor() {
        super(View);
    }

    async findAllByUser(userId) {
        return this.model.findAll({
            where: { user_id: userId },
            order: [
                ['is_pinned', 'DESC'],
                ['created_at', 'DESC'],
            ],
        });
    }

    async findPinnedByUser(userId) {
        return this.model.findAll({
            where: { user_id: userId, is_pinned: true },
            order: [['created_at', 'DESC']],
        });
    }

    async findByUidAndUser(uid, userId) {
        return this.model.findOne({
            where: { uid, user_id: userId },
        });
    }

    async createForUser(userId, data) {
        return this.model.create({ ...data, user_id: userId });
    }
}

module.exports = new ViewsRepository();
