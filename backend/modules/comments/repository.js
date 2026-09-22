'use strict';

const { Comment } = require('../../models');
const BaseRepository = require('../../shared/database/BaseRepository');

class CommentsRepository extends BaseRepository {
    constructor() {
        super(Comment);
    }

    async listForTask(taskId) {
        const { User } = require('../../models');
        return this.model.findAll({
            where: { task_id: taskId },
            include: [
                {
                    model: User,
                    as: 'Author',
                    attributes: ['id', 'uid', 'name', 'email'],
                },
            ],
            order: [['created_at', 'ASC']],
        });
    }

    async findByUid(uid) {
        const { User } = require('../../models');
        return this.model.findOne({
            where: { uid },
            include: [
                {
                    model: User,
                    as: 'Author',
                    attributes: ['id', 'uid', 'name', 'email'],
                },
            ],
        });
    }

    async createForTask(
        taskId,
        userId,
        { body, mentionedPersonUids, parentCommentId = null }
    ) {
        return this.model.create({
            task_id: taskId,
            user_id: userId,
            body,
            mentioned_person_uids: mentionedPersonUids,
            parent_comment_id: parentCommentId,
        });
    }
}

module.exports = new CommentsRepository();
