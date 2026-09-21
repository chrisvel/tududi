'use strict';

const crypto = require('crypto');
const notesRepository = require('./repository');
const { validateUid } = require('./validation');
const { NotFoundError, ForbiddenError } = require('../../shared/errors');

// 32 random bytes as base64url: 43 characters, 256 bits, safe in a URL path.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function generateToken() {
    return crypto.randomBytes(32).toString('base64url');
}

async function loadOwnedNote(userId, uid) {
    const note = await notesRepository.findForPublicShare(validateUid(uid));
    if (!note) {
        throw new NotFoundError('Note not found.');
    }
    // Making a note public reaches beyond the people it was shared with, so it
    // stays with the owner even when a project share grants write access.
    if (note.user_id !== userId) {
        throw new ForbiddenError('Only the owner can share a note publicly.');
    }
    return note;
}

function describeShare(note) {
    return {
        enabled: Boolean(note.public_token),
        token: note.public_token || null,
        shared_at: note.public_token ? note.public_shared_at : null,
    };
}

const publicSharing = {
    async get(userId, uid) {
        return describeShare(await loadOwnedNote(userId, uid));
    },

    // Enabling twice keeps the existing link, so a second click or a retry
    // does not break a link that was already handed out.
    async enable(userId, uid) {
        const note = await loadOwnedNote(userId, uid);
        if (!note.public_token) {
            await notesRepository.update(
                note,
                {
                    public_token: generateToken(),
                    public_shared_at: new Date(),
                },
                { silent: true }
            );
        }
        return describeShare(note);
    },

    // The token is thrown away, not hidden: turning sharing back on issues a
    // new link, and every copy of the old one stays dead.
    async disable(userId, uid) {
        const note = await loadOwnedNote(userId, uid);
        if (note.public_token) {
            await notesRepository.update(
                note,
                { public_token: null, public_shared_at: null },
                { silent: true }
            );
        }
        return describeShare(note);
    },

    async getPublicNote(token) {
        if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
            throw new NotFoundError('This link is not available.');
        }
        const note = await notesRepository.findByPublicToken(token);
        if (!note) {
            throw new NotFoundError('This link is not available.');
        }
        return {
            title: note.title,
            content: note.content,
            color: note.color,
            updated_at: note.updated_at,
        };
    },
};

module.exports = publicSharing;
