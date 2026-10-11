'use strict';

const fs = require('fs');
const path = require('path');
const {
    MANIFEST_FILENAME,
    PLUGIN_API_VERSION,
    validateManifest,
} = require('./manifest');

/**
 * Installed plugins are directories under a plugins root that holds a
 * `plugin.json`. The root is deliberately outside the webpack output: a build
 * runs `clean: true` on `dist`, so anything a build wrote there would be
 * deleted on the next deploy.
 *
 * Operators install plugins by dropping a directory in, either under the repo's
 * `plugins/` folder or wherever `TUDUDI_PLUGINS_DIR` points.
 */
const DEFAULT_PLUGINS_DIR = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'plugins'
);

function getPluginsDir() {
    const configured = process.env.TUDUDI_PLUGINS_DIR;
    if (configured && configured.trim()) {
        return path.resolve(configured.trim());
    }
    return DEFAULT_PLUGINS_DIR;
}

function getHostVersion() {
    try {
        // eslint-disable-next-line global-require
        return require('../../../package.json').version || null;
    } catch {
        return null;
    }
}

/**
 * Whether a request under `/plugins` is about to be answered from disk.
 *
 * This is the question the session gate has to ask. The static handler serves a
 * plugin directory whole, so a gate that read an extension off the URL would
 * miss the files that do not have one (`LICENSE`, `Makefile`, a plugin's own
 * `NOTES`) and the ones whose dot is percent-encoded (`dist/index%2Ejs`) - all
 * of which `express.static` happily serves. Asking the filesystem, on the
 * decoded path and only when it stays inside the root, cannot be argued with.
 *
 * A path that names no file is a client-side route (`/plugins/<id>/focus`), and
 * is deliberately left alone: it falls through to the app shell, which is what
 * sends a signed-out visitor to sign in. Answering a deep link with 401 JSON
 * would break the route and tell a browser nothing useful.
 */
function servesPluginFile(urlPath, options = {}) {
    const root = path.resolve(options.dir || getPluginsDir());

    let decoded;
    try {
        decoded = decodeURIComponent(String(urlPath || ''));
    } catch {
        // A malformed escape names no file; express.static refuses it as well,
        // so the request is treated as a route.
        return false;
    }

    if (!decoded || decoded.includes('\0')) return false;

    const segments = decoded.split(/[/\\]+/).filter(Boolean);
    // `dotfiles: 'ignore'` is what keeps a plugin's `.env` unreadable. Such a
    // request reaches the shell, where nothing on disk is served.
    if (segments.some((segment) => segment.startsWith('.'))) return false;

    const target = path.resolve(root, ...segments);
    if (target !== root && !target.startsWith(root + path.sep)) return false;

    try {
        return fs.statSync(target).isFile();
    } catch {
        return false;
    }
}

/**
 * The files a manifest points at have to exist.
 *
 * The common case is a plugin that has never been built: the manifest is valid
 * but its bundle was never produced, so the plugin would be offered for
 * enabling and then fail in the browser with a 404 that says nothing about
 * why. Checking here turns that into a message naming the build command.
 */
const missingReferencedFiles = (dir, manifest) => {
    const missing = [];

    const check = (value, label) => {
        if (typeof value !== 'string') return;

        let stats = null;
        try {
            stats = fs.statSync(path.join(dir, value));
        } catch {
            stats = null;
        }

        if (!stats) {
            missing.push(
                `${label} \`${value}\` does not exist - build the plugin (npm install && npm run build)`
            );
        } else if (!stats.isFile()) {
            missing.push(`${label} \`${value}\` is not a file`);
        }
    };

    check(manifest.entry, '`entry`');
    for (const style of Array.isArray(manifest.styles) ? manifest.styles : []) {
        check(style, '`styles`');
    }

    return missing;
};

/**
 * Read one plugin directory. A directory that cannot be read, or that holds an
 * unusable manifest, is reported rather than skipped: an operator who installed
 * something that does not work needs to see why.
 */
