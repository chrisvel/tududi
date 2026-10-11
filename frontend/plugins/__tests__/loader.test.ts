import { PluginRegistry } from '../registry';
import { loadPlugin, loadPlugins, unloadPlugin } from '../loader';
import { createPluginApi, type CreatedPluginApi } from '../host';
import type { PluginApi, PluginListItem } from '../types';

const makePlugin = (
    overrides: Partial<PluginListItem> = {}
): PluginListItem => ({
    id: 'calm-mode',
    name: 'Calm Mode',
    version: '1.0.0',
    description: null,
    pluginApi: 1,
    host: null,
    entry: 'dist/index.js',
    styles: [],
    ok: true,
    errors: [],
    enabled: true,
    ...overrides,
});

interface Harness {
    createApi: (plugin: PluginListItem) => CreatedPluginApi;
    dispose: jest.Mock;
    api: PluginApi;
}

const makeHarness = (): Harness => {
    const dispose = jest.fn();
    const api = {
        pluginApi: 1,
        plugin: { id: 'calm-mode', name: 'Calm Mode', version: '1.0.0' },
    } as unknown as PluginApi;

    return {
        dispose,
        api,
        createApi: () => ({ api, dispose }),
    };
};

describe('plugin loader', () => {
    afterEach(() => {
        document.head
            .querySelectorAll('link[data-plugin-id]')
            .forEach((node) => node.remove());
    });

    it('imports the entry point and activates it', async () => {
        const harness = makeHarness();
        const activate = jest.fn();
        const importer = jest.fn().mockResolvedValue({ activate });

        const result = await loadPlugin(makePlugin(), {
            registry: new PluginRegistry(),
            createApi: harness.createApi,
            importer,
        });

        expect(result.error).toBeNull();
        expect(activate).toHaveBeenCalledWith(harness.api);
        // The version is part of the URL, so a version bump cannot be served
        // from an older cache entry.
        expect(importer).toHaveBeenCalledWith(
            expect.stringContaining('/plugins/calm-mode/dist/index.js?v=1.0.0')
        );
    });

    it('accepts a module wrapped in `default`', async () => {
        const harness = makeHarness();
        const activate = jest.fn();

        const result = await loadPlugin(makePlugin(), {
            registry: new PluginRegistry(),
            createApi: harness.createApi,
            importer: async () => ({ default: { activate } }),
        });

        expect(result.error).toBeNull();
        expect(activate).toHaveBeenCalled();
    });

    it('rejects a plugin the server marked unusable, without importing it', async () => {
        const harness = makeHarness();
        const importer = jest.fn();

        const result = await loadPlugin(
            makePlugin({ ok: false, errors: ['missing entry'] }),
            {
                registry: new PluginRegistry(),
                createApi: harness.createApi,
                importer,
            }
        );

        expect(importer).not.toHaveBeenCalled();
        expect(result.error).toMatch(/missing entry/);
    });

    it('rejects a plugin built for another plugin API major', async () => {
        const harness = makeHarness();
        const importer = jest.fn();

        const result = await loadPlugin(makePlugin({ pluginApi: 2 }), {
            registry: new PluginRegistry(),
            createApi: harness.createApi,
            importer,
        });

        expect(importer).not.toHaveBeenCalled();
        expect(result.error).toMatch(/built for plugin API 2/);
    });

    it('rejects an entry point that escapes the plugin directory', async () => {
        const harness = makeHarness();
        const importer = jest.fn();

        const result = await loadPlugin(
            makePlugin({ entry: '../../secret.js' }),
            {
                registry: new PluginRegistry(),
                createApi: harness.createApi,
                importer,
            }
        );

        expect(importer).not.toHaveBeenCalled();
        expect(result.error).toMatch(/relative path/);
    });

    it('errors when the module exports no activate function', async () => {
        const harness = makeHarness();

        const result = await loadPlugin(makePlugin(), {
            registry: new PluginRegistry(),
            createApi: harness.createApi,
            importer: async () => ({}),
        });

        expect(result.error).toMatch(/does not export an `activate`/);
        expect(harness.dispose).not.toHaveBeenCalled();
    });

    it('contains a failing import and leaves no stylesheets behind', async () => {
        const harness = makeHarness();
        const plugin = makePlugin({ styles: ['dist/index.css'] });

        const result = await loadPlugin(plugin, {
            registry: new PluginRegistry(),
            createApi: harness.createApi,
            importer: async () => {
                throw new Error('404 Not Found');
            },
        });

        expect(result.error).toBe('404 Not Found');
        // Nothing was created, so there is nothing to dispose.
        expect(harness.dispose).not.toHaveBeenCalled();
        expect(
            document.head.querySelectorAll('link[data-plugin-id]')
        ).toHaveLength(0);
    });

    it('rolls back registrations when a plugin throws after registering', async () => {
        const registry = new PluginRegistry();

        const result = await loadPlugin(makePlugin(), {
            registry,
            // The real api, so the rollback path is exercised end to end.
            createApi: (plugin) =>
                createPluginApi({
                    registry,
                    plugin,
                    settings: {},
                    activeThemeKey: null,
                    t: (_key: string, fallback?: string) => fallback || '',
                    setActiveTheme: async () => undefined,
                    onResponse: () => undefined,
                }),
            importer: async () => ({
                activate: (api: PluginApi) => {
                    api.registerRoute({
                        id: 'focus',
                        path: 'focus',
                        element: () => null,
                    });
                    api.registerTheme({ id: 'calm', className: 'calm' });
                    throw new Error('boom after registering');
                },
            }),
        });

        expect(result.error).toBe('boom after registering');
        // A half-activated plugin that left a route or a theme behind would be
        // worse than one that never ran at all.
        expect(registry.getSnapshot().routes).toHaveLength(0);
        expect(registry.getSnapshot().themes).toHaveLength(0);
    });

    it('contains a plugin that throws while activating', async () => {
        const harness = makeHarness();

        const result = await loadPlugin(makePlugin(), {
            registry: new PluginRegistry(),
            createApi: harness.createApi,
            importer: async () => ({
                activate: () => {
                    throw new Error('activate exploded');
                },
            }),
        });

        expect(result.error).toBe('activate exploded');
        expect(harness.dispose).toHaveBeenCalled();
    });

    it('injects stylesheets for an activated plugin', async () => {
        const harness = makeHarness();

        const result = await loadPlugin(
            makePlugin({ styles: ['dist/index.css'] }),
            {
                registry: new PluginRegistry(),
                createApi: harness.createApi,
                importer: async () => ({ activate: () => undefined }),
            }
        );

        const link = document.head.querySelector(
            'link[data-plugin-id="calm-mode"]'
        ) as HTMLLinkElement;

        expect(result.error).toBeNull();
        expect(link).not.toBeNull();
        expect(link.href).toContain(
            '/plugins/calm-mode/dist/index.css?v=1.0.0'
        );
    });

    it('records the cleanup an activate returned, and runs it on unload', async () => {
        const harness = makeHarness();
        const cleanup = jest.fn();

        const loaded = await loadPlugin(makePlugin(), {
            registry: new PluginRegistry(),
            createApi: harness.createApi,
            importer: async () => ({ activate: () => cleanup }),
        });

        unloadPlugin(loaded);

        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(harness.dispose).toHaveBeenCalledTimes(1);
    });

    describe('loadPlugins', () => {
        it('skips disabled plugins', async () => {
            const harness = makeHarness();
            const importer = jest.fn().mockResolvedValue({
                activate: () => undefined,
            });

            const result = await loadPlugins(
                {
                    pluginApiVersion: 1,
                    hostVersion: '1.9.1',
                    pluginsDir: '/plugins',
                    canManage: false,
                    enabled: [],
                    settings: {},
                    activeTheme: null,
                    plugins: [
                        makePlugin({ id: 'off', enabled: false }),
                        makePlugin({ id: 'on', enabled: true }),
                    ],
                },
                {
                    registry: new PluginRegistry(),
                    createApi: harness.createApi,
                    importer,
                }
            );

            expect(result.loaded.map((p) => p.id)).toEqual(['on']);
            expect(importer).toHaveBeenCalledTimes(1);
        });

        it('loads the good plugins even when one fails', async () => {
            const registry = new PluginRegistry();
            const harness = makeHarness();

            const result = await loadPlugins(
                {
                    pluginApiVersion: 1,
                    hostVersion: '1.9.1',
                    pluginsDir: '/plugins',
                    canManage: false,
                    enabled: ['broken', 'good'],
                    settings: {},
                    activeTheme: null,
                    plugins: [
                        makePlugin({ id: 'broken', entry: null }),
                        makePlugin({ id: 'good' }),
                    ],
                },
                {
                    registry,
                    createApi: harness.createApi,
                    importer: async () => ({ activate: () => undefined }),
                }
            );

            expect(result.loaded.map((p) => p.id)).toEqual(['good']);
            expect(result.failed.map((p) => p.id)).toEqual(['broken']);
        });
    });
});
