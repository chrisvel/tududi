'use strict';

/**
 * Plugin manifest validation.
 *
 * A plugin directory contains a `plugin.json` plus whatever the manifest
 * points at. Nothing here executes plugin code: validation runs first, and the
 * frontend only `import()`s an entry point whose manifest already passed.
 *
 * `frontend/plugins/manifest.ts` implements the same rules for the browser.
 * The frontend bundles for the browser and cannot require this file, so the two
 * copies are kept in step by hand and pinned by the shared fixtures in
 * `backend/tests/fixtures/plugins`.
 */

/**
 * The extension contract version. Bump only for breaking changes to the host
 * API; additive host API changes do not need a bump.
 */
const PLUGIN_API_VERSION = 1;

const MANIFEST_FILENAME = 'plugin.json';

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const MAX_ID_LENGTH = 64;
const MAX_TEXT_LENGTH = 200;
const MAX_PATH_LENGTH = 300;
const MAX_LICENCES = 200;

/**
 * A plugin may add at most this many launcher shortcuts. Android shows a
 * handful at most, and a longer list only pushes the app's own shortcuts out.
 */
const MAX_SHORTCUTS = 4;

/**
 * A plugin may only reference files inside its own directory, so an entry or
 * stylesheet path is rejected when it is absolute, scheme-qualified, or climbs
 * out of the plugin directory. The host joins the value onto the plugin's own
 * URL, but validating here keeps a bad manifest from ever being served.
 */
const isSafeRelativePath = (value) => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_PATH_LENGTH) return false;
    if (trimmed.startsWith('/') || trimmed.startsWith('\\')) return false;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return false;
    if (trimmed.includes('\0')) return false;
    const segments = trimmed.split(/[\\/]+/);
    return !segments.includes('..');
};

/**
 * Parse a version into comparable parts. Accepts an optional leading `v`
 * because the package version in this repo is `v1.9.1`, and accepts partial
 * versions (`1`, `1.9`) because a compatibility range is normally written as
 * `>=1.9 <2`.
 *
 * `precision` records how many parts were actually written, which is what
 * decides whether a bare `1.9` means "any 1.9.x" rather than exactly 1.9.0.
 */
const parseVersion = (value) => {
    if (typeof value !== 'string') return null;
    const match =
        /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/.exec(
            value.trim()
        );
    if (!match) return null;
    return {
        major: Number(match[1]),
        minor: match[2] === undefined ? 0 : Number(match[2]),
        patch: match[3] === undefined ? 0 : Number(match[3]),
        precision: [match[1], match[2], match[3]].filter(
            (part) => part !== undefined
        ).length,
        prerelease: match[4] || null,
    };
};

/**
 * Standard semver ordering: numeric fields first, and a prerelease sorts
 * before the release it qualifies.
 */
const compareVersions = (a, b) => {
    for (const field of ['major', 'minor', 'patch']) {
        if (a[field] !== b[field]) return a[field] < b[field] ? -1 : 1;
    }
    if (a.prerelease === b.prerelease) return 0;
    if (a.prerelease === null) return 1;
    if (b.prerelease === null) return -1;
    return a.prerelease < b.prerelease ? -1 : 1;
};

const matchesComparator = (version, comparator) => {
    const match = /^(>=|<=|>|<|=|\^|~)?\s*(.+)$/.exec(comparator.trim());
    if (!match) return false;

    const operator = match[1] || '=';
    const target = parseVersion(match[2]);
    if (!target) return false;

    switch (operator) {
        case '>=':
            return compareVersions(version, target) >= 0;
        case '<=':
            return compareVersions(version, target) <= 0;
        case '>':
            return compareVersions(version, target) > 0;
        case '<':
            return compareVersions(version, target) < 0;
        case '^':
            // Compatible-with: the leftmost non-zero field is held.
            if (compareVersions(version, target) < 0) return false;
            if (target.major > 0) return version.major === target.major;
            if (target.minor > 0) {
                return version.major === 0 && version.minor === target.minor;
            }
            return (
                version.major === 0 &&
                version.minor === 0 &&
                version.patch === target.patch
            );
        case '~':
            // Patch-level changes: major and minor are held. `~1` holds only
            // the major.
            if (compareVersions(version, target) < 0) return false;
            if (target.precision <= 1) return version.major === target.major;
            return (
                version.major === target.major && version.minor === target.minor
            );
        case '=':
        default:
            // A bare partial version is an X-range, matching npm: `1.9` means
            // any 1.9.x, and `1` means any 1.x. A full version is exact.
            if (target.precision >= 3) {
                return compareVersions(version, target) === 0;
            }
            if (target.precision === 2) {
                return (
                    version.major === target.major &&
                    version.minor === target.minor
                );
            }
            return version.major === target.major;
    }
};

