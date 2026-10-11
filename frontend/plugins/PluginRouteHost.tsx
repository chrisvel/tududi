import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PluginBoundary from './PluginBoundary';
import { useOptionalPluginHost } from './context';

/**
 * The single host route for plugin pages: `/plugins/:pluginId/*`.
 *
 * Plugins do not hand the router their own `<Route>` elements, because a
 * `<Routes>` only accepts `Route` children directly and the plugin set is known
 * only after an async load. Instead every plugin page lives under one namespace
 * and this host resolves the path against the registry.
 */
const PluginRouteHost: React.FC = () => {
    const { t } = useTranslation();
    const host = useOptionalPluginHost();
    const { pluginId, '*': splat } = useParams<{
        pluginId: string;
        '*': string;
    }>();

    const requested = `/plugins/${pluginId}${splat ? `/${splat}` : ''}`;

    const candidates = (host?.snapshot.routes || []).filter(
        (route) =>
            route.path === requested || requested.startsWith(`${route.path}/`)
    );

    // Longest path wins, so a plugin registering both `/focus` and
    // `/focus/today` resolves to the more specific page.
    const match = candidates.sort((a, b) => b.path.length - a.path.length)[0];

    if (!match) {
        return (
            <div className="p-6">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('plugins.pageNotFound', 'Page not found')}
                </h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    {t(
                        'plugins.pageNotFoundHint',
                        'This page belongs to a plugin that is not enabled on this account.'
                    )}
                </p>
            </div>
        );
    }

    const Element = match.element;

    return (
        <PluginBoundary pluginId={match.pluginId}>
            <Element />
        </PluginBoundary>
    );
};

export default PluginRouteHost;
