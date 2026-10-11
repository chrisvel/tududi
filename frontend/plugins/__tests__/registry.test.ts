import { PluginRegistry, pluginRoutePath } from '../registry';

const Element = () => null;
const Icon = () => null;

describe('PluginRegistry', () => {
    let registry: PluginRegistry;

    beforeEach(() => {
        registry = new PluginRegistry();
    });

    describe('routes', () => {
        it('namespaces every plugin page under /plugins/<id>', () => {
            registry.registerRoute('calm-mode', {
                id: 'focus',
                path: 'focus',
                element: Element,
            });

            expect(registry.getSnapshot().routes[0].path).toBe(
                '/plugins/calm-mode/focus'
            );
        });

        it('normalises surrounding slashes in the relative path', () => {
            expect(pluginRoutePath('p', '/focus/')).toBe('/plugins/p/focus');
            expect(pluginRoutePath('p', '')).toBe('/plugins/p');
        });

        it('refuses a duplicate route id from the same plugin', () => {
            registry.registerRoute('p', {
                id: 'a',
                path: 'a',
                element: Element,
            });

            expect(() =>
                registry.registerRoute('p', {
                    id: 'a',
                    path: 'b',
                    element: Element,
                })
            ).toThrow(/already registered/);
        });

        it('lets two different plugins use the same local id', () => {
            registry.registerRoute('one', {
                id: 'focus',
                path: 'focus',
                element: Element,
            });
            registry.registerRoute('two', {
                id: 'focus',
                path: 'focus',
                element: Element,
            });

            expect(registry.getSnapshot().routes).toHaveLength(2);
        });

        it('requires a React component as the element', () => {
            expect(() =>
                registry.registerRoute('p', {
                    id: 'a',
                    path: 'a',
                    element: undefined as never,
                })
            ).toThrow(/must provide a React component/);
        });

        it('carries the nav contribution with a default order', () => {
            registry.registerRoute('p', {
                id: 'a',
                path: 'a',
                element: Element,
                nav: { label: 'Focus', icon: Icon },
            });

            expect(registry.getSnapshot().routes[0].nav).toEqual({
                label: 'Focus',
                icon: Icon,
                order: 100,
            });
        });
    });

    describe('themes', () => {
        it('accepts only a single class token', () => {
            expect(() =>
                registry.registerTheme('p', {
                    id: 't',
                    className: 'calm dark',
                })
            ).toThrow(/single CSS class name/);

            expect(() =>
                registry.registerTheme('p', {
                    id: 't',
                    className: '.calm',
                })
            ).toThrow(/single CSS class name/);
        });

        it('drops tokens whose name or value is unusable', () => {
            registry.registerTheme('p', {
                id: 't',
                className: 'calm',
                tokens: {
                    '--calm-bg': '#eee',
                    'not-a-custom-property': 'x',
                    '--calm-broken': 42 as unknown as string,
                },
            });

            expect(registry.getSnapshot().themes[0].tokens).toEqual({
                '--calm-bg': '#eee',
            });
        });

        it('resolves a namespaced theme key', () => {
            registry.registerTheme('calm-mode', {
                id: 'calm',
                className: 'calm',
            });

            expect(registry.themeKey('calm-mode', 'calm')).toBe(
                'calm-mode:calm'
            );
            expect(registry.themeKey('other', 'calm')).toBeNull();
        });
    });

    describe('nav filters', () => {
        it('hides an item a filter rejects', () => {
            registry.registerNavFilter('p', (item) => item.section !== 'nav');

            expect(
                registry.isNavItemVisible({ path: '/today', section: 'nav' })
            ).toBe(false);
            expect(
                registry.isNavItemVisible({
                    path: '/x',
                    section: 'plugin',
                })
            ).toBe(true);
        });

        it('keeps the item when a filter throws, rather than hiding everything', () => {
            registry.registerNavFilter('p', () => {
                throw new Error('boom');
            });

            expect(
                registry.isNavItemVisible({ path: '/today', section: 'nav' })
            ).toBe(true);
        });

        it('keeps the item when a filter returns a non-boolean', () => {
            registry.registerNavFilter(
                'p',
                (() => undefined) as unknown as () => boolean
            );

            expect(
                registry.isNavItemVisible({ path: '/today', section: 'nav' })
            ).toBe(true);
        });
    });

    describe('disposal', () => {
        it('removes a single registration', () => {
            const route = registry.registerRoute('p', {
                id: 'a',
                path: 'a',
                element: Element,
            });

            route.dispose();
            expect(registry.getSnapshot().routes).toHaveLength(0);
            expect(registry.size.routes).toBe(0);
        });

        it('removes every contribution a plugin made', () => {
            registry.registerRoute('p', {
                id: 'a',
                path: 'a',
                element: Element,
            });
            registry.registerTheme('p', { id: 't', className: 'calm' });
            registry.registerSettingsPanel('p', {
                id: 's',
                label: 'Settings',
                element: Element,
            });
            registry.registerNavFilter('p', () => true);

            registry.registerRoute('other', {
                id: 'b',
                path: 'b',
                element: Element,
            });

            for (const disposable of registry.contributionsOf('p')) {
                disposable.dispose();
            }

            const snapshot = registry.getSnapshot();
            expect(snapshot.routes.map((r) => r.pluginId)).toEqual(['other']);
            expect(snapshot.themes).toHaveLength(0);
            expect(snapshot.settingsPanels).toHaveLength(0);
            expect(snapshot.navFilters).toHaveLength(0);
        });

        it('is idempotent', () => {
            const route = registry.registerRoute('p', {
                id: 'a',
                path: 'a',
                element: Element,
            });

            route.dispose();
            route.dispose();

            expect(registry.size).toEqual({
                routes: 0,
                themes: 0,
                settingsPanels: 0,
                navFilters: 0,
            });
        });
    });

    describe('snapshot identity', () => {
        it('returns the same object until something changes', () => {
            const first = registry.getSnapshot();
            expect(registry.getSnapshot()).toBe(first);

            registry.registerTheme('p', { id: 't', className: 'calm' });
            expect(registry.getSnapshot()).not.toBe(first);
        });

        it('notifies subscribers and stops after unsubscribe', () => {
            const listener = jest.fn();
            const unsubscribe = registry.subscribe(listener);

            registry.registerTheme('p', { id: 't', className: 'calm' });
            expect(listener).toHaveBeenCalledTimes(1);

            unsubscribe();
            registry.registerTheme('p', { id: 'u', className: 'calm2' });
            expect(listener).toHaveBeenCalledTimes(1);
        });
    });
});
