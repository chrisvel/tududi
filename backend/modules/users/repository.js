'use strict';

const BaseRepository = require('../../shared/database/BaseRepository');
const { User, Role, ApiToken } = require('../../models');

const PROFILE_ATTRIBUTES = [
    'uid',
    'email',
    'name',
    'surname',
    'appearance',
    'language',
    'timezone',
    'first_day_of_week',
    'avatar_image',
    'telegram_bot_token',
    'telegram_chat_id',
    'telegram_allowed_users',
    'task_summary_enabled',
    'task_summary_frequency',
    'task_intelligence_enabled',
    'auto_suggest_next_actions_enabled',
    'pomodoro_enabled',
    'today_settings',
    'sidebar_settings',
    'productivity_assistant_enabled',
    'next_task_suggestion_enabled',
    'notification_preferences',
    'keyboard_shortcuts',
];

const PROFILE_UPDATE_ATTRIBUTES = [
    'uid',
    'email',
    'name',
    'surname',
    'appearance',
    'language',
    'timezone',
    'avatar_image',
    'telegram_bot_token',
    'telegram_chat_id',
    'telegram_allowed_users',
    'task_intelligence_enabled',
    'task_summary_enabled',
    'task_summary_frequency',
    'auto_suggest_next_actions_enabled',
    'productivity_assistant_enabled',
    'next_task_suggestion_enabled',
    'pomodoro_enabled',
    'notification_preferences',
    'keyboard_shortcuts',
];

class UsersRepository extends BaseRepository {
    constructor() {
        super(User);
    }

    /**
     * Find all users with basic attributes.
     */
    async findAllBasic() {
        return this.model.findAll({
            attributes: ['id', 'email', 'name', 'surname'],
            order: [['email', 'ASC']],
        });
    }

    /**
     * Find all roles.
     */
    async findAllRoles() {
        return Role.findAll({
            attributes: ['user_id', 'is_admin'],
        });
    }

    /**
     * Find user profile by ID.
     */
    async findProfileById(userId) {
        return this.model.findByPk(userId, {
            attributes: PROFILE_ATTRIBUTES,
        });
    }

    /**
     * Find user with password digest.
     */
    async findByIdWithPassword(userId) {
        return this.model.findByPk(userId);
    }

    /**
     * Find updated user profile.
     */
    async findUpdatedProfile(userId) {
        return this.model.findByPk(userId, {
            attributes: PROFILE_UPDATE_ATTRIBUTES,
        });
    }

    /**
     * Find all API tokens for a user.
     */
    async findApiTokens(userId) {
        return ApiToken.findAll({
            where: { user_id: userId },
            order: [['created_at', 'DESC']],
        });
    }
}

module.exports = new UsersRepository();
module.exports.PROFILE_ATTRIBUTES = PROFILE_ATTRIBUTES;
module.exports.PROFILE_UPDATE_ATTRIBUTES = PROFILE_UPDATE_ATTRIBUTES;
