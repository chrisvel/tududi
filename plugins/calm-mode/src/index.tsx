import type { Disposable, NavFilter, PluginApi } from './host-api';
import { setReact } from './react';
import {
    createCalmSettings,
    DEFAULT_SETTINGS,
    type CalmSettingsState,
} from './CalmSettings';
import { createFocusPage } from './FocusPage';

const THEME_ID = 'calm';

/**
 * Sections hidden while "show less navigation" is on.
 *
 * `favorites` is deliberately absent: a person's own favourites are already a
 * deliberate shortlist, and hiding them would remove the reduction they chose
 * for themselves.
 */
const QUIET_SECTIONS = new Set([
    'projects',
    'areas',
    'goals',
    'notes',
    'tags',
    'people',
    'habits',
    'views',
    'boards',
    'insights',
]);

/** The navigation that keeps the core loop: capture, today, what is next. */
const KEPT_NAV_PATHS = new Set([
    '/today',
    '/inbox',
    '/upcoming?status=active',
]);

export async function activate(api: PluginApi): Promise<void> {
    // Must come first: every component in this plugin resolves React from here.
    setReact(api.React);

    const stored = (await api.settings.get()) as Partial<CalmSettingsState>;
    let state: CalmSettingsState = { ...DEFAULT_SETTINGS, ...stored };

    let navFilter: Disposable | null = null;

    const navFilterImpl: NavFilter = ({ path, section }) => {
        if (!state.enabled || !state.reduceNavigation) return true;
        // The plugin's own pages are the point of the mode.
        if (section === 'plugin') return true;
        if (section === 'nav') return KEPT_NAV_PATHS.has(path);
        return !QUIET_SECTIONS.has(section);
    };

    /**
     * Re-registering the filter is what makes the sidebar re-render: the host
     * redraws when the registry changes, and a settings change alone would
     * otherwise not be noticed until the next reload.
     */
    const refreshNavFilter = () => {
        navFilter?.dispose();
        navFilter = api.registerNavFilter(navFilterImpl);
    };

    const syncTheme = async (enabled: boolean) => {
        // No write when nothing changed: activation runs on every page load,
        // and that should not mean a request each time.
        if ((api.activeTheme() === THEME_ID) === enabled) return;
        await api.activateTheme(enabled ? THEME_ID : null);
    };

    const applyState = (next: CalmSettingsState) => {
        state = next;
        refreshNavFilter();
        syncTheme(next.enabled).catch((error) =>
            api.log.error('could not apply the theme', error)
        );
    };

    api.registerTheme({
        id: THEME_ID,
        className: 'calm',
        label: 'Calm Mode',
    });

    api.registerRoute({
        id: 'focus',
        path: 'focus',
        element: createFocusPage(api),
        nav: { label: 'One thing', order: 5 },
    });

    api.registerSettingsPanel({
        id: 'settings',
        label: 'Calm Mode',
        element: createCalmSettings(api, applyState),
        order: 10,
    });

    refreshNavFilter();

    if (state.enabled) {
        await syncTheme(true);
    }

    api.onDispose(() => {
        navFilter?.dispose();
        navFilter = null;
    });
}

export function deactivate(): void {
    // The host disposes every registration this plugin made.
}
