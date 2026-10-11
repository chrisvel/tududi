const {
    MAX_MERGED_SHORTCUTS,
    buildManifest,
    shortcutUrl,
} = require('../../../../modules/plugins/pwaManifest');

const BASE = {
    name: 'tududi',
    short_name: 'tududi',
    start_url: '/',
    icons: [{ src: '/icon-logo.png', sizes: '512x512', type: 'image/png' }],
    shortcuts: [
        { name: 'Quick capture', short_name: 'Capture', url: '/inbox' },
    ],
};

const plugin = (overrides = {}) => ({
    id: 'calm-mode',
    ok: true,
    errors: [],
    manifest: {
        id: 'calm-mode',
        entry: 'dist/index.js',
        shortcuts: [
            {
                name: 'One thing',
                short_name: 'One thing',
                description: 'Open the single-page view',
                path: 'focus',
            },
        ],
    },
    ...overrides,
});

describe('pwa manifest', () => {
    it('namespaces a plugin shortcut under the plugin route prefix', () => {
        expect(shortcutUrl('calm-mode', 'focus')).toBe(
            '/plugins/calm-mode/focus'
        );
        // A leading slash in the manifest must not produce a doubled one.
        expect(shortcutUrl('calm-mode', '/focus')).toBe(
            '/plugins/calm-mode/focus'
        );
    });

    it('keeps the app\u2019s own shortcuts first and appends the enabled plugin\u2019s', () => {
        const merged = buildManifest(BASE, [plugin()], {
            enabled: ['calm-mode'],
        });

        expect(merged.shortcuts.map((s) => s.url)).toEqual([
            '/inbox',
            '/plugins/calm-mode/focus',
        ]);
        expect(merged.shortcuts[1]).toMatchObject({
            name: 'One thing',
            description: 'Open the single-page view',
            // A shortcut without icons gets a generic glyph on a launcher.
            icons: BASE.icons,
        });
    });

    it('contributes nothing for a plugin the user has not enabled', () => {
        const merged = buildManifest(BASE, [plugin()], { enabled: [] });

        expect(merged.shortcuts).toHaveLength(1);
        expect(merged.shortcuts[0].url).toBe('/inbox');
    });

    it('contributes nothing for a plugin the host refused', () => {
        const merged = buildManifest(
            BASE,
            [plugin({ ok: false, errors: ['requires host 2.x'] })],
            { enabled: ['calm-mode'] }
        );

        // Enabling a broken plugin must not put a shortcut to nothing on a home
        // screen.
        expect(merged.shortcuts).toHaveLength(1);
    });

    it('never exceeds the platform shortcut limit', () => {
        const many = Array.from({ length: 10 }, (_, index) => ({
            id: `plugin-${index}`,
            ok: true,
            errors: [],
            manifest: {
                id: `plugin-${index}`,
                entry: 'dist/index.js',
                shortcuts: [{ name: `Plugin ${index}`, path: 'home' }],
            },
        }));

        const merged = buildManifest(BASE, many, {
            enabled: many.map((p) => p.id),
        });

        expect(merged.shortcuts).toHaveLength(MAX_MERGED_SHORTCUTS);
        // The app's own shortcut is still first: a plugin cannot push it out.
        expect(merged.shortcuts[0].url).toBe('/inbox');
    });

    it('drops the shortcuts key entirely when nothing declares one', () => {
        const merged = buildManifest(
            { name: 'tududi', icons: BASE.icons },
            [],
            { enabled: [] }
        );

        expect(merged).not.toHaveProperty('shortcuts');
    });

    it('does not invent icons when the base manifest has none', () => {
        const merged = buildManifest({ name: 'tududi' }, [plugin()], {
            enabled: ['calm-mode'],
        });

        expect(merged.shortcuts[0]).not.toHaveProperty('icons');
    });

    it('survives a missing state object', () => {
        expect(() => buildManifest(BASE, [plugin()], null)).not.toThrow();
        expect(buildManifest(BASE, [plugin()], null).shortcuts).toHaveLength(1);
    });
});
