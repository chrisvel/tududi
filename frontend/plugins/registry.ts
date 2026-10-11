import type React from 'react';
import type {
    Disposable,
    NavFilter,
    PluginApi,
    RouteContribution,
    SettingsPanelContribution,
    ThemeContribution,
} from './types';

export type PluginIcon = React.ComponentType<{ className?: string }>;

/**
 * Every contribution a plugin makes lands here.
 *
 * Two properties matter and are enforced rather than documented:
 *  - keys are namespaced `<pluginId>:<localId>`, so two plugins cannot silently
 *    claim the same id and one cannot impersonate another;
 *  - every registration returns a Disposable, and disabling a plugin disposes
 *    all of its registrations, so a disabled plugin leaves nothing behind.
 */
export interface RegisteredRoute {
    key: string;
    pluginId: string;
    id: string;
    /** Already namespaced with the host's `/plugins/<pluginId>` prefix. */
    path: string;
    element: RouteContribution['element'];
    nav: {
        label: string;
        icon?: PluginIcon;
        order: number;
    } | null;
}

export interface RegisteredTheme {
    key: string;
    pluginId: string;
    id: string;
    label: string | null;
    className: string;
    tokens: Record<string, string>;
}

export interface RegisteredSettingsPanel {
    key: string;
    pluginId: string;
    id: string;
    label: string;
    element: SettingsPanelContribution['element'];
    order: number;
}

export interface RegisteredNavFilter {
    key: string;
    pluginId: string;
    id: string;
    filter: NavFilter;
}

export interface RegistrySnapshot {
    routes: RegisteredRoute[];
    themes: RegisteredTheme[];
    settingsPanels: RegisteredSettingsPanel[];
    navFilters: RegisteredNavFilter[];
    version: number;
}

const namespacedKey = (pluginId: string, localId: string) =>
    `${pluginId}:${localId}`;

