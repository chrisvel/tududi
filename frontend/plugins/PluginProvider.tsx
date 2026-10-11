import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
    PluginContext,
    type PluginContextValue,
    type PluginStatus,
} from './context';
import { createPluginApi } from './host';
import { loadPlugins, unloadPlugin } from './loader';
import { PluginRegistry } from './registry';
import {
    fetchPlugins,
    updatePlugin,
    updatePluginState,
} from '../utils/pluginService';
import type { LoadedPlugin, PluginListResponse } from './types';

interface Props {
    /** Plugins are only loaded once the user is authenticated. */
    enabled: boolean;
    children: React.ReactNode;
}

interface AppliedTheme {
    className: string;
    tokenNames: string[];
}

export const PluginProvider: React.FC<Props> = ({ enabled, children }) => {
    const registryRef = useRef<PluginRegistry>();
    if (!registryRef.current) {
        registryRef.current = new PluginRegistry();
    }
    const registry = registryRef.current;

    // The i18n instance is taken from React here rather than imported at module
    // scope, so that importing the plugin host cannot change module evaluation
    // order for its consumers.
    const { t } = useTranslation();
    const translateRef = useRef(t);
    translateRef.current = t;

    const [status, setStatus] = useState<PluginStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [response, setResponse] = useState<PluginListResponse | null>(null);
    const [plugins, setPlugins] = useState<LoadedPlugin[]>([]);
    const [failed, setFailed] = useState<LoadedPlugin[]>([]);

    // Guards against a second load (or an unmount) racing the first.
    const loadToken = useRef(0);
    const loadedRef = useRef<LoadedPlugin[]>([]);
    const appliedThemeRef = useRef<AppliedTheme | null>(null);

    const snapshot = useSyncExternalStore(
        registry.subscribe,
        registry.getSnapshot,
        registry.getSnapshot
    );

    const activeThemeKey = response?.activeTheme ?? null;

    const unloadAll = useCallback(() => {
        for (const plugin of loadedRef.current) {
            unloadPlugin(plugin);
        }
        loadedRef.current = [];
        setPlugins([]);
    }, []);

    const reload = useCallback(async () => {
        const token = ++loadToken.current;

        if (!enabled) {
            setStatus('idle');
            return;
        }

        setStatus('loading');
        setError(null);

        // Release what is loaded before loading the set again. The registry
        // refuses a second registration of the same route, theme or filter —
        // deliberately, since two plugins claiming one id is a mistake worth
        // surfacing — so without this a reload would report the plugins it had
        // already loaded as failures. Every reload after the first goes
        // through here: enabling or disabling a plugin, installing one, and
        // removing one all change the set.
        unloadAll();

        try {
            const list = await fetchPlugins();

            // A newer load started while this one was in flight.
            if (token !== loadToken.current) return;

            setResponse(list);

            const result = await loadPlugins(list, {
                registry,
                createApi: (plugin) =>
                    createPluginApi({
                        registry,
                        plugin,
                        settings: list.settings[plugin.id] || {},
                        activeThemeKey: list.activeTheme,
                        t: (key, fallback) =>
                            String(
                                translateRef.current(key, {
                                    defaultValue: fallback,
                                })
                            ),
                        setActiveTheme: async (themeKey) => {
                            const updated = await updatePluginState({
                                activeTheme: themeKey,
                            });
                            if (token === loadToken.current) {
                                setResponse(updated);
                            }
                        },
                        onResponse: (updated) => {
                            if (token === loadToken.current) {
                                setResponse(updated);
                            }
                        },
                    }),
            });

            if (token !== loadToken.current) {
                // A newer load won; release what this one registered.
                for (const plugin of [...result.loaded, ...result.failed]) {
                    unloadPlugin(plugin);
                }
                return;
            }

            loadedRef.current = result.loaded;
            setPlugins(result.loaded);
            setFailed(result.failed);
            setStatus('ready');
        } catch (loadError) {
            if (token !== loadToken.current) return;
            setStatus('error');
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : String(loadError)
            );
        }
    }, [enabled, registry, unloadAll]);

    useEffect(() => {
        reload();
        // Reloading when `enabled` changes is the point: signing out must drop
        // every plugin's contributions.
        return () => {
            // Invalidate in-flight work and release contributions on unmount.
            loadToken.current += 1;
        };
    }, [reload]);

    useEffect(
        () => () => {
            unloadAll();
        },
        [unloadAll]
    );

    /**
     * Apply the active theme to the document element.
     *
     * Tokens are written as CSS custom properties by the host rather than by the
     * plugin, so a plugin can restyle the app without being able to inject
     * arbitrary global CSS.
     */
    useEffect(() => {
        const root = document?.documentElement;
        if (!root) return;

        const previous = appliedThemeRef.current;
        if (previous) {
            root.classList.remove(previous.className);
            for (const name of previous.tokenNames) {
                root.style.removeProperty(name);
            }
        }

        const theme =
            snapshot.themes.find((entry) => entry.key === activeThemeKey) ||
            null;

        if (theme) {
            root.classList.add(theme.className);
            for (const [name, value] of Object.entries(theme.tokens)) {
                root.style.setProperty(name, value);
            }
            appliedThemeRef.current = {
                className: theme.className,
                tokenNames: Object.keys(theme.tokens),
            };
        } else {
            appliedThemeRef.current = null;
        }
    }, [activeThemeKey, snapshot]);

    const setEnabled = useCallback(
        async (pluginId: string, nextEnabled: boolean) => {
            const updated = await updatePlugin(pluginId, {
                enabled: nextEnabled,
            });
            setResponse(updated);
            // Enabling or disabling changes which plugins activate, so the only
            // correct move is a clean reload of the set.
            await reload();
        },
        [reload]
    );

    const setActiveThemeKey = useCallback(async (key: string | null) => {
        const updated = await updatePluginState({ activeTheme: key });
        setResponse(updated);
    }, []);

    const value = useMemo<PluginContextValue>(
        () => ({
            status,
            error,
            response,
            plugins,
            failed,
            registry,
            snapshot,
            activeThemeKey,
            reload,
            setEnabled,
            setActiveThemeKey,
        }),
        [
            status,
            error,
            response,
            plugins,
            failed,
            registry,
            snapshot,
            activeThemeKey,
            reload,
            setEnabled,
            setActiveThemeKey,
        ]
    );

    return (
        <PluginContext.Provider value={value}>
            {children}
        </PluginContext.Provider>
    );
};

export default PluginProvider;
