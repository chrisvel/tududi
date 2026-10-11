import { getAssetPath } from '../config/paths';
import { PLUGIN_API_VERSION, type PluginListItem } from './types';

/**
 * The server is authoritative for manifest validation
 * (`backend/modules/plugins/manifest.js`) and reports a plugin as `ok: false`
 * with its errors. The frontend re-checks only the subset it depends on before
 * building a URL and importing: the id has to be safe to put in a path, the
 * entry has to be a path inside the plugin's own directory, and the plugin API
 * major has to match. Duplicating the whole version-range engine on the client
 * would just be two things to keep in step.
 */

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

/** A plugin may only reference files inside its own directory. */
export const isSafeRelativePath = (value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 300) return false;
    if (trimmed.startsWith('/') || trimmed.startsWith('\\')) return false;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return false;
    if (trimmed.includes('\0')) return false;
    const segments = trimmed.split(/[\\/]+/);
    return !segments.includes('..');
};

export const pluginBaseUrl = (pluginId: string): string =>
    getAssetPath(`plugins/${pluginId}`);

/**
 * The `?v=` parameter is what makes the plugin's own files safe to treat as
 * immutable: a version bump is a new URL, so a cached bundle can never be
 * served for a version the host did not ask for.
 */
export const pluginAssetUrl = (
    pluginId: string,
    relativePath: string,
    version: string | null
): string =>
    `${pluginBaseUrl(pluginId)}/${relativePath}?v=${encodeURIComponent(
        version || '0'
    )}`;

export interface Importability {
    importable: boolean;
    reason: string | null;
}

/**
 * Decide whether a plugin's entry point may be imported.
 *
 * Anything other than an explicit yes is a no: a plugin that fails any check
 * is reported in the plugin manager and never executed.
 */
export const checkImportable = (plugin: PluginListItem): Importability => {
    if (!plugin.ok) {
        return {
            importable: false,
            reason:
                plugin.errors.length > 0
                    ? plugin.errors.join('; ')
                    : 'the server rejected this plugin manifest',
        };
    }

    if (!ID_PATTERN.test(plugin.id)) {
        return {
            importable: false,
            reason: `\`${plugin.id}\` is not a usable plugin id`,
        };
    }

    if (plugin.pluginApi !== PLUGIN_API_VERSION) {
        return {
            importable: false,
            reason: `built for plugin API ${plugin.pluginApi}, this host provides ${PLUGIN_API_VERSION}`,
        };
    }

    if (!isSafeRelativePath(plugin.entry)) {
        return {
            importable: false,
            reason: '`entry` must be a relative path inside the plugin directory',
        };
    }

    for (const style of plugin.styles) {
        if (!isSafeRelativePath(style)) {
            return {
                importable: false,
                reason: `stylesheet path \`${style}\` is not a relative path`,
            };
        }
    }

    return { importable: true, reason: null };
};