function readPluginDir(dir, pluginId, options = {}) {
    const manifestPath = path.join(dir, MANIFEST_FILENAME);

    let raw;
    try {
        raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {
                id: pluginId,
                manifest: { id: pluginId },
                ok: false,
                errors: [`missing ${MANIFEST_FILENAME}`],
            };
        }
        return {
            id: pluginId,
            manifest: { id: pluginId },
            ok: false,
            errors: [
                `${MANIFEST_FILENAME} is not valid JSON: ${error.message}`,
            ],
        };
    }

    const result = validateManifest(raw, {
        hostVersion: options.hostVersion,
        pluginApiVersion: options.pluginApiVersion,
    });

    // Only worth checking once the manifest itself is sound: a manifest with a
    // bad `entry` would otherwise report both a path error and a missing file.
    const errors = result.ok
        ? [...result.errors, ...missingReferencedFiles(dir, result.manifest)]
        : result.errors;

    return {
        id: result.manifest.id || pluginId,
        manifest: result.manifest,
        ok: errors.length === 0,
        errors,
    };
}

/**
 * List every installed plugin, whether or not it is usable.
 *
 * `options.dir` exists for tests; production reads `TUDUDI_PLUGINS_DIR`.
 */
function listInstalled(options = {}) {
    const dir = options.dir || getPluginsDir();
    const hostVersion =
        options.hostVersion === undefined
            ? getHostVersion()
            : options.hostVersion;
    const pluginApiVersion =
        options.pluginApiVersion === undefined
            ? PLUGIN_API_VERSION
            : options.pluginApiVersion;

    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        // No plugins directory at all is the normal, healthy state.
        return [];
    }

    const plugins = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        plugins.push(
            readPluginDir(path.join(dir, entry.name), entry.name, {
                hostVersion,
                pluginApiVersion,
            })
        );
    }

    plugins.sort((a, b) => a.id.localeCompare(b.id));
    return plugins;
}

/**
 * Per-user plugin state lives in the free-form `ui_settings` JSON column, so a
 * plugin list needs no schema change. Everything else in that column must
 * survive a write, so updates merge rather than replace.
 */
function readState(user) {
    const ui = user && user.ui_settings;
    const plugins = ui && typeof ui === 'object' ? ui.plugins : null;

    return {
        enabled:
            plugins && Array.isArray(plugins.enabled)
                ? plugins.enabled.filter((id) => typeof id === 'string')
                : [],
        settings:
            plugins &&
            plugins.settings &&
            typeof plugins.settings === 'object' &&
            !Array.isArray(plugins.settings)
                ? plugins.settings
                : {},
        activeTheme:
            plugins && typeof plugins.activeTheme === 'string'
                ? plugins.activeTheme
                : null,
    };
}

/**
 * Persist a partial update to the plugin slice of `ui_settings`, preserving
 * every other key (including ones this module does not know about).
 */
async function writeState(user, patch) {
    const current = readState(user);
    const currentUi =
        user.ui_settings && typeof user.ui_settings === 'object'
            ? user.ui_settings
            : {};

    const next = {
        enabled: current.enabled,
        settings: current.settings,
        activeTheme: current.activeTheme,
        ...patch,
    };

    const uiSettings = {
        ...currentUi,
        plugins: next,
    };

    await user.update({ ui_settings: uiSettings });
    return next;
}

/**
 * The payload the frontend loads plugins from. A plugin that failed validation
 * is included with `ok: false` and its errors, but the frontend must not
 * import it.
 */
function describeForClient(plugins, state) {
    const enabled = new Set(state.enabled);

    return plugins.map((plugin) => ({
        id: plugin.id,
        name: plugin.manifest.name || plugin.id,
        version: plugin.manifest.version || null,
        description: plugin.manifest.description || null,
        pluginApi: plugin.manifest.pluginApi || null,
        host: plugin.manifest.host || null,
        entry: plugin.manifest.entry || null,
        styles: Array.isArray(plugin.manifest.styles)
            ? plugin.manifest.styles
            : [],
        ok: plugin.ok,
        errors: plugin.errors,
        enabled: plugin.ok && enabled.has(plugin.id),
    }));
}

module.exports = {
    DEFAULT_PLUGINS_DIR,
    PLUGIN_API_VERSION,
    getPluginsDir,
    getHostVersion,
    servesPluginFile,
    listInstalled,
    missingReferencedFiles,
    readState,
    writeState,
    describeForClient,
};
