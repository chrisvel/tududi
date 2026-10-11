const fs = require('fs');
const os = require('os');
const path = require('path');

const service = require('../../../../modules/plugins/service');

const writePlugin = (root, id, manifest, extraFiles = {}) => {
    const dir = path.join(root, id);
    fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'plugin.json'),
        JSON.stringify(manifest, null, 2)
    );
    // A usable fixture has to be a complete one: the service checks that the
    // files a manifest references exist, so a fixture that skipped them would
    // only ever exercise the unbuilt-plugin path.
    for (const reference of [manifest.entry, ...(manifest.styles || [])]) {
        if (typeof reference !== 'string') continue;
        const filePath = path.join(dir, reference);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, '// fixture\n');
    }

    for (const [name, contents] of Object.entries(extraFiles)) {
        const filePath = path.join(dir, name);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, contents);
    }
    return dir;
};

describe('plugins service', () => {
    let root;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'tududi-plugins-'));
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    describe('listInstalled', () => {
        it('returns an empty list when the plugins directory does not exist', () => {
            expect(
                service.listInstalled({
                    dir: path.join(root, 'missing'),
                    hostVersion: '1.9.1',
                })
            ).toEqual([]);
        });

        it('reads usable plugins and sorts them by id', () => {
            writePlugin(root, 'zeta', {
                id: 'zeta',
                name: 'Zeta',
                version: '1.0.0',
                pluginApi: 1,
                entry: 'dist/index.js',
            });
            writePlugin(root, 'alpha', {
                id: 'alpha',
                name: 'Alpha',
                version: '1.0.0',
                pluginApi: 1,
                entry: 'dist/index.js',
            });

            const plugins = service.listInstalled({
                dir: root,
                hostVersion: '1.9.1',
            });

            expect(plugins.map((p) => p.id)).toEqual(['alpha', 'zeta']);
            expect(plugins.every((p) => p.ok)).toBe(true);
        });

        it('reports a directory with no manifest instead of skipping it', () => {
            fs.mkdirSync(path.join(root, 'empty'));

            const plugins = service.listInstalled({
                dir: root,
                hostVersion: '1.9.1',
            });

            expect(plugins).toHaveLength(1);
            expect(plugins[0].id).toBe('empty');
            expect(plugins[0].ok).toBe(false);
            expect(plugins[0].errors).toEqual([
                expect.stringMatching(/missing plugin\.json/),
            ]);
        });

        it('reports malformed JSON as a validation error', () => {
            const dir = path.join(root, 'broken');
            fs.mkdirSync(dir);
            fs.writeFileSync(path.join(dir, 'plugin.json'), '{ not json');

            const [plugin] = service.listInstalled({
                dir: root,
                hostVersion: '1.9.1',
            });

            expect(plugin.ok).toBe(false);
            expect(plugin.errors[0]).toMatch(/not valid JSON/);
        });

        it('reports a plugin whose entry point was never built', () => {
            writePlugin(root, 'unbuilt', {
                id: 'unbuilt',
                name: 'Unbuilt',
                version: '1.0.0',
                pluginApi: 1,
                entry: 'dist/index.js',
            });
            fs.rmSync(path.join(root, 'unbuilt', 'dist', 'index.js'));

            const [plugin] = service.listInstalled({
                dir: root,
                hostVersion: '1.9.1',
            });

            expect(plugin.ok).toBe(false);
            expect(plugin.errors[0]).toMatch(
                /`entry` `dist\/index\.js` does not exist/
            );
            // The message has to name the fix, or it is just a 404 in words.
            expect(plugin.errors[0]).toMatch(/npm run build/);
        });

        it('reports a stylesheet a manifest points at but that is missing', () => {
            writePlugin(root, 'styles', {
                id: 'styles',
                name: 'Styles',
                version: '1.0.0',
                pluginApi: 1,
                entry: 'dist/index.js',
                styles: ['dist/index.css'],
            });
            fs.rmSync(path.join(root, 'styles', 'dist', 'index.css'));

            const [plugin] = service.listInstalled({
                dir: root,
                hostVersion: '1.9.1',
            });

            expect(plugin.ok).toBe(false);
            expect(plugin.errors[0]).toMatch(
                /`styles` `dist\/index\.css` does not exist/
            );
        });

        it('does not probe for files when the manifest is already invalid', () => {
            writePlugin(root, 'both', {
                id: 'both',
                name: 'Both',
                version: '1.0.0',
                pluginApi: 99,
                entry: '../escape.js',
            });

            const [plugin] = service.listInstalled({
                dir: root,
                hostVersion: '1.9.1',
            });

            expect(plugin.ok).toBe(false);
            expect(
                plugin.errors.some((error) => /does not exist/.test(error))
            ).toBe(false);
        });

        it('ignores dot-directories', () => {
            fs.mkdirSync(path.join(root, '.git'));
            expect(
                service.listInstalled({ dir: root, hostVersion: '1.9.1' })
            ).toEqual([]);
        });

        it('marks a plugin built for another API major as unusable', () => {
            writePlugin(root, 'future', {
                id: 'future',
                name: 'Future',
                version: '1.0.0',
                pluginApi: 99,
                entry: 'dist/index.js',
            });

            const [plugin] = service.listInstalled({
                dir: root,
                hostVersion: '1.9.1',
            });

            expect(plugin.ok).toBe(false);
        });
    });

    describe('describeForClient', () => {
        it('marks only usable plugins as enabled', () => {
            const plugins = [
                {
                    id: 'ok-plugin',
                    ok: true,
                    errors: [],
                    manifest: {
                        id: 'ok-plugin',
                        name: 'OK',
                        version: '1.0.0',
                        entry: 'dist/index.js',
                    },
                },
                {
                    id: 'broken-plugin',
                    ok: false,
                    errors: ['boom'],
                    manifest: { id: 'broken-plugin', name: 'Broken' },
                },
            ];

            const described = service.describeForClient(plugins, {
                enabled: ['ok-plugin', 'broken-plugin'],
                settings: {},
                activeTheme: null,
            });

            // A plugin the host cannot load must never be reported as enabled,
            // or the frontend would try to import something known-bad.
            expect(described[0].enabled).toBe(true);
            expect(described[1].enabled).toBe(false);
            expect(described[1].errors).toEqual(['boom']);
        });

        it('always exposes styles as an array', () => {
            const [described] = service.describeForClient(
                [
                    {
                        id: 'p',
                        ok: true,
                        errors: [],
                        manifest: { id: 'p', entry: 'i.js' },
                    },
                ],
                { enabled: [], settings: {}, activeTheme: null }
            );

            expect(described.styles).toEqual([]);
        });
    });

    describe('state', () => {
        it('defaults to nothing enabled, no settings and no active theme', () => {
            expect(service.readState({ ui_settings: {} })).toEqual({
                enabled: [],
                settings: {},
                activeTheme: null,
            });
        });

        it('tolerates a user with no ui_settings at all', () => {
            expect(service.readState({})).toEqual({
                enabled: [],
                settings: {},
                activeTheme: null,
            });
        });

        it('drops non-string entries from the enabled list', () => {
            const state = service.readState({
                ui_settings: { plugins: { enabled: ['good', 42, null] } },
            });

            expect(state.enabled).toEqual(['good']);
        });

        it('preserves every other ui_settings key when writing', async () => {
            const user = {
                ui_settings: {
                    project: { details: { showMetrics: true } },
                    inbox: { recentlyCapturedExpanded: true },
                    planning: { maxSuggestions: 20 },
                    focus: { area_uid: 'abc' },
                    plugins: { enabled: ['calm-mode'], settings: {} },
                },
                update: jest.fn().mockResolvedValue(undefined),
            };

            await service.writeState(user, { activeTheme: 'calm' });

            const written = user.update.mock.calls[0][0].ui_settings;
            expect(written.project).toEqual({
                details: { showMetrics: true },
            });
            expect(written.inbox).toEqual({ recentlyCapturedExpanded: true });
            expect(written.planning).toEqual({ maxSuggestions: 20 });
            expect(written.focus).toEqual({ area_uid: 'abc' });
            expect(written.plugins).toEqual({
                enabled: ['calm-mode'],
                settings: {},
                activeTheme: 'calm',
            });
        });

        it('merges settings instead of replacing them', async () => {
            const user = {
                ui_settings: {
                    plugins: {
                        enabled: [],
                        settings: { other: { keep: true } },
                    },
                },
                update: jest.fn().mockResolvedValue(undefined),
            };

            await service.writeState(user, {
                settings: { other: { keep: true }, added: { x: 1 } },
            });

            const written = user.update.mock.calls[0][0].ui_settings;
            expect(written.plugins.settings).toEqual({
                other: { keep: true },
                added: { x: 1 },
            });
        });
    });

    describe('servesPluginFile', () => {
        // This decides who has to sign in to read a plugin file, so it is the
        // gate rather than a helper beside it: everything express.static would
        // serve has to be in here, whatever it is called.
        const serves = (urlPath) =>
            service.servesPluginFile(urlPath, { dir: root });

        beforeEach(() => {
            writePlugin(
                root,
                'calm-mode',
                {
                    id: 'calm-mode',
                    name: 'Calm Mode',
                    version: '1.0.0',
                    pluginApi: 1,
                    entry: 'dist/index.js',
                    styles: ['dist/index.css'],
                },
                { LICENSE: 'all rights reserved\n', '.env': 'SECRET=1\n' }
            );
        });

        it('is true for a bundle the static handler would serve', () => {
            expect(serves('/calm-mode/dist/index.js')).toBe(true);
        });

        it('is true for a file with no extension at all', () => {
            // A gate written as "has an extension" serves this one to anyone.
            expect(serves('/calm-mode/LICENSE')).toBe(true);
        });

        it('is true for a percent-encoded dot', () => {
            // express.static decodes the path, so `index%2Ejs` is `index.js`.
            expect(serves('/calm-mode/dist/index%2Ejs')).toBe(true);
        });

        it('is true for the manifest, which is a file like any other', () => {
            // `plugin.json` is not special: the list endpoint is how the app
            // learns what is installed, and the file itself is served to a
            // signed-in user only, like everything else in the directory.
            expect(serves('/calm-mode/plugin.json')).toBe(true);
        });

        it('is false for a plugin page, which is a client-side route', () => {
            expect(serves('/calm-mode/focus')).toBe(false);
        });

        it('is false for a directory', () => {
            expect(serves('/calm-mode/dist')).toBe(false);
            expect(serves('/calm-mode')).toBe(false);
            expect(serves('/')).toBe(false);
        });

        it('is false for a dotfile, which is never served anyway', () => {
            expect(serves('/calm-mode/.env')).toBe(false);
        });

        it('is false for a path that escapes the root', () => {
            expect(serves('/../package.json')).toBe(false);
            expect(serves('/calm-mode/../../package.json')).toBe(false);
        });

        it('is false for a malformed escape rather than throwing', () => {
            expect(serves('/calm-mode/dist/%E0%A4%A')).toBe(false);
            expect(serves('/calm-mode/dist/index.js%00.png')).toBe(false);
        });

        it('is false for anything that is not there', () => {
            expect(serves('/nothing-here/dist/index.js')).toBe(false);
            expect(serves('/calm-mode/dist/gone.js')).toBe(false);
            expect(serves('')).toBe(false);
        });
    });
});
