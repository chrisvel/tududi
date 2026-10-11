import type { CreatedPluginApi } from './host';
import { checkImportable, pluginAssetUrl } from './manifest';
import type { PluginRegistry } from './registry';
import type {
    Disposable,
    LoadedPlugin,
    PluginListItem,
    PluginListResponse,
    PluginModule,
} from './types';

/** Injected so tests never touch the network. */
export type PluginImporter = (url: string) => Promise<unknown>;

const defaultImporter: PluginImporter = (url) =>
    // `webpackIgnore` keeps the bundler from rewriting this into a context
    // module: the URL only exists at runtime, since the plugin lives on the
    // server rather than in the build.
    import(/* webpackIgnore: true */ url);

export interface LoadPluginsOptions {
    registry: PluginRegistry;
    createApi: (plugin: PluginListItem) => CreatedPluginApi;
    importer?: PluginImporter;
    documentRef?: Document;
}

const describeError = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

const injectStyles = (
    plugin: PluginListItem,
    documentRef: Document
): HTMLLinkElement[] =>
    plugin.styles.map((style) => {
        const link = documentRef.createElement('link');
        link.rel = 'stylesheet';
        link.href = pluginAssetUrl(plugin.id, style, plugin.version);
        // Lets an operator see which plugin a stylesheet came from.
        link.dataset.pluginId = plugin.id;
        documentRef.head.appendChild(link);
        return link;
    });

const removeElements = (elements: HTMLLinkElement[]) => {
    for (const element of elements) {
        element.parentNode?.removeChild(element);
    }
};

/**
 * Load one plugin: validate, inject its stylesheets, import its entry point and
 * call `activate`.
 *
 * Never throws. A plugin that fails for any reason comes back with `error` set
 * and is reported in the plugin manager, because one broken plugin must not
 * stop the others from loading or the app from starting.
 */
export const loadPlugin = async (
    plugin: PluginListItem,
    options: LoadPluginsOptions
): Promise<LoadedPlugin> => {
    const documentRef = options.documentRef || document;
    const importer = options.importer || defaultImporter;

    const base: LoadedPlugin = {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        error: null,
        disposables: [],
    };

    const importability = checkImportable(plugin);
    if (!importability.importable) {
        return { ...base, error: importability.reason };
    }

    let created: CreatedPluginApi | null = null;
    let styles: HTMLLinkElement[] = [];

    try {
        styles = injectStyles(plugin, documentRef);

        const url = pluginAssetUrl(
            plugin.id,
            plugin.entry as string,
            plugin.version
        );
        const imported = (await importer(url)) as PluginModule & {
            default?: PluginModule;
        };

        // Some bundlers wrap the module in `default`; accept either shape.
        const pluginModule: PluginModule =
            imported && typeof imported.activate === 'function'
                ? imported
                : imported?.default &&
                    typeof imported.default.activate === 'function'
                  ? imported.default
                  : (imported as PluginModule);

        const hasActivate = typeof pluginModule?.activate === 'function';

        if (!hasActivate) {
            removeElements(styles);
            return {
                ...base,
                error: 'entry point does not export an `activate` function',
            };
        }

        created = options.createApi(plugin);

        const cleanup = await pluginModule.activate?.(created.api);

        const disposables: Disposable[] = [created];

        if (typeof cleanup === 'function') {
            disposables.push({ dispose: cleanup });
        }

        return { ...base, disposables };
    } catch (error) {
        // Roll back whatever landed before the failure: a half-activated plugin
        // that leaves routes or a theme behind is worse than one that never ran.
        removeElements(styles);
        try {
            created?.dispose();
        } catch {
            // Already failing; the original error is the useful one.
        }

        return { ...base, error: describeError(error) };
    }
};

export interface LoadedPlugins {
    loaded: LoadedPlugin[];
    /** Plugins that failed, kept separate so the manager can list them. */
    failed: LoadedPlugin[];
}

/**
 * Load every enabled plugin in the response.
 *
 * Plugins load sequentially rather than in parallel. Activation order is then
 * deterministic (installation order, by id), which matters when two plugins both
 * add to the navigation: a nondeterministic order would make the sidebar move
 * between reloads.
 */
export const loadPlugins = async (
    response: PluginListResponse,
    options: LoadPluginsOptions
): Promise<LoadedPlugins> => {
    const loaded: LoadedPlugin[] = [];
    const failed: LoadedPlugin[] = [];

    for (const plugin of response.plugins) {
        if (!plugin.enabled) continue;

        const result = await loadPlugin(plugin, options);
        if (result.error) failed.push(result);
        else loaded.push(result);
    }

    return { loaded, failed };
};

/** Release everything a loaded plugin registered. */
export const unloadPlugin = (plugin: LoadedPlugin) => {
    for (const disposable of plugin.disposables) {
        try {
            disposable.dispose();
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn(
                `[plugin:${plugin.id}] failed to unload cleanly`,
                error
            );
        }
    }
    plugin.disposables.length = 0;
};
