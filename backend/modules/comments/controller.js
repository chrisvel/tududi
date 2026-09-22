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
            const { body, mentioned_person_uids: mentionedPersonUids } =
                req.body;
            const comment = await commentsService.addComment(
                req.currentUser.id,
                req.params.uid,
                { body, mentionedPersonUids }
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
};

module.exports = commentsController;
