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

    // type is 'like' | 'dislike' | null (null removes the reaction).
    async setReaction(commentId, userId, type) {
        const { CommentReaction } = require('../../models');
        const existing = await CommentReaction.findOne({
            where: { comment_id: commentId, user_id: userId },
        });

        if (!type) {
            if (existing) await existing.destroy();
            return;
        }
        if (existing) {
            if (existing.reaction_type !== type) {
                await existing.update({ reaction_type: type });
            }
            return;
        }
        await CommentReaction.create({
            comment_id: commentId,
            user_id: userId,
            reaction_type: type,
        });
    }

    // { [commentId]: { like: n, dislike: n } } for every comment in the list.
    async countReactionsByComment(commentIds) {
        const { CommentReaction, sequelize } = require('../../models');
        if (commentIds.length === 0) return {};
        const rows = await CommentReaction.findAll({
            where: { comment_id: commentIds },
            attributes: [
                'comment_id',
                'reaction_type',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            ],
            group: ['comment_id', 'reaction_type'],
            raw: true,
        });
        const byComment = {};
        for (const row of rows) {
            byComment[row.comment_id] = byComment[row.comment_id] || {
                like: 0,
                dislike: 0,
            };
            byComment[row.comment_id][row.reaction_type] = Number(row.count);
        }
        return byComment;
    }

    // { [commentId]: 'like' | 'dislike' } for the given user, across the
    // given comments.
    async findMyReactionsByComment(commentIds, userId) {
        const { CommentReaction } = require('../../models');
        if (commentIds.length === 0) return {};
        const rows = await CommentReaction.findAll({
            where: { comment_id: commentIds, user_id: userId },
            attributes: ['comment_id', 'reaction_type'],
            raw: true,
        });
        const byComment = {};
        for (const row of rows) {
            byComment[row.comment_id] = row.reaction_type;
        }
        return byComment;
    }
}

module.exports = new CommentsRepository();
