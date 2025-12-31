'use strict';

const BaseRepository = require('../../shared/database/BaseRepository');
const { Notification } = require('../../models');

class NotificationsRepository extends BaseRepository {
    constructor() {
        super(Notification);
    }

    async getUserNotifications(userId, options) {
        return Notification.getUserNotifications(userId, options);
    }

    async getUnreadCount(userId) {
        return Notification.getUnreadCount(userId);
    }

    async markAllAsRead(userId) {
        return Notification.markAllAsRead(userId);
    }

    async findByIdAndUser(id, userId, options = {}) {
        return this.model.findOne({
            where: { id, user_id: userId, ...options },
        });
    }
}

module.exports = new NotificationsRepository();
