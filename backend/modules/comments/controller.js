'use strict';

const commentsService = require('./service');

const commentsController = {
    /**
     * GET /api/task/:uid/comments
     */
    async list(req, res, next) {
        try {
            const comments = await commentsService.listComments(
                req.currentUser.id,
                req.params.uid
            );
            res.json({ comments });
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/task/:uid/comments
     */
    async create(req, res, next) {
        try {
            const {
                body,
                mentioned_person_uids: mentionedPersonUids,
                parent_comment_uid: parentCommentUid,
            } = req.body;
            const comment = await commentsService.addComment(
                req.currentUser.id,
                req.params.uid,
                { body, mentionedPersonUids, parentCommentUid }
            );
            res.status(201).json(comment);
        } catch (error) {
            next(error);
        }
    },

    /**
     * DELETE /api/comment/:uid
     * Soft delete: returns the tombstoned comment (empty body, deleted_at
     * set) so the client can render a "Comment deleted" placeholder in
     * place, rather than removing it from the thread.
     */
    async delete(req, res, next) {
        try {
            const comment = await commentsService.removeComment(
                req.currentUser.id,
                req.params.uid
            );
            res.json(comment);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/comment/:uid/reaction
     * Body: { type: 'like' | 'dislike' | null }. null clears the caller's
     * own reaction. Returns just the updated counts and the caller's
     * current reaction.
     */
    async react(req, res, next) {
        try {
            const result = await commentsService.setReaction(
                req.currentUser.id,
                req.params.uid,
                req.body.type ?? null
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    },
};

module.exports = commentsController;