/** A plugin may only reach pages under its own namespace. */
export const pluginRoutePath = (pluginId: string, relativePath: string) => {
    const trimmed = String(relativePath || '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
    return `/plugins/${pluginId}${trimmed ? `/${trimmed}` : ''}`;
};

export class PluginRegistry {
    private routes = new Map<string, RegisteredRoute>();
    private themes = new Map<string, RegisteredTheme>();
    private settingsPanels = new Map<string, RegisteredSettingsPanel>();
    private navFilters = new Map<string, RegisteredNavFilter>();
    private listeners = new Set<() => void>();
    private snapshot: RegistrySnapshot = {
        routes: [],
        themes: [],
        settingsPanels: [],
        navFilters: [],
        version: 0,
    };

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    /**
     * A cached object, rebuilt only when something changed. `useSyncExternalStore`
     * compares snapshots by identity, so returning a fresh object every call
     * would loop forever.
     */
    getSnapshot = (): RegistrySnapshot => this.snapshot;

    private rebuild() {
        this.snapshot = {
            routes: Array.from(this.routes.values()),
            themes: Array.from(this.themes.values()),
            settingsPanels: Array.from(this.settingsPanels.values()),
            navFilters: Array.from(this.navFilters.values()),
            version: this.snapshot.version + 1,
        };
        this.listeners.forEach((listener) => listener());
    }

    private take<T extends { key: string; pluginId: string }>(
        map: Map<string, T>,
        pluginId: string,
        localId: string,
        describe: string
    ): { key: string } {
        const key = namespacedKey(pluginId, localId);
        if (map.has(key)) {
            throw new Error(
                `${describe} id "${localId}" is already registered by this plugin`
            );
        }
        return { key };
    }

    private disposable(key: string, remove: (key: string) => void): Disposable {
        let disposed = false;
        return {
            dispose: () => {
                if (disposed) return;
                disposed = true;
                remove(key);
                this.rebuild();
            },
        };
    }

    registerRoute(pluginId: string, route: RouteContribution): Disposable {
        if (!route || typeof route.id !== 'string' || !route.id) {
            throw new Error('registerRoute requires an id');
        }
        if (typeof route.element !== 'function') {
            throw new Error(
                `route "${route.id}" must provide a React component as \`element\``
            );
        }

        const { key } = this.take(this.routes, pluginId, route.id, 'route');

        this.routes.set(key, {
            key,
            pluginId,
            id: route.id,
            path: pluginRoutePath(pluginId, route.path),
            element: route.element,
            nav: route.nav
                ? {
                      label: route.nav.label,
                      icon: route.nav.icon,
                      order:
                          typeof route.nav.order === 'number'
                              ? route.nav.order
                              : 100,
                  }
                : null,
        });
        this.rebuild();

        return this.disposable(key, (k) => this.routes.delete(k));
    }

    registerTheme(pluginId: string, theme: ThemeContribution): Disposable {
        if (!theme || typeof theme.id !== 'string' || !theme.id) {
            throw new Error('registerTheme requires an id');
        }
        // Exactly one class token: a plugin must not be able to put padding or
        // a compound selector into the class list on <html>.
        const className =
            typeof theme.className === 'string' ? theme.className.trim() : '';
        if (!/^-?[A-Za-z_][A-Za-z0-9_-]*$/.test(className)) {
            throw new Error(
                `theme "${theme.id}" must provide a single CSS class name as \`className\``
            );
        }

        const { key } = this.take(this.themes, pluginId, theme.id, 'theme');

        // Keys and values are both validated, because they are written straight
        // onto the document element as CSS custom properties.
        const tokens: Record<string, string> = {};
        for (const [name, value] of Object.entries(theme.tokens || {})) {
            if (!/^--[a-zA-Z0-9-_]+$/.test(name)) continue;
            if (typeof value !== 'string') continue;
            tokens[name] = value;
        }

        this.themes.set(key, {
            key,
            pluginId,
            id: theme.id,
            label: theme.label || null,
            // Used as written, because the plugin's own stylesheet targets it.
            // Collisions between plugins are a cosmetic risk, not a security
            // one: a plugin already runs with the page's own privileges.
            className,
            tokens,
        });
        this.rebuild();

        return this.disposable(key, (k) => this.themes.delete(k));
    }

    registerSettingsPanel(
        pluginId: string,
        panel: SettingsPanelContribution
    ): Disposable {
        if (!panel || typeof panel.id !== 'string' || !panel.id) {
            throw new Error('registerSettingsPanel requires an id');
        }
        if (typeof panel.element !== 'function') {
            throw new Error(
                `settings panel "${panel.id}" must provide a React component as \`element\``
            );
        }

        const { key } = this.take(
            this.settingsPanels,
            pluginId,
            panel.id,
            'settings panel'
        );

        this.settingsPanels.set(key, {
            key,
            pluginId,
            id: panel.id,
            label: panel.label || panel.id,
            element: panel.element,
            order: typeof panel.order === 'number' ? panel.order : 100,
        });
        this.rebuild();

        return this.disposable(key, (k) => this.settingsPanels.delete(k));
    }

    registerNavFilter(pluginId: string, filter: NavFilter): Disposable {
        if (typeof filter !== 'function') {
            throw new Error('registerNavFilter requires a function');
        }

        const key = namespacedKey(
            pluginId,
            `nav-filter-${this.navFilters.size}`
        );
        this.navFilters.set(key, {
            key,
            pluginId,
            id: key,
            filter,
        });
        this.rebuild();

        return this.disposable(key, (k) => this.navFilters.delete(k));
    }

    /**
     * Apply every plugin's nav filters. A filter that throws, or that returns
     * anything other than exactly false, keeps the item: hiding navigation by
     * accident is worse than failing to hide it.
     */
    isNavItemVisible(item: { path: string; section: string }): boolean {
        for (const { filter } of this.navFilters.values()) {
            try {
                if (filter(item) === false) return false;
            } catch {
                continue;
            }
        }
        return true;
    }

    getRoute(key: string): RegisteredRoute | undefined {
        return this.routes.get(key);
    }

    /** The namespaced key for a plugin's own theme, or null if unregistered. */
    themeKey(pluginId: string, localId: string): string | null {
        const key = namespacedKey(pluginId, localId);
        return this.themes.has(key) ? key : null;
    }

    /** Everything a plugin registered, so disabling it can be complete. */
    contributionsOf(pluginId: string): Disposable[] {
        const remove = <T extends { pluginId: string }>(
            map: Map<string, T>
        ): string[] =>
            Array.from(map.entries())
                .filter(([, value]) => value.pluginId === pluginId)
                .map(([key]) => key);

        const routeKeys = remove(this.routes);
        const themeKeys = remove(this.themes);
        const panelKeys = remove(this.settingsPanels);
        const filterKeys = remove(this.navFilters);

        return [
            ...routeKeys.map((key) =>
                this.disposable(key, (k) => this.routes.delete(k))
            ),
            ...themeKeys.map((key) =>
                this.disposable(key, (k) => this.themes.delete(k))
            ),
            ...panelKeys.map((key) =>
                this.disposable(key, (k) => this.settingsPanels.delete(k))
            ),
            ...filterKeys.map((key) =>
                this.disposable(key, (k) => this.navFilters.delete(k))
            ),
        ];
    }

    /** @internal exported for tests */
    get size() {
        return {
            routes: this.routes.size,
            themes: this.themes.size,
            settingsPanels: this.settingsPanels.size,
            navFilters: this.navFilters.size,
        };
    }
}

/** Exported so the host can type the api it builds. */
export type { PluginApi };
