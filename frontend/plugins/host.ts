import React from 'react';
import { pluginRequest, updatePlugin } from '../utils/pluginService';
import type { PluginRegistry } from './registry';
import type {
    Disposable,
    PluginApi,
    PluginListResponse,
    PluginListItem,
} from './types';
import { PLUGIN_API_VERSION } from './types';

export interface PluginApiOptions {
    registry: PluginRegistry;
    plugin: PluginListItem;
    settings: Record<string, unknown>;
    /** Namespaced key (`<pluginId>:<themeId>`) of the active theme, if any. */
    activeThemeKey: string | null;
    /** Passed in by the provider so this module never imports the i18n instance. */
    t(key: string, fallback?: string): string;
    /** Persists and applies a theme. Owned by the provider, which also re-renders. */
    setActiveTheme(themeKey: string | null): Promise<void>;
    /** Called after a settings write so the provider refreshes its copy. */
    onResponse(response: PluginListResponse): void;
}

export interface CreatedPluginApi {
    api: PluginApi;
    dispose(): void;
}

/**
 * Build the object a plugin receives in `activate`.
 *
 * Every registration goes through the registry, which namespaces it and returns
 * a disposable, so `dispose()` here is what guarantees a disabled plugin leaves
 * nothing behind.
 */
export const createPluginApi = (
    options: PluginApiOptions
): CreatedPluginApi => {
    const { registry, plugin } = options;

    const registrations: Disposable[] = [];
    const disposeCallbacks: Array<() => void> = [];
    let disposed = false;
    let settings = { ...options.settings };
    let activeThemeKey = options.activeThemeKey;
    const themeKeyPrefix = `${plugin.id}:`;

    const assertLive = (method: string) => {
        if (disposed) {
            throw new Error(
                `Plugin "${plugin.id}" called api.${method}() after it was disposed`
            );
        }
    };

    const track = (disposable: Disposable): Disposable => {
        registrations.push(disposable);
        return disposable;
    };

    const prefix = `[plugin:${plugin.id}]`;
    const makeLogger =
        (level: 'info' | 'warn' | 'error') =>
        (...args: unknown[]) => {
            // eslint-disable-next-line no-console
            console[level](prefix, ...args);
        };

    const api: PluginApi = {
        pluginApi: PLUGIN_API_VERSION,
        plugin: {
            id: plugin.id,
            name: plugin.name,
            version: plugin.version,
        },
        // The host's own React, so a plugin never bundles a second copy: two
        // Reacts in one renderer is the classic way in-page plugins break.
        React,

        registerRoute(route) {
            assertLive('registerRoute');
            return track(registry.registerRoute(plugin.id, route));
        },

        registerTheme(theme) {
            assertLive('registerTheme');
            return track(registry.registerTheme(plugin.id, theme));
        },

        registerSettingsPanel(panel) {
            assertLive('registerSettingsPanel');
            return track(registry.registerSettingsPanel(plugin.id, panel));
        },

        registerNavFilter(filter) {
            assertLive('registerNavFilter');
            return track(registry.registerNavFilter(plugin.id, filter));
        },

        async activateTheme(themeLocalId) {
            assertLive('activateTheme');
            if (themeLocalId !== null) {
                const key = registry.themeKey(plugin.id, themeLocalId);
                if (!key) {
                    throw new Error(
                        `Plugin "${plugin.id}" tried to activate theme "${themeLocalId}" before registering it`
                    );
                }
                activeThemeKey = key;
            } else {
                activeThemeKey = null;
            }
            await options.setActiveTheme(activeThemeKey);
        },

        activeTheme() {
            // Only this plugin's own theme is reported back, so one plugin can
            // never read or disturb another's.
            if (!activeThemeKey) return null;
            return activeThemeKey.startsWith(themeKeyPrefix)
                ? activeThemeKey.slice(themeKeyPrefix.length)
                : null;
        },

        settings: {
            async get() {
                return { ...settings };
            },
            async set(patch) {
                assertLive('settings.set');
                const response = await updatePlugin(plugin.id, {
                    settings: patch,
                });
                settings = {
                    ...response.settings[plugin.id],
                };
                options.onResponse(response);
            },
        },

        api: {
            get: (path) => pluginRequest(path, 'GET'),
            post: (path, body) => pluginRequest(path, 'POST', body),
            put: (path, body) => pluginRequest(path, 'PUT', body),
            patch: (path, body) => pluginRequest(path, 'PATCH', body),
            del: (path) => pluginRequest(path, 'DELETE'),
        },

        t(key, fallback) {
            return options.t(key, fallback);
        },

        log: {
            info: makeLogger('info'),
            warn: makeLogger('warn'),
            error: makeLogger('error'),
        },

        onDispose(fn) {
            if (disposed) {
                // A callback registered during teardown would never run.
                fn();
                return;
            }
            disposeCallbacks.push(fn);
        },
    };

    return {
        api,
        dispose() {
            if (disposed) return;
            disposed = true;

            for (const fn of disposeCallbacks) {
                try {
                    fn();
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.warn(`${prefix} onDispose callback threw`, error);
                }
            }
            disposeCallbacks.length = 0;

            for (const registration of registrations) {
                try {
                    registration.dispose();
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.warn(
                        `${prefix} failed to release a registration`,
                        error
                    );
                }
            }
            registrations.length = 0;
        },
    };
};