const stripOperator = (comparator) =>
    comparator.replace(/^(>=|<=|>|<|=|\^|~)?\s*/, '');

/**
 * npm's prerelease rule: a prerelease version only satisfies a comparator set
 * that itself mentions a prerelease with the same [major, minor, patch] tuple.
 * Without this, `2.0.0-beta.1` would satisfy `>=1.9 <2` and a plugin could
 * load on an unreleased host it never declared support for.
 */
const prereleaseIsAnchored = (version, comparators) => {
    if (!version.prerelease) return true;

    return comparators.some((comparator) => {
        const target = parseVersion(stripOperator(comparator));
        return (
            target !== null &&
            target.prerelease !== null &&
            target.major === version.major &&
            target.minor === version.minor &&
            target.patch === version.patch
        );
    });
};

/**
 * Range matcher for the `host` field. Supports `*`, space-separated AND
 * comparators (`>=1.9 <2`, `>=1.9.0`), and `||` for alternatives. This is
 * deliberately a subset of npm's semver: enough for a host compatibility
 * range, and small enough to keep honest with tests.
 */
const satisfiesRange = (versionValue, range) => {
    const version = parseVersion(versionValue);
    if (!version) return false;
    if (typeof range !== 'string') return false;

    const trimmed = range.trim();
    if (!trimmed || trimmed === '*') return true;

    return trimmed.split('||').some((alternative) => {
        const comparators = alternative.trim().split(/\s+/).filter(Boolean);
        if (comparators.length === 0) return false;
        if (!prereleaseIsAnchored(version, comparators)) return false;
        return comparators.every((comparator) =>
            matchesComparator(version, comparator)
        );
    });
};

const isPlainObject = (value) =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validate a parsed manifest object.
 *
 * Returns `{ ok, errors, manifest }`. On failure `manifest` is still returned
 * with whatever could be read, so the plugin manager can name the plugin it is
 * complaining about. Callers must not load an entry point when `ok` is false.
 */
