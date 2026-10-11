'use strict';

const fs = require('fs');
const express = require('express');
const { User } = require('../../models');
const service = require('./service');

/**
 * The web app manifest, served dynamically.
 *
 * `public/manifest.json` describes the app itself and never changes. What does
 * change per user is which plugins are enabled, and an enabled plugin's most
 * useful screen is worth reaching in one tap from the home screen - which is
 * what a manifest shortcut is. So the base manifest is merged with the
 * shortcuts of the plugins this user has enabled, and served from the same URL
 * a static file used to occupy.
 *
 * A request with no session, or a base manifest that cannot be read, still gets
 * a valid manifest: installability must never depend on being signed in.
 */

const MAX_MERGED_SHORTCUTS = 4;

const readJsonFile = (filePath) => {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
};

/**
 * A plugin's shortcut path is relative to the plugin's own route prefix, so a
 * plugin can only ever point at a route it owns.
 */
const shortcutUrl = (pluginId, shortcutPath) =>
    `/plugins/${encodeURIComponent(pluginId)}/${String(shortcutPath).replace(
        /^\/+/,
        ''
    )}`;

/**
 * Merge the shortcuts of the plugins a user has enabled into the base
 * manifest. Pure, so the merge is testable without a request.
 */
const buildManifest = (base, plugins, state) => {
    const result = base && typeof base === 'object' ? { ...base } : {};

    const enabled =
        state && Array.isArray(state.enabled)
            ? new Set(state.enabled)
            : new Set();

    // The app's own shortcuts come first and keep their place: a plugin adds to
    // that list, it never displaces it.
    const shortcuts = Array.isArray(result.shortcuts)
        ? [...result.shortcuts]
        : [];

    for (const plugin of plugins || []) {
        if (shortcuts.length >= MAX_MERGED_SHORTCUTS) break;
        if (!plugin || !plugin.ok || !enabled.has(plugin.id)) continue;

        const declared = Array.isArray(plugin.manifest?.shortcuts)
            ? plugin.manifest.shortcuts
            : [];

        for (const shortcut of declared) {
            if (shortcuts.length >= MAX_MERGED_SHORTCUTS) break;
            if (!shortcut || typeof shortcut.name !== 'string') continue;
            if (typeof shortcut.path !== 'string') continue;

            shortcuts.push({
                name: shortcut.name,
                short_name: shortcut.short_name || shortcut.name,
                ...(shortcut.description
                    ? { description: shortcut.description }
                    : {}),
                url: shortcutUrl(plugin.id, shortcut.path),
                // Without icons a launcher falls back to a generic glyph, so
                // plugin shortcuts borrow the app's own.
                ...(Array.isArray(result.icons) ? { icons: result.icons } : {}),
            });
        }
    }

    if (shortcuts.length > 0) {
        result.shortcuts = shortcuts.slice(0, MAX_MERGED_SHORTCUTS);
    } else {
        delete result.shortcuts;
    }

    return result;
};

/**
 * The session user, or null.
 *
 * Deliberately not `requireAuth`: a signed-out visitor must still receive a
 * manifest, they simply get the unpersonalized one.
 */
const resolveOptionalUser = async (req) => {
    if (req.currentUser) return req.currentUser;

    const userId = req.session && req.session.userId;
    if (!userId) return null;

    try {
        return await User.findByPk(userId);
    } catch {
        return null;
    }
};

/**
 * @param {object} options
 * @param {string[]} options.baseManifestPaths  candidate static manifests, in
 *   order. Both the built copy and the source copy are passed: a checkout that
 *   has never been built still has the manifest it was checked in with.
 */
const createRouter = ({ baseManifestPaths }) => {
    const router = express.Router();
    const paths = (
        Array.isArray(baseManifestPaths)
            ? baseManifestPaths
            : [baseManifestPaths]
    ).filter((candidate) => typeof candidate === 'string');

    const handler = async (req, res, next) => {
        let base = null;
        for (const candidate of paths) {
            base = readJsonFile(candidate);
            if (base) break;
        }

        // Nothing to merge into: let the static handler answer, so a failed
        // read degrades to the old behaviour rather than to a 404.
        if (!base) return next();

        let plugins = [];
        let state = { enabled: [], settings: {}, activeTheme: null };

        try {
            const user = await resolveOptionalUser(req);
            plugins = service.listInstalled();
            if (user) state = service.readState(user);
        } catch {
            // An unreadable plugins directory must not break installability.
            plugins = [];
        }

        // Personalized (it reflects which plugins this user enabled), so it is
        // never stored: a cached copy would hand one user's shortcuts to the
        // next visitor on a shared instance.
        res.setHeader('Content-Type', 'application/manifest+json');
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Vary', 'Cookie');
        res.json(buildManifest(base, plugins, state));
    };

    // `manifest.json` is the historical name and is what an app installed
    // before this change keeps requesting; `manifest.webmanifest` is the
    // current one. Both have to be answered, or an installed app never picks
    // up new shortcuts.
    router.get(['/manifest.json', '/manifest.webmanifest'], handler);

    return router;
};

module.exports = {
    MAX_MERGED_SHORTCUTS,
    buildManifest,
    shortcutUrl,
    resolveOptionalUser,
    createRouter,
};
