'use strict';

const crypto = require('crypto');
const notesRepository = require('./repository');
const { validateUid } = require('./validation');
const {
    NotFoundError,
    ForbiddenError,
    ValidationError,
} = require('../../shared/errors');

// 32 random bytes as base64url: 43 characters, 256 bits, safe in a URL path.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const WIKILINK = /\[\[([^[\]\n]+?)\]\]/g;

// Files attached to a note are linked as /api/uploads/note-files/<name>, which
// needs a signed-in reader. On the public page they go through the link.
const NOTE_FILE_LINK = /\/api\/uploads\/note-files\/([A-Za-z0-9._-]+)/g;
const STORED_FILENAME = /^[A-Za-z0-9._-]+$/;

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

// The [[links]] in a public note that a reader may follow: only notes of the
// same owner that are public too. A private note and a missing one look the
// same, so the reader learns nothing about notes they cannot open.
async function findPublicNote(token) {
    if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
        throw new NotFoundError('This link is not available.');
    }
    const note = await notesRepository.findByPublicToken(token);
    if (!note) {
        throw new NotFoundError('This link is not available.');
    }
    return note;
}

async function publicLinkedNotes(note) {
    const titles = new Set(
        [...(note.content || '').matchAll(WIKILINK)].map((m) =>
            m[1].trim().toLowerCase()
        )
    );
    if (titles.size === 0) return [];
    const publicNotes = await notesRepository.findPublicTitlesForUser(
        note.user_id
    );
    return publicNotes
        .filter((n) => n.title && titles.has(n.title.trim().toLowerCase()))
        .map((n) => ({ title: n.title.trim(), token: n.public_token }));
}

// A note is public while it has both a token and a shared time. Turning
// sharing off clears only the time, so the same link comes back when it is
// turned on again; the token is shown only while the link works.
function isShared(note) {
    return Boolean(note.public_token && note.public_shared_at);
}

function describeShare(note) {
    const enabled = isShared(note);
    return {
        enabled,
        token: enabled ? note.public_token : null,
        shared_at: enabled ? note.public_shared_at : null,
        public_inherit_style: Boolean(note.public_inherit_style),
    };
}

// Whether the public page shows the note's color and background, from a
// request body. Left out, it is not changed.
function lookFromBody(body = {}) {
    if (body.public_inherit_style === undefined) return {};
    if (typeof body.public_inherit_style !== 'boolean') {
        throw new ValidationError('public_inherit_style must be a boolean.');
    }
    return { public_inherit_style: body.public_inherit_style };
}

const publicSharing = {
    async get(userId, uid) {
        return describeShare(await loadOwnedNote(userId, uid));
    },

    // The link is kept for good: enabling twice, or again after turning
    // sharing off, brings back the same link. Only rotate() replaces it.
    // The body may say whether the public page inherits the note's styling.
    async enable(userId, uid, body) {
        const look = lookFromBody(body);
        const note = await loadOwnedNote(userId, uid);
        const changes = isShared(note)
            ? look
            : {
                  ...look,
                  public_token: note.public_token || generateToken(),
                  public_shared_at: new Date(),
              };
        if (Object.keys(changes).length > 0) {
            await notesRepository.update(note, changes, { silent: true });
        }
        return describeShare(note);
    },

    async updateLook(userId, uid, body) {
        const look = lookFromBody(body);
        const note = await loadOwnedNote(userId, uid);
        if (Object.keys(look).length > 0) {
            await notesRepository.update(note, look, { silent: true });
        }
        return describeShare(note);
    },

    // The link stops working but is kept, so turning sharing back on
    // restores it.
    async disable(userId, uid) {
        const note = await loadOwnedNote(userId, uid);
        if (note.public_shared_at) {
            await notesRepository.update(
                note,
                { public_shared_at: null },
                { silent: true }
            );
        }
        return describeShare(note);
    },

    // A new link for a shared note. The old one stops working for good.
    async rotate(userId, uid) {
        const note = await loadOwnedNote(userId, uid);
        if (!isShared(note)) {
            throw new ValidationError('The note is not shared publicly.');
        }
        await notesRepository.update(
            note,
            { public_token: generateToken() },
            { silent: true }
        );
        return describeShare(note);
    },

    async getPublicNote(token) {
        const note = await findPublicNote(token);
        return {
            title: note.title,
            content: (note.content || '').replace(
                NOTE_FILE_LINK,
                (_, name) => `/api/public/notes/${token}/files/${name}`
            ),
            color: note.public_inherit_style ? note.color || null : null,
            background: note.public_inherit_style
                ? note.background || null
                : null,
            updated_at: note.updated_at,
            linked_notes: await publicLinkedNotes(note),
        };
    },

    // A file attached to the public note. Files of other notes, and every
    // file once sharing is off, look the same as a missing one.
    async getPublicFile(token, filename) {
        const note = await findPublicNote(token);
        const attachment =
            typeof filename === 'string' && STORED_FILENAME.test(filename)
                ? await notesRepository.findAttachment(note.id, filename)
                : null;
        if (!attachment) {
            throw new NotFoundError('This file is not available.');
        }
        return attachment;
    },
};

module.exports = publicSharing;
