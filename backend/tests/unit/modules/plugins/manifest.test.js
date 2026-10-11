describe('plugin manifest validation', () => {
    const {
        PLUGIN_API_VERSION,
        isSafeRelativePath,
        parseVersion,
        compareVersions,
        satisfiesRange,
        validateManifest,
    } = require('../../../../modules/plugins/manifest');

    const validManifest = () => ({
        id: 'calm-mode',
        name: 'Calm Mode',
        version: '1.0.0',
        description: 'Reduces sensory and cognitive load.',
        pluginApi: PLUGIN_API_VERSION,
        entry: 'dist/index.js',
    });

    describe('validateManifest', () => {
        it('accepts a well-formed manifest', () => {
            const result = validateManifest(validManifest(), {
                hostVersion: '1.9.1',
            });

            expect(result.ok).toBe(true);
            expect(result.errors).toEqual([]);
            expect(result.manifest.id).toBe('calm-mode');
        });

        it('rejects a non-object manifest', () => {
            const result = validateManifest('nope');

            expect(result.ok).toBe(false);
            expect(result.errors[0]).toMatch(/JSON object/);
        });

        it('requires id, name, version, pluginApi and entry', () => {
            const result = validateManifest({});

            expect(result.ok).toBe(false);
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.stringMatching(/`id` is required/),
                    expect.stringMatching(/`name` is required/),
                    expect.stringMatching(/`version` must be a semver/),
                    expect.stringMatching(/`pluginApi` must be a positive/),
                    expect.stringMatching(/`entry` must be a relative path/),
                ])
            );
        });

        it('rejects an id with characters that would break a URL', () => {
            const result = validateManifest({
                ...validManifest(),
                id: 'Calm Mode/../evil',
            });

            expect(result.ok).toBe(false);
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.stringMatching(/`id` must be lowercase/),
                ])
            );
        });

        it('rejects a plugin built for a different plugin API major', () => {
            const result = validateManifest({
                ...validManifest(),
                pluginApi: PLUGIN_API_VERSION + 1,
            });

            expect(result.ok).toBe(false);
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.stringMatching(/requires plugin API 2/),
                ])
            );
        });

        it('rejects a host range the running host does not satisfy', () => {
            const result = validateManifest(
                { ...validManifest(), host: '>=99 <100' },
                { hostVersion: '1.9.1' }
            );

            expect(result.ok).toBe(false);
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.stringMatching(/requires host >=99 <100/),
                ])
            );
        });

        it('accepts a host range the running host satisfies', () => {
            const result = validateManifest(
                { ...validManifest(), host: '>=1.9 <2' },
                { hostVersion: '1.9.1' }
            );

            expect(result.ok).toBe(true);
        });

        it('rejects an entry point that escapes the plugin directory', () => {
            for (const entry of [
                '/etc/passwd',
                '../../secrets.js',
                'dist/../../outside.js',
                'https://evil.example/x.js',
                '',
            ]) {
                const result = validateManifest({
                    ...validManifest(),
                    entry,
                });
                expect(result.ok).toBe(false);
            }
        });

        it('validates every stylesheet path', () => {
            const result = validateManifest({
                ...validManifest(),
                styles: ['dist/index.css', '../outside.css'],
            });

            expect(result.ok).toBe(false);
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.stringMatching(/every entry in `styles`/),
                ])
            );
        });

        it('accepts a manifest with no styles', () => {
            const manifest = validManifest();
            delete manifest.styles;
            expect(
                validateManifest(manifest, { hostVersion: '1.9.1' }).ok
            ).toBe(true);
        });

        it('accepts launcher shortcuts declared with a relative path', () => {
            const result = validateManifest({
                ...validManifest(),
                shortcuts: [
                    {
                        name: 'One thing',
                        short_name: 'One thing',
                        description: 'Open the single-page view',
                        path: 'focus',
                    },
                ],
            });

            expect(result.ok).toBe(true);
        });

        it('rejects more shortcuts than a launcher will show', () => {
            const result = validateManifest({
                ...validManifest(),
                shortcuts: Array.from({ length: 5 }, (_, index) => ({
                    name: `Shortcut ${index}`,
                    path: 'focus',
                })),
            });

            expect(result.ok).toBe(false);
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.stringMatching(/at most 4 entries/),
                ])
            );
        });

        it('rejects a shortcut that is missing its name', () => {
            const result = validateManifest({
                ...validManifest(),
                shortcuts: [{ path: 'focus' }],
            });

            expect(result.ok).toBe(false);
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.stringMatching(/`shortcuts\[0\]`\.name must be/),
                ])
            );
        });

        it('rejects a shortcut path that leaves the plugin directory', () => {
            const result = validateManifest({
                ...validManifest(),
                shortcuts: [{ name: 'Escape', path: '../admin' }],
            });

            expect(result.ok).toBe(false);
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.stringMatching(
                        /`shortcuts\[0\]`\.path must be a relative path/
                    ),
                ])
            );
        });
    });

    describe('isSafeRelativePath', () => {
        it('accepts nested relative paths', () => {
            expect(isSafeRelativePath('dist/index.js')).toBe(true);
            expect(isSafeRelativePath('a/b/c.css')).toBe(true);
        });

        it('rejects traversal, absolute and scheme-qualified paths', () => {
            expect(isSafeRelativePath('../x.js')).toBe(false);
            expect(isSafeRelativePath('/x.js')).toBe(false);
            expect(isSafeRelativePath('C:\\x.js')).toBe(false);
            expect(isSafeRelativePath('data:text/javascript,x')).toBe(false);
            expect(isSafeRelativePath('a/../../b.js')).toBe(false);
        });
    });

    describe('satisfiesRange', () => {
        it('treats an empty range and * as always satisfied', () => {
            expect(satisfiesRange('1.9.1', '')).toBe(true);
            expect(satisfiesRange('1.9.1', '*')).toBe(true);
        });

        it('handles AND comparators', () => {
            expect(satisfiesRange('1.9.1', '>=1.9 <2')).toBe(true);
            expect(satisfiesRange('2.0.0', '>=1.9 <2')).toBe(false);
            expect(satisfiesRange('1.8.9', '>=1.9 <2')).toBe(false);
        });

        it('handles OR alternatives', () => {
            expect(satisfiesRange('1.4.0', '>=1.2 <1.5 || >=1.9')).toBe(true);
            expect(satisfiesRange('1.7.0', '>=1.2 <1.5 || >=1.9')).toBe(false);
        });

        it('treats a bare partial version as an X-range', () => {
            expect(satisfiesRange('1.9.4', '1.9')).toBe(true);
            expect(satisfiesRange('1.10.0', '1.9')).toBe(false);
            expect(satisfiesRange('1.10.0', '1')).toBe(true);
            expect(satisfiesRange('2.0.0', '1')).toBe(false);
            // A full version is still exact.
            expect(satisfiesRange('1.9.1', '1.9.1')).toBe(true);
            expect(satisfiesRange('1.9.2', '1.9.1')).toBe(false);
        });

        it('holds only the major for a single-part tilde range', () => {
            expect(satisfiesRange('1.9.4', '~1')).toBe(true);
            expect(satisfiesRange('2.0.0', '~1')).toBe(false);
        });

        it('handles caret ranges', () => {
            expect(satisfiesRange('1.9.1', '^1.9.0')).toBe(true);
            expect(satisfiesRange('2.0.0', '^1.9.0')).toBe(false);
            expect(satisfiesRange('1.8.0', '^1.9.0')).toBe(false);
        });

        it('handles tilde ranges', () => {
            expect(satisfiesRange('1.9.4', '~1.9.0')).toBe(true);
            expect(satisfiesRange('1.10.0', '~1.9.0')).toBe(false);
        });

        it('does not treat a prerelease as satisfying the release range', () => {
            expect(satisfiesRange('2.0.0-beta.1', '>=1.9 <2')).toBe(false);
            expect(satisfiesRange('2.0.0-beta.1', '>=1.9')).toBe(false);
        });

        it('allows a prerelease when the range names the same tuple', () => {
            expect(
                satisfiesRange('2.0.0-beta.2', '>=2.0.0-beta.1 <2.0.0')
            ).toBe(true);
            expect(
                satisfiesRange('2.0.0-beta.2', '>=2.1.0-beta.1 <2.1.0')
            ).toBe(false);
        });

        it('returns false for an unparseable version or range', () => {
            expect(satisfiesRange('not-a-version', '>=1')).toBe(false);
            expect(satisfiesRange('1.0.0', 'not-a-range')).toBe(false);
        });
    });

    describe('parseVersion and compareVersions', () => {
        it('accepts the leading v used by this repo', () => {
            expect(parseVersion('v1.9.1')).toEqual({
                major: 1,
                minor: 9,
                patch: 1,
                precision: 3,
                prerelease: null,
            });
        });

        it('accepts partial versions and records their precision', () => {
            expect(parseVersion('1.9')).toEqual({
                major: 1,
                minor: 9,
                patch: 0,
                precision: 2,
                prerelease: null,
            });
            expect(parseVersion('2')).toMatchObject({
                major: 2,
                minor: 0,
                patch: 0,
                precision: 1,
            });
        });

        it('rejects a version with too many parts or trailing junk', () => {
            expect(parseVersion('1.2.3.4')).toBeNull();
            expect(parseVersion('1.2.3x')).toBeNull();
        });

        it('orders numeric fields before prerelease tags', () => {
            const release = parseVersion('2.0.0');
            const beta = parseVersion('2.0.0-beta.1');
            expect(compareVersions(beta, release)).toBe(-1);
            expect(compareVersions(release, beta)).toBe(1);
        });

        it('orders by major, then minor, then patch', () => {
            expect(
                compareVersions(parseVersion('1.10.0'), parseVersion('1.9.9'))
            ).toBe(1);
            expect(
                compareVersions(parseVersion('0.9.0'), parseVersion('1.0.0'))
            ).toBe(-1);
        });
    });
});
