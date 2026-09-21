'use strict';

const notesService = require('./service');
const publicSharing = require('./publicSharing');
const { UnauthorizedError } = require('../../shared/errors');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { extractUidFromSlug } = require('../../utils/slug-utils');

/**
 * Get authenticated user ID or throw UnauthorizedError.
 */
function requireUserId(req) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        throw new UnauthorizedError('Authentication required');
    }
    return userId;
}

/**
 * Notes controller - handles HTTP requests/responses.
 */
const notesController = {
    /**
     * GET /api/notes
     * List all notes for the current user.
     */
    async list(req, res, next) {
        try {
            const userId = requireUserId(req);
            const notes = await notesService.getAll(userId, {
                orderBy: req.query.order_by,
                tagFilter: req.query.tag,
            });
            res.json(notes);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /api/note/:uidSlug
     * Get a single note by UID.
     */
    async getOne(req, res, next) {
        try {
            const uid = extractUidFromSlug(req.params.uidSlug);
            const note = await notesService.getByUid(uid);
            res.json(note);
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/note
     * Create a new note.
     */
    async create(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { title, content, project_uid, project_id, tags, color } =
                req.body;

            const note = await notesService.create(userId, {
                title,
                content,
                project_uid,
                project_id,
                tags,
                color,
            });

            res.status(201).json(note);
        } catch (error) {
            next(error);
        }
    },

    /**
     * PATCH /api/note/:uid
     * Update a note.
     */
    async update(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { uid } = req.params;
            const {
                title,
                content,
                project_uid,
                project_id,
                tags,
                color,
                pin_to_sidebar,
            } = req.body;

            const note = await notesService.update(userId, uid, {
                title,
                content,
                project_uid,
                project_id,
                tags,
                color,
                pin_to_sidebar,
            });

            res.json(note);
        } catch (error) {
            next(error);
        }
    },

    /**
     * DELETE /api/note/:uid
     * Delete a note.
     */
    async delete(req, res, next) {
        try {
            const { uid } = req.params;
            const result = await notesService.delete(uid);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /api/note/:uid/backlinks
     * Get all notes that link to this note via [[title]].
     */
    async backlinks(req, res, next) {
        try {
            const userId = requireUserId(req);
            const uid = extractUidFromSlug(req.params.uid);
            const links = await notesService.getBacklinks(userId, uid);
            res.json(links);
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /api/note/:uid/public-share
     * Read the public sharing state of a note (owner only).
     */
    async getPublicShare(req, res, next) {
        try {
            const userId = requireUserId(req);
            const uid = extractUidFromSlug(req.params.uid);
            res.json(await publicSharing.get(userId, uid));
        } catch (error) {
            next(error);
        }
    },

    /**
     * POST /api/note/:uid/public-share
     * Turn public sharing on and return the link token.
     */
    async enablePublicShare(req, res, next) {
        try {
            const userId = requireUserId(req);
            const uid = extractUidFromSlug(req.params.uid);
            res.json(await publicSharing.enable(userId, uid));
        } catch (error) {
            next(error);
        }
    },

    /**
     * DELETE /api/note/:uid/public-share
     * Turn public sharing off and kill the link.
     */
    async disablePublicShare(req, res, next) {
        try {
            const userId = requireUserId(req);
            const uid = extractUidFromSlug(req.params.uid);
            res.json(await publicSharing.disable(userId, uid));
        } catch (error) {
            next(error);
        }
    },

    /**
     * GET /api/public/notes/:token
     * Read a publicly shared note. No authentication.
     */
    async getPublicNote(req, res, next) {
        try {
            // The token is the credential: keep the page out of caches,
            // search indexes and Referer headers.
            res.set({
                'Cache-Control': 'no-store',
                'X-Robots-Tag': 'noindex, nofollow',
                'Referrer-Policy': 'no-referrer',
            });
            res.json(await publicSharing.getPublicNote(req.params.token));
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get note UID if exists (for authorization middleware).
     */
    async getNoteUidForAuth(req) {
        const uid = extractUidFromSlug(req.params.uidSlug || req.params.uid);
        return notesService.getNoteUidIfExists(uid);
    },
};

module.exports = notesController;
