import type React from 'react';

/**
 * The host API this plugin uses.
 *
 * Declared here rather than imported from Tududi so the plugin states its own
 * contract: it can be built and reviewed without the host's source, and the
 * surface it relies on is visible in one file. `pluginApi` in plugin.json is
 * what actually enforces compatibility with the running host.
 */

export interface Disposable {
    dispose(): void;
}

export interface RouteContribution {
    id: string;
    path: string;
    element: React.ComponentType<Record<string, never>>;
    nav?: {
        label: string;
        icon?: React.ComponentType<{ className?: string }>;
        order?: number;
    };
}

export interface ThemeContribution {
    id: string;
    className: string;
    label?: string;
    tokens?: Record<string, string>;
}

export interface SettingsPanelContribution {
    id: string;
    label: string;
    element: React.ComponentType<Record<string, never>>;
    order?: number;
}

/**
 * Returning false hides a sidebar item or section. Anything else — including a
 * throw, which the host catches — keeps it.
 */
export type NavFilter = (item: { path: string; section: string }) => boolean;

export interface PluginApi {
    pluginApi: number;
    plugin: { id: string; name: string; version: string | null };
    /** The host's React. Assign it in activate(); never import your own. */
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
    onDispose(fn: () => void): void;
}
