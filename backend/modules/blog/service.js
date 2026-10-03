'use strict';

const slugify = require('slugify');
const { Setting } = require('../../models');
const { getConfig } = require('../../config/config');
const { notesRepository, validateUid } = require('../notes');
const { extractUidFromSlug } = require('../../utils/slug-utils');
const { NotFoundError, ValidationError } = require('../../shared/errors');

const SETTING_KEY = 'blog_note_uid';

const WIKILINK = /\[\[([^[\]\n]+?)\]\]/g;
const NOTE_FILE_LINK = /\/api\/uploads\/note-files\/([A-Za-z0-9._-]+)/g;
const FIRST_IMAGE = /!\[[^\]]*\]\(([^)\s]+)/;

// Enough for any real blog, and a bound on the walk if notes link in circles.
const MAX_POSTS = 200;
const EXCERPT_LENGTH = 220;

const titleKey = (title) => (title || '').trim().toLowerCase();

function linkedTitles(content) {
    return [...(content || '').matchAll(WIKILINK)].map((m) => titleKey(m[1]));
}

// Files attached to a note are linked under /api/uploads, which needs a
// signed-in reader. On the blog they go through the note's public link.
function publicContent(note) {
    return (note.content || '').replace(
        NOTE_FILE_LINK,
        (_, name) => `/api/public/notes/${note.public_token}/files/${name}`
    );
}

