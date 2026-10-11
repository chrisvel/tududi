import { createContext, useContext } from 'react';
import type { RegistrySnapshot, PluginRegistry } from './registry';
import type { LoadedPlugin, PluginListResponse } from './types';

export type PluginStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PluginContextValue {
    status: PluginStatus;
    /** A message when the plugin list itself could not be fetched. */
    error: string | null;
    response: PluginListResponse | null;
    /** Plugins that activated successfully. */
    plugins: LoadedPlugin[];
    /** Plugins that failed to load, for the plugin manager to report. */
    failed: LoadedPlugin[];
    registry: PluginRegistry;
    snapshot: RegistrySnapshot;
    activeThemeKey: string | null;
    reload(): Promise<void>;
    setEnabled(pluginId: string, enabled: boolean): Promise<void>;
    setActiveThemeKey(key: string | null): Promise<void>;
}

/**
 * Kept in its own module, with type-only imports, on purpose.
 *
 * The sidebar and the plugin route host only need to *read* the context. If
 * they imported it from `PluginProvider` they would also pull in the loader,
 * the host API, the API client and the i18n instance, which changes module
 * evaluation order for every consumer and makes those components far heavier
 * than they need to be.
 */
export const PluginContext = createContext<PluginContextValue | null>(null);

export const usePluginHost = (): PluginContextValue => {
    const value = useContext(PluginContext);
    if (!value) {
        // A component reaching for the host outside the provider is a wiring
        // mistake, not a runtime condition worth degrading around.
        throw new Error('usePluginHost must be used inside <PluginProvider>');
    }
    return value;
};

/**
 * For components that also have to work with no plugin host present.
 *
 * The sidebar and the routes render in tests and in startup paths that mount no
 * provider; they must simply contribute nothing rather than throw.
 */
export const useOptionalPluginHost = (): PluginContextValue | null =>
    useContext(PluginContext);
