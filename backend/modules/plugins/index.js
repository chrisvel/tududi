'use strict';

const express = require('express');
const routes = require('./routes');
const service = require('./service');
const pwaManifest = require('./pwaManifest');
const { requireAuth } = require('../../middleware/auth');
const { assertNotTokenAuthenticated } = require('./access');

/**
 * Plugin assets are served from the plugins root, not from `dist`.
 *
 * Two things make that necessary rather than stylistic:
 *  - webpack runs `clean: true` on `dist`, so a build would delete installed
 *    plugins;
 *  - `dist` is served `immutable` for a year, which a plugin update could
 *    never escape.
 *
 * `no-cache` (revalidate, do not skip storing) is the cache header here: plugin
 * bundles are small, installs are rare, and a stale plugin is far more
 * confusing than a conditional request. The frontend also appends `?v=` with
 * the plugin's version, so a version bump is a new URL regardless.
 *
 * The root is resolved per request, and one handler per root is kept. It has to
 * be: the session gate asks the same question of the same directory, and a
 * handler built around a different root would either serve files the gate never
 * saw or refuse files that are not really there. One root is normal in
 * production; tests, and any process that points `TUDUDI_PLUGINS_DIR` somewhere
 * else, would otherwise hold a handler aimed at the previous directory.
 */
const handlersByRoot = new Map();

function handlerFor(root) {
    if (!handlersByRoot.has(root)) {
        handlersByRoot.set(
            root,
            express.static(root, {
                index: false,
                redirect: false,
                dotfiles: 'ignore',
                etag: true,
                lastModified: true,
                setHeaders: (res) => {
                    // Plugin code is loaded as a module into the app's own
                    // realm; stop a content-type sniff from ever
                    // reinterpreting a file.
                    res.setHeader('X-Content-Type-Options', 'nosniff');
                    res.setHeader('Cache-Control', 'no-cache');
                },
            })
        );
    }

    return handlersByRoot.get(root);
}

function staticHandler() {
    return (req, res, next) =>
        handlerFor(service.getPluginsDir())(req, res, next);
}

/**
 * A plugin file takes a signed-in session, and not a token.
 *
 * The directory is served whole, so what sits behind this is everything an
 * operator keeps beside a bundle. The app fetches a bundle from the page the
 * user has signed in to, with that page's own cookies - so a session is all
 * that is ever needed here, and a token is not one. `requireAuth` answers 401
 * when there are no credentials at all; the refusal after it is the rule
 * installing follows (see ./access.js), for the same reason.
 *
 * A path that names no file is a plugin's *page*, a client-side route, and is
 * passed through to the app shell - which is what sends a signed-out visitor to
 * sign in.
 */
const requirePluginFileSession = (req, res, next) => {
    if (!service.servesPluginFile(req.path)) return next();

    return requireAuth(req, res, (error) => {
        if (error) return next(error);

        try {
            assertNotTokenAuthenticated(req, 'Reading a plugin file');
        } catch (assertion) {
            return next(assertion);
        }

        return next();
    });
};

module.exports = {
    routes,
    staticHandler,
    // The gate in front of those files, and the question it asks: is a file
    // about to be served, and is this a session rather than a token?
    requirePluginFileSession,
    servesPluginFile: service.servesPluginFile,
    pluginsService: service,
    pwaManifest,
};
