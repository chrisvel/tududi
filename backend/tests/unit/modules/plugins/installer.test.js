const fs = require('fs');
const os = require('os');
const path = require('path');

const installer = require('../../../../modules/plugins/installer');
const service = require('../../../../modules/plugins/service');
const {
    buildZip,
    validPluginEntries,
    validPluginManifest,
    SYMLINK_MODE,
} = require('../../../helpers/zipFixture');

const HOST = { hostVersion: '1.9.1' };

/** Every directory the installer uses for work in progress is dot-prefixed. */
const workingDirectories = (dir) =>
    fs.readdirSync(dir).filter((name) => name.startsWith('.'));

const writePluginDirectory = (root, name, manifest) => {
    const dir = path.join(root, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify(manifest));
    return dir;
};

describe('plugin installer', () => {
    let root;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'tududi-install-'));
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    describe('installFromBuffer', () => {
        it('installs a plugin whose manifest is at the archive root', async () => {
            const result = await installer.installFromBuffer(
                buildZip(validPluginEntries()),
                { dir: root, ...HOST }
            );

            expect(result).toMatchObject({
                id: 'demo-plugin',
                version: '1.0.0',
                updated: false,
            });
            expect(
                fs.existsSync(path.join(root, 'demo-plugin', 'plugin.json'))
            ).toBe(true);
            expect(
                fs.existsSync(
                    path.join(root, 'demo-plugin', 'dist', 'index.js')
                )
            ).toBe(true);
            expect(workingDirectories(root)).toEqual([]);

            // The result the operator sees is the same listing the plugin
            // manager renders, so the plugin has to be usable through it.
            const installed = service.listInstalled({ dir: root, ...HOST });
            expect(installed).toHaveLength(1);
            expect(installed[0]).toMatchObject({
                id: 'demo-plugin',
                ok: true,
                errors: [],
            });
        });

        it('creates the plugins root when it does not exist yet', async () => {
            const missing = path.join(root, 'nested', 'plugins');

            const result = await installer.installFromBuffer(
                buildZip(validPluginEntries()),
                { dir: missing, ...HOST }
            );

            expect(result.updated).toBe(false);
            expect(
                fs.existsSync(path.join(missing, 'demo-plugin', 'plugin.json'))
            ).toBe(true);
        });

        it('unwraps the single directory an archiver adds', async () => {
            // What zipping a folder produces on macOS, on Windows and through
            // GitHub's "Download ZIP": everything one level down.
            const entries = validPluginEntries().map((entry) => ({
                ...entry,
                name: `demo-plugin-main/${entry.name}`,
            }));

            const result = await installer.installFromBuffer(
                buildZip(entries),
                {
                    dir: root,
                    ...HOST,
                }
            );

            expect(result.id).toBe('demo-plugin');
            expect(
                fs.existsSync(path.join(root, 'demo-plugin', 'plugin.json'))
            ).toBe(true);
            expect(fs.existsSync(path.join(root, 'demo-plugin-main'))).toBe(
                false
            );
        });

        it('does not unwrap a directory that holds no manifest', async () => {
            const entries = [
                { name: 'docs/readme.md', content: 'nothing to see' },
            ];

            await expect(
                installer.installFromBuffer(buildZip(entries), {
                    dir: root,
                    ...HOST,
                })
            ).rejects.toThrow(/does not contain plugin.json/);
        });

        it('extracts deflated entries', async () => {
            const entries = validPluginEntries({}, [
                { name: 'dist/chunk.js', content: 'x'.repeat(4096) },
            ]).map((entry) => ({ ...entry, deflate: true }));

            await installer.installFromBuffer(buildZip(entries), {
                dir: root,
                ...HOST,
            });

            expect(
                fs.readFileSync(
                    path.join(root, 'demo-plugin', 'dist', 'chunk.js'),
                    'utf8'
                )
            ).toBe('x'.repeat(4096));
        });

        it('treats a backslash as a path separator', async () => {
            // A ZIP written on Windows may separate with `\`, and a name only
            // checked in its forward-slash form is not checked at all.
            const entries = [
                {
                    name: 'plugin.json',
                    content: JSON.stringify(validPluginManifest()),
                },
                { name: 'dist\\index.js', content: '// entry\n' },
            ];

            await installer.installFromBuffer(buildZip(entries), {
                dir: root,
                ...HOST,
            });

            expect(
                fs.existsSync(
                    path.join(root, 'demo-plugin', 'dist', 'index.js')
                )
            ).toBe(true);
        });

        it('ignores the metadata files a desktop archiver adds', async () => {
            const entries = validPluginEntries({}, [
                { name: '__MACOSX/._plugin.json', content: 'resource fork' },
                { name: '.DS_Store', content: 'finder' },
                { name: 'Thumbs.db', content: 'explorer' },
            ]);

            await installer.installFromBuffer(buildZip(entries), {
                dir: root,
                ...HOST,
            });

            expect(
                fs.existsSync(path.join(root, 'demo-plugin', '.DS_Store'))
            ).toBe(false);
            expect(
                fs.existsSync(path.join(root, 'demo-plugin', 'Thumbs.db'))
            ).toBe(false);
            expect(
                fs.existsSync(path.join(root, 'demo-plugin', '__MACOSX'))
            ).toBe(false);
        });

        it('reports an update and replaces the previous version', async () => {
            await installer.installFromBuffer(
                buildZip(
                    validPluginEntries({}, [
                        { name: 'dist/removed-in-v2.js', content: '// old\n' },
                    ])
                ),
                { dir: root, ...HOST }
            );

            const result = await installer.installFromBuffer(
                buildZip(validPluginEntries({ version: '2.0.0' })),
                { dir: root, ...HOST }
            );

            expect(result).toMatchObject({
                id: 'demo-plugin',
                version: '2.0.0',
                updated: true,
            });
            expect(
                JSON.parse(
                    fs.readFileSync(
                        path.join(root, 'demo-plugin', 'plugin.json'),
                        'utf8'
                    )
                ).version
            ).toBe('2.0.0');
            // An update must not leave the previous version's files behind:
            // a stale bundle is loaded by the browser, not ignored.
            expect(
                fs.existsSync(
                    path.join(root, 'demo-plugin', 'dist', 'removed-in-v2.js')
                )
            ).toBe(false);
            expect(workingDirectories(root)).toEqual([]);
        });

        it('refuses an empty upload', async () => {
            await expect(
                installer.installFromBuffer(Buffer.alloc(0), {
                    dir: root,
                    ...HOST,
                })
            ).rejects.toThrow(/empty/);
        });

        it('refuses a file that is not a ZIP archive', async () => {
            await expect(
                installer.installFromBuffer(Buffer.from('not an archive'), {
                    dir: root,
                    ...HOST,
                })
            ).rejects.toThrow(/not a readable ZIP archive/);
        });

        it('refuses an archive with no manifest', async () => {
            await expect(
                installer.installFromBuffer(
                    buildZip([
                        { name: 'dist/index.js', content: '// entry\n' },
                    ]),
                    { dir: root, ...HOST }
                )
            ).rejects.toThrow(/does not contain plugin.json/);
        });

        it('refuses a manifest this host cannot run', async () => {
            await expect(
                installer.installFromBuffer(
                    buildZip(validPluginEntries({ pluginApi: 2 })),
                    { dir: root, ...HOST }
                )
            ).rejects.toThrow(/plugin API 2/);
        });

        it('refuses an archive whose manifest points at a file it lacks', async () => {
            // The plugin would be installed and then fail in the browser with
            // a 404 that says nothing about why.
            await expect(
                installer.installFromBuffer(
                    buildZip([
                        {
                            name: 'plugin.json',
                            content: JSON.stringify(
                                validPluginManifest({ entry: 'dist/gone.js' })
                            ),
                        },
                    ]),
                    { dir: root, ...HOST }
                )
            ).rejects.toThrow(/incomplete/);
        });

        it('refuses a symbolic link', async () => {
            // A link is the way an archive reaches a file outside the plugin
            // directory that the host would later read.
            const entries = validPluginEntries({}, [
                {
                    name: 'escape',
                    content: '../../../../etc/passwd',
                    mode: SYMLINK_MODE,
                },
            ]);

            await expect(
                installer.installFromBuffer(buildZip(entries), {
                    dir: root,
                    ...HOST,
                })
            ).rejects.toThrow(/symbolic link/);
        });

        it('refuses an archive that names the same file twice', async () => {
            const entries = validPluginEntries({}, [
                { name: 'dist/index.js', content: '// second copy\n' },
            ]);

            await expect(
                installer.installFromBuffer(buildZip(entries), {
                    dir: root,
                    ...HOST,
                })
            ).rejects.toThrow(/twice/);
        });

        it('refuses an archive with too many entries', async () => {
            const entries = validPluginEntries();
            for (let index = 0; index < 2001; index += 1) {
                entries.push({
                    name: `dist/part-${index}.js`,
                    content: '//\n',
                });
            }

            await expect(
                installer.installFromBuffer(buildZip(entries), {
                    dir: root,
                    ...HOST,
                })
            ).rejects.toThrow(/more than 2000 entries/);
        });

        it('refuses an entry larger than a plugin file may be', async () => {
            // Rejected on the size in the header, before anything is written.
            const entries = validPluginEntries({}, [
                {
                    name: 'dist/huge.js',
                    content: Buffer.alloc(17 * 1024 * 1024),
                    deflate: true,
                },
            ]);

            await expect(
                installer.installFromBuffer(buildZip(entries), {
                    dir: root,
                    ...HOST,
                })
            ).rejects.toThrow(/larger than the 16 MB/);
            expect(fs.existsSync(path.join(root, 'demo-plugin'))).toBe(false);
        });

        it('refuses an archive that expands past the total size cap', async () => {
            // A few small deflated entries that each declare, and do expand
            // to, 14 MB: a compression bomb in the shape an attacker would
            // actually use.
            const chunk = Buffer.alloc(14 * 1024 * 1024);
            const entries = validPluginEntries();
            for (let index = 0; index < 5; index += 1) {
                entries.push({
                    name: `dist/bomb-${index}.bin`,
                    content: chunk,
                    deflate: true,
                });
            }

            await expect(
                installer.installFromBuffer(buildZip(entries), {
                    dir: root,
                    ...HOST,
                })
            ).rejects.toThrow(/expands to more than/);
            expect(fs.existsSync(path.join(root, 'demo-plugin'))).toBe(false);
        });

        it('refuses an id another directory already claims', async () => {
            writePluginDirectory(root, 'handmade', validPluginManifest());

            await expect(
                installer.installFromBuffer(buildZip(validPluginEntries()), {
                    dir: root,
                    ...HOST,
                })
            ).rejects.toThrow(
                /already installed from the directory "handmade"/
            );
            expect(fs.existsSync(path.join(root, 'demo-plugin'))).toBe(false);
            expect(workingDirectories(root)).toEqual([]);
        });

        describe('path traversal', () => {
            /**
             * yauzl validates entry names itself and refuses a `..` segment
             * before the installer ever sees it, so these cases are the outer
             * of two layers and the message may come from either. What has to
             * hold is that the archive is refused and nothing lands on disk;
             * `parseEntrySegments` below is where this app's own rule is
             * pinned down.
             */
            const escaping = [
                ['../evil.js', 'climbs one level'],
                ['../../evil.js', 'climbs two levels'],
                ['dist/../../evil.js', 'climbs out from inside a directory'],
                ['..\\evil.js', 'climbs with a Windows separator'],
                ['/etc/passwd', 'is absolute'],
                ['C:/Windows/evil.js', 'is a Windows absolute path'],
            ];

            it.each(escaping)('refuses an entry that %s', async (name) => {
                const entries = validPluginEntries({}, [
                    { name, content: 'pwned' },
                ]);

                await expect(
                    installer.installFromBuffer(buildZip(entries), {
                        dir: root,
                        ...HOST,
                    })
                ).rejects.toMatchObject({ statusCode: 400 });
                expect(fs.existsSync(path.join(root, 'demo-plugin'))).toBe(
                    false
                );
                expect(workingDirectories(root)).toEqual([]);
            });

            it('leaves nothing outside the plugin, and nothing behind', async () => {
                const entries = validPluginEntries({}, [
                    { name: '../evil.js', content: 'pwned' },
                ]);

                await expect(
                    installer.installFromBuffer(buildZip(entries), {
                        dir: root,
                        ...HOST,
                    })
                ).rejects.toThrow();

                expect(fs.existsSync(path.join(root, '..', 'evil.js'))).toBe(
                    false
                );
                expect(fs.existsSync(path.join(root, 'evil.js'))).toBe(false);
                expect(fs.existsSync(path.join(root, 'demo-plugin'))).toBe(
                    false
                );
                expect(workingDirectories(root)).toEqual([]);
            });

            it('refuses a name containing a NUL byte', async () => {
                const entries = validPluginEntries({}, [
                    { name: 'dist/evil\0.js', content: 'pwned' },
                ]);

                await expect(
                    installer.installFromBuffer(buildZip(entries), {
                        dir: root,
                        ...HOST,
                    })
                ).rejects.toThrow(/NUL byte/);
            });
        });
    });

    describe('parseEntrySegments', () => {
        it.each([
            ['../evil.js', /outside the plugin directory/],
            ['dist/../../evil.js', /outside the plugin directory/],
            ['a/..', /outside the plugin directory/],
            ['..\\evil.js', /outside the plugin directory/],
            ['/etc/passwd', /absolute path/],
            ['C:/Windows/evil.js', /absolute path/],
            [`dist/${'x'.repeat(400)}.js`, /longer than 300 characters/],
            ['a/b/c/d/e/f/g/h/i/j/k/l/m/n.js', /deeper than 12 levels/],
            ['dist/evil\0.js', /NUL byte/],
            ['', /empty name/],
        ])('refuses %s', (name, pattern) => {
            expect(() => installer.parseEntrySegments(name)).toThrow(pattern);
        });

        it('keeps only real path segments', () => {
            expect(installer.parseEntrySegments('dist//index.js')).toEqual([
                'dist',
                'index.js',
            ]);
            expect(installer.parseEntrySegments('./dist/index.js')).toEqual([
                'dist',
                'index.js',
            ]);
            expect(installer.parseEntrySegments('dist\\index.js')).toEqual([
                'dist',
                'index.js',
            ]);
        });
    });

    describe('removePlugin', () => {
        it('removes an installed plugin', async () => {
            await installer.installFromBuffer(buildZip(validPluginEntries()), {
                dir: root,
                ...HOST,
            });

            const result = await installer.removePlugin('demo-plugin', {
                dir: root,
            });

            expect(result).toEqual({ id: 'demo-plugin' });
            expect(fs.existsSync(path.join(root, 'demo-plugin'))).toBe(false);
            expect(service.listInstalled({ dir: root, ...HOST })).toEqual([]);
        });

        it('refuses an unknown plugin', async () => {
            await expect(
                installer.removePlugin('never-installed', { dir: root })
            ).rejects.toMatchObject({ statusCode: 404 });
        });

        it.each([
            ['..', 'a parent directory'],
            ['../demo-plugin', 'a path'],
            ['nested/demo-plugin', 'a nested path'],
            ['.staging-abc', 'a working directory'],
            ['Demo Plugin', 'an id the manifest rules would reject'],
            ['', 'an empty id'],
        ])('refuses %s, which is %s', async (id) => {
            await installer.installFromBuffer(buildZip(validPluginEntries()), {
                dir: root,
                ...HOST,
            });

            await expect(
                installer.removePlugin(id, { dir: root })
            ).rejects.toMatchObject({ statusCode: 400 });
            expect(fs.existsSync(path.join(root, 'demo-plugin'))).toBe(true);
        });

        it('refuses a directory whose manifest names another plugin', async () => {
            writePluginDirectory(
                root,
                'demo-plugin',
                validPluginManifest({ id: 'something-else' })
            );

            await expect(
                installer.removePlugin('demo-plugin', { dir: root })
            ).rejects.toThrow(/declares plugin id/);
            expect(fs.existsSync(path.join(root, 'demo-plugin'))).toBe(true);
        });
    });
});