// The first paragraph of plain prose, for a post card and the meta
// description. Headings, images, lists and quotes are skipped.
function excerptOf(content) {
    const paragraph = (content || '')
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .find((p) => p && !/^(#|!\[|[-*+>]|\d+\.|```|\|)/.test(p));
    if (!paragraph) return '';
    const text = paragraph
        .replace(/\[\[([^[\]\n]+?)\]\]/g, '$1')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[*_`~]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (text.length <= EXCERPT_LENGTH) return text;
    return `${text.slice(0, EXCERPT_LENGTH).replace(/\s+\S*$/, '')}…`;
}

// URL-safe slugs from titles, unique within the blog: a repeated title gets
// -2, -3, and a title with no usable letters falls back to the note's uid.
function assignSlugs(notes) {
    const taken = new Set();
    const slugs = new Map();
    for (const note of notes) {
        const base =
            slugify(note.title || '', { lower: true, strict: true }) ||
            note.uid;
        let slug = base;
        for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
        taken.add(slug);
        slugs.set(note.id, slug);
    }
    return slugs;
}

async function getNoteUid() {
    const setting = await Setting.findOne({ where: { key: SETTING_KEY } });
    return setting && setting.value ? setting.value : null;
}

// The blog as it stands: the front page note and every public note of the
// same owner reachable from it through [[links]], in the order a reader
// would find them. A public note that the blog does not link stays off it.
// Null when no note is picked or it is not shared.
async function loadBlog() {
    const uid = await getNoteUid();
    if (!uid) return null;
    const front = await notesRepository.findForBlog(uid);
    if (!front || !front.public_token || !front.public_shared_at) return null;

    const publicNotes = await notesRepository.findPublicNotesForUser(
        front.user_id
    );
    const byTitle = new Map();
    for (const note of publicNotes) {
        const key = titleKey(note.title);
        if (key && !byTitle.has(key)) byTitle.set(key, note);
    }
    const index = publicNotes.find((n) => n.id === front.id);
    if (!index) return null;

    const visited = new Set([index.id]);
    const posts = [];
    const queue = [index];
    while (queue.length > 0 && posts.length < MAX_POSTS) {
        const note = queue.shift();
        for (const key of linkedTitles(note.content)) {
            const target = byTitle.get(key);
            if (!target || visited.has(target.id)) continue;
            visited.add(target.id);
            posts.push(target);
            queue.push(target);
            if (posts.length >= MAX_POSTS) break;
        }
    }

    const slugs = assignSlugs(posts);
    const describe = (note) => ({
        title: (note.title || '').trim(),
        slug: slugs.get(note.id),
    });
    // The posts a note links to, once each, in the order they appear.
    const linkedPosts = (note) => {
        const seen = new Set();
        return linkedTitles(note.content)
            .map((key) => byTitle.get(key))
            .filter((n) => {
                if (!n || !slugs.has(n.id) || seen.has(n.id)) return false;
                seen.add(n.id);
                return true;
            });
    };

    return { index, posts, slugs, describe, linkedPosts };
}

// Where the call to action on every page sends a reader.
function siteLinks() {
    const { landing, pricing } = getConfig();
    const app = (landing.appUrl || '').replace(/\/$/, '');
    const site = (landing.siteUrl || '').replace(/\/$/, '');
    return {
        landing: site,
        cloud: `${site}/cloud`,
        app,
        register: `${app}/register`,
        pricing: {
            currency: pricing.currency,
            monthly: pricing.monthly,
            annual: pricing.annual,
        },
    };
}

function postCard(blog, note) {
    const content = publicContent(note);
    const cover = content.match(FIRST_IMAGE);
    return {
        ...blog.describe(note),
        excerpt: excerptOf(note.content),
        cover: cover ? cover[1] : null,
        published_at: note.public_shared_at,
    };
}

const blogService = {
    getNoteUid,

    // Picks the front page note, or clears it with an empty value. Takes a
    // bare uid, a uid-slug or a pasted note URL. Only the picker's own
    // notes qualify, so no other user's writing can end up on the blog.
    async setNoteUid(userId, input) {
        const raw = typeof input === 'string' ? input.trim() : '';
        if (!raw) {
            await Setting.destroy({ where: { key: SETTING_KEY } });
            return null;
        }
        const lastSegment = raw
            .replace(/[?#].*$/, '')
            .replace(/\/+$/, '')
            .split('/')
            .pop();
        const uid = validateUid(extractUidFromSlug(lastSegment));
        const note = await notesRepository.findForBlog(uid);
        if (!note || note.user_id !== userId) {
            throw new ValidationError('Pick one of your own notes.');
        }
        await Setting.upsert({ key: SETTING_KEY, value: uid });
        return uid;
    },

    // What the admin area shows: the picked note, whether it is shared, and
    // the posts it currently yields.
    async status() {
        const uid = await getNoteUid();
        const note = uid ? await notesRepository.findForBlog(uid) : null;
        const blog = await loadBlog();
        return {
            note_uid: uid,
            note: note
                ? {
                      uid: note.uid,
                      title: note.title,
                      shared: Boolean(
                          note.public_token && note.public_shared_at
                      ),
                  }
                : null,
            posts: blog ? blog.posts.map(blog.describe) : [],
            blog_url: getConfig().blog.siteUrl,
        };
    },

    async getIndex() {
        const blog = await loadBlog();
        if (!blog) throw new NotFoundError('The blog is not available.');
        const { index } = blog;
        return {
            title: (index.title || '').trim(),
            content: publicContent(index),
            excerpt: excerptOf(index.content),
            linked_notes: blog.linkedPosts(index).map(blog.describe),
            posts: blog.linkedPosts(index).map((note) => postCard(blog, note)),
            links: siteLinks(),
        };
    },

    async getPost(slug) {
        const blog = await loadBlog();
        const note =
            blog &&
            typeof slug === 'string' &&
            blog.posts.find((p) => blog.slugs.get(p.id) === slug);
        if (!note) throw new NotFoundError('This post is not available.');
        const inherit = note.public_inherit_style;
        return {
            title: (note.title || '').trim(),
            slug,
            content: publicContent(note),
            excerpt: excerptOf(note.content),
            color: inherit ? note.color || null : null,
            background: inherit ? note.background || null : null,
            published_at: note.public_shared_at,
            updated_at: note.updated_at,
            linked_notes: blog.linkedPosts(note).map(blog.describe),
            more: blog
                .linkedPosts(blog.index)
                .filter((p) => p.id !== note.id)
                .slice(0, 3)
                .map((p) => postCard(blog, p)),
            links: siteLinks(),
        };
    },

    // Every post URL with its last change, for the sitemap.
    async sitemapEntries() {
        const blog = await loadBlog();
        if (!blog) return [];
        return [
            { path: '/', updated_at: blog.index.updated_at },
            ...blog.posts.map((note) => ({
                path: `/${blog.slugs.get(note.id)}`,
                updated_at: note.updated_at,
            })),
        ];
    },
};

module.exports = blogService;
module.exports._internal = { excerptOf, assignSlugs };
