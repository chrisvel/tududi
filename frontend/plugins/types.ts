import type React from 'react';

/**
 * The extension contract version. A plugin declares the major it was built
 * against; the host refuses to import anything built for a different major,
 * because the API it expects may not exist. Additive host API changes do not
 * bump this.
 *
 * Must match `PLUGIN_API_VERSION` in `backend/modules/plugins/manifest.js`.
 */
export const PLUGIN_API_VERSION = 1;

/** A plugin as the server reports it: its manifest plus this user's state. */
export interface PluginListItem {
    id: string;
    name: string;
    version: string | null;
    description: string | null;
    pluginApi: number | null;
    host: string | null;
    entry: string | null;
    styles: string[];
    /** False when the server refused the manifest. Such a plugin is never imported. */
    ok: boolean;
    errors: string[];
    enabled: boolean;
}

/**
 * What an install or update did, as the server reports it. The archive names
 * its own plugin, so a second upload of the same plugin is an update: nothing
 * in the request says which of the two it is.
 */
export interface PluginInstallSummary {
    id: string;
    name: string;
    version: string | null;
    /** True when an installed plugin was replaced rather than added. */
    updated: boolean;
}

export interface PluginListResponse {
    pluginApiVersion: number;
    hostVersion: string | null;
    pluginsDir: string;
    /**
     * Whether this account may install, update or remove plugins on the
     * server. Enabling one is a per-account choice; putting code on the server
     * is an operator decision, so the browser is told which of the two it is
     * looking at rather than offering controls that would be refused.
     */
    canManage: boolean;
    enabled: string[];
    settings: Record<string, Record<string, unknown>>;
    activeTheme: string | null;
    plugins: PluginListItem[];
    /** Present on the response to an install or update. */
    install?: PluginInstallSummary;
    /** Present on the response to a removal. */
    remove?: { id: string };
}

export interface Disposable {
    dispose(): void;
}

/** A route the plugin adds. `path` is relative and is namespaced by the host. */
export interface RouteContribution {
    id: string;
    /** Relative path, e.g. `focus` becomes `/plugins/<pluginId>/focus`. */
    path: string;
    element: React.ComponentType<Record<string, never>>;
    /** Optional sidebar entry for this route. */
    nav?: {
        label: string;
        icon?: React.ComponentType<{ className?: string }>;
        order?: number;
    };
}

/** A root class plus CSS custom properties, applied while the theme is active. */
export interface ThemeContribution {
    id: string;
    /** Class added to <html>, e.g. `calm`. */
    className: string;
    label?: string;
    /** CSS custom properties set on :root while this theme is active. */
    tokens?: Record<string, string>;
}

export interface SettingsPanelContribution {
    id: string;
    label: string;
    element: React.ComponentType<Record<string, never>>;
    order?: number;
}

/**
 * Sidebar filtering. A filter returns false to hide an item. Returning
 * anything other than false keeps the item, so a filter that throws or returns
 * undefined cannot accidentally hide the whole navigation.
 */
export type NavFilter = (item: { path: string; section: string }) => boolean;

/**
 * What a plugin receives when it activates.
 *
 * `React` is the host's own React instance. A plugin must not bundle React:
 * a second copy passed into the host renderer breaks hooks. Build the plugin
 * with React marked external and assign the host copy at the top of the module:
 *
 *   let React;
 *   export function activate(api) { React = api.React; ... }
 */
export interface PluginApi {
    pluginApi: number;
    plugin: { id: string; name: string; version: string | null };
    React: typeof React;
    registerRoute(route: RouteContribution): Disposable;
    registerTheme(theme: ThemeContribution): Disposable;
    registerSettingsPanel(panel: SettingsPanelContribution): Disposable;
    registerNavFilter(filter: NavFilter): Disposable;
    activateTheme(themeId: string | null): Promise<void>;
    activeTheme(): string | null;
    settings: {
        get(): Promise<Record<string, unknown>>;
        set(patch: Record<string, unknown>): Promise<void>;
    };
    /** Thin authenticated wrapper, so a plugin can reach API this host does not model. */
    api: {
        get<T>(path: string): Promise<T>;
        post<T>(path: string, body?: unknown): Promise<T>;
        put<T>(path: string, body?: unknown): Promise<T>;
        patch<T>(path: string, body?: unknown): Promise<T>;
        del<T>(path: string): Promise<T>;
    };
    t(key: string, fallback?: string): string;
    log: {
        info(...args: unknown[]): void;
        warn(...args: unknown[]): void;
        error(...args: unknown[]): void;
    };
    /** Runs when the plugin is disabled or the page unloads. */
    onDispose(fn: () => void): void;
}

/** The module shape a plugin's entry point must export. */
export interface PluginModule {
    activate?(
        api: PluginApi
    ): void | (() => void) | Promise<void | (() => void)>;
    deactivate?(): void | Promise<void>;
}

export interface LoadedPlugin {
    id: string;
    name: string;
    version: string | null;
    /** Set when the plugin failed to load or activate. It is then not usable. */
    error: string | null;
    disposables: Disposable[];
}