const validateManifest = (raw, options = {}) => {
    const hostVersion = options.hostVersion || null;
    const pluginApiVersion =
        options.pluginApiVersion === undefined
            ? PLUGIN_API_VERSION
            : options.pluginApiVersion;

    const errors = [];
    const manifest = isPlainObject(raw) ? { ...raw } : {};

    if (!isPlainObject(raw)) {
        return {
            ok: false,
            errors: [`${MANIFEST_FILENAME} must contain a JSON object`],
            manifest,
        };
    }

    // id
    if (typeof manifest.id !== 'string' || !manifest.id.trim()) {
        errors.push('`id` is required');
    } else if (manifest.id.length > MAX_ID_LENGTH) {
        errors.push(`\`id\` must be at most ${MAX_ID_LENGTH} characters`);
    } else if (!ID_PATTERN.test(manifest.id)) {
        errors.push(
            '`id` must be lowercase letters, digits, dot, dash or underscore'
        );
    }

    // name
    if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
        errors.push('`name` is required');
    } else if (manifest.name.length > MAX_TEXT_LENGTH) {
        errors.push(`\`name\` must be at most ${MAX_TEXT_LENGTH} characters`);
    }

    // description (optional)
    if (
        manifest.description !== undefined &&
        (typeof manifest.description !== 'string' ||
            manifest.description.length > MAX_TEXT_LENGTH)
    ) {
        errors.push(
            `\`description\` must be a string of at most ${MAX_TEXT_LENGTH} characters`
        );
    }

    // version
    if (!parseVersion(manifest.version)) {
        errors.push('`version` must be a semver string such as 1.0.0');
    }

    // pluginApi: the hard gate. A plugin built for another major must never be
    // imported, because the host API it expects may not exist.
    if (!Number.isInteger(manifest.pluginApi) || manifest.pluginApi < 1) {
        errors.push('`pluginApi` must be a positive integer');
    } else if (manifest.pluginApi !== pluginApiVersion) {
        errors.push(
            `requires plugin API ${manifest.pluginApi}, this host provides ${pluginApiVersion}`
        );
    }

    // host (optional range)
    if (manifest.host !== undefined) {
        if (typeof manifest.host !== 'string') {
            errors.push('`host` must be a string version range');
        } else if (hostVersion && !satisfiesRange(hostVersion, manifest.host)) {
            errors.push(
                `requires host ${manifest.host}, this host is ${hostVersion}`
            );
        } else if (!hostVersion && !satisfiesRange('0.0.0', manifest.host)) {
            // No host version to compare against: only reject a range that
            // cannot match anything at all.
            errors.push(`\`host\` range ${manifest.host} is not valid`);
        }
    }

    // entry
    if (!isSafeRelativePath(manifest.entry)) {
        errors.push(
            '`entry` must be a relative path inside the plugin directory'
        );
    }

    // styles (optional)
    if (manifest.styles !== undefined) {
        if (
            !Array.isArray(manifest.styles) ||
            manifest.styles.length > MAX_LICENCES
        ) {
            errors.push('`styles` must be an array of relative paths');
        } else if (manifest.styles.some((s) => !isSafeRelativePath(s))) {
            errors.push('every entry in `styles` must be a relative path');
        }
    }

    // shortcuts (optional). These become entries in the installed app's
    // launcher menu, so they are validated as strictly as anything else that
    // ends up on a user's home screen.
    if (manifest.shortcuts !== undefined) {
        if (
            !Array.isArray(manifest.shortcuts) ||
            manifest.shortcuts.length > MAX_SHORTCUTS
        ) {
            errors.push(
                `\`shortcuts\` must be an array of at most ${MAX_SHORTCUTS} entries`
            );
        } else {
            manifest.shortcuts.forEach((shortcut, index) => {
                const label = `\`shortcuts[${index}]\``;

                if (!isPlainObject(shortcut)) {
                    errors.push(`${label} must be an object`);
                    return;
                }

                if (
                    typeof shortcut.name !== 'string' ||
                    !shortcut.name.trim() ||
                    shortcut.name.length > MAX_TEXT_LENGTH
                ) {
                    errors.push(
                        `${label}.name must be a non-empty string of at most ${MAX_TEXT_LENGTH} characters`
                    );
                }

                for (const field of ['short_name', 'description']) {
                    if (
                        shortcut[field] !== undefined &&
                        (typeof shortcut[field] !== 'string' ||
                            shortcut[field].length > MAX_TEXT_LENGTH)
                    ) {
                        errors.push(
                            `${label}.${field} must be a string of at most ${MAX_TEXT_LENGTH} characters`
                        );
                    }
                }

                // Relative to the plugin's own route prefix, so a plugin can
                // only ever point at a route it owns.
                if (!isSafeRelativePath(shortcut.path)) {
                    errors.push(
                        `${label}.path must be a relative path, such as focus`
                    );
                }
            });
        }
    }

    return { ok: errors.length === 0, errors, manifest };
};

module.exports = {
    PLUGIN_API_VERSION,
    MANIFEST_FILENAME,
    MAX_SHORTCUTS,
    ID_PATTERN,
    isSafeRelativePath,
    parseVersion,
    compareVersions,
    satisfiesRange,
    validateManifest,
};
