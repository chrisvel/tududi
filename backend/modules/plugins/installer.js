'use strict';

/**
 * Installing a plugin from an uploaded ZIP archive.
 *
 * An operator installs a plugin by hand by dropping a directory into the
 * plugins root; this module is the same act performed from the browser. It is
 * the only place in the app that writes to the plugins root, and everything it
 * writes arrives as an untrusted archive, so the checks below are the feature
 * rather than defensive padding:
 *
 *  - paths are resolved segment by segment and a `..` segment is refused, so an
 *    archive cannot write outside the plugin's own directory (zip slip);
 *  - symbolic links are refused, so an archive cannot plant a link that a later
 *    read follows out of the plugins root;
 *  - declared and actual sizes are both capped, and the entry count with them,
 *    so a small archive cannot expand into an unbounded write;
 *  - the manifest is validated before anything is moved into place, so a
 *    directory that the host cannot load is never installed;
 *  - the finished directory is swapped in with a rename, so a plugin is never
 *    half-written and an update cannot leave the previous version's files
 *    behind.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { fromBufferPromise } = require('yauzl');

const AppError = require('../../shared/errors/AppError');
const {
    ID_PATTERN,
    MANIFEST_FILENAME,
    PLUGIN_API_VERSION,
    validateManifest,
} = require('./manifest');
const {
    getPluginsDir,
    getHostVersion,
    missingReferencedFiles,
} = require('./service');

/** Also enforced by multer; kept here so the installer is safe on its own. */
const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;
const MAX_ENTRIES = 2000;
const MAX_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_PATH_LENGTH = 300;
const MAX_DEPTH = 12;

/**
 * Files a desktop archiver adds on its own. Windows' "Send to > Compressed
 * folder" and macOS's Finder both produce them, and refusing an archive over a
 * resource fork would make the feature unusable for exactly the people it is
 * for.
 */
const METADATA_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
const METADATA_DIR = '__MACOSX';

/** A 400: the archive is readable but is not a plugin this host can install. */
const invalidArchive = (message) =>
    new AppError(message, 400, 'VALIDATION_ERROR');

const isMetadataEntry = (name) => {
    const normalized = name.replace(/\\/g, '/');
    if (
        normalized === METADATA_DIR ||
        normalized.startsWith(`${METADATA_DIR}/`)
    ) {
        return true;
    }
    return METADATA_FILES.has(path.posix.basename(normalized));
};

const exists = async (target) => {
    try {
        await fsp.stat(target);
        return true;
    } catch {
        return false;
    }
};

/**
 * Turn one archive entry name into path segments, or refuse it.
 *
 * Backslashes are treated as separators because a ZIP written on Windows may
 * use them, and a name that is only rejected in its forward-slash form is not
 * rejected at all. An empty result, an absolute name or a `..` segment all mean
 * the archive is trying to address something other than a file of its own.
 */
const parseEntrySegments = (rawName) => {
    const normalized = rawName.replace(/\\/g, '/');

    if (normalized.includes('\0')) {
        throw invalidArchive('The archive contains a name with a NUL byte.');
    }
    if (normalized.length > MAX_PATH_LENGTH) {
        throw invalidArchive(
            `The archive contains a path longer than ${MAX_PATH_LENGTH} characters.`
        );
    }
    if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
        throw invalidArchive(
            `The archive contains an absolute path ("${rawName}").`
        );
    }

    const segments = normalized
        .split('/')
        .filter((segment) => segment !== '' && segment !== '.');

    if (segments.length === 0) {
        throw invalidArchive(
            `The archive contains an empty name ("${rawName}").`
        );
    }
    if (segments.length > MAX_DEPTH) {
        throw invalidArchive(
            `The archive contains a path deeper than ${MAX_DEPTH} levels.`
        );
    }
    if (segments.includes('..')) {
        throw invalidArchive(
            `The archive tries to write outside the plugin directory ("${rawName}").`
        );
    }

    return segments;
};

/** The Unix mode a ZIP entry was created with, or null on a non-Unix archive. */
const unixModeOf = (entry) => {
    // The high 16 bits hold the mode, and only when the archive says it was
    // made on Unix (3): a DOS archive puts other flags in those bits.
    const madeBy = entry.versionMadeBy >> 8;
    if (madeBy !== 3) return null;
    return (entry.externalFileAttributes >>> 16) & 0o170000;
};

const isInside = (root, target) => {
    const rootPath = path.resolve(root);
    const targetPath = path.resolve(target);
    return (
        targetPath === rootPath || targetPath.startsWith(rootPath + path.sep)
    );
};

/**
 * Decide what to do with one entry and charge its declared size to the budget.
 *
 * Returns null for entries that are not files to extract: the archive's own
 * directory records, which are recreated from the paths of the files inside
 * them, and the metadata files desktop archivers add.
 */
const planEntry = (entry, budget) => {
    const rawName = entry.fileName;

    if (rawName.endsWith('/') || rawName.endsWith('\\')) return null;
    if (isMetadataEntry(rawName)) return null;

    const segments = parseEntrySegments(rawName);

    const mode = unixModeOf(entry);
    if (mode === 0o120000) {
        throw invalidArchive(
            `The archive contains a symbolic link ("${rawName}"), which is not allowed.`
        );
    }

    const declared = entry.uncompressedSize;
    if (declared > MAX_ENTRY_BYTES) {
        throw invalidArchive(
            `"${rawName}" is larger than the ${Math.floor(MAX_ENTRY_BYTES / 1024 / 1024)} MB an entry may be.`
        );
    }

    budget.declared += declared;
    if (budget.declared > MAX_TOTAL_BYTES) {
        throw invalidArchive(
            `The archive expands to more than the ${Math.floor(MAX_TOTAL_BYTES / 1024 / 1024)} MB a plugin may be.`
        );
    }

    return { entry, segments };
};

/**
 * Write one entry, counting the bytes that actually arrive.
 *
 * The declared size is already capped, but the header is attacker-controlled:
 * a stream that keeps producing past what it promised is stopped here rather
 * than being allowed to fill the disk.
 */
const writeEntryToFile = (zip, entry, destination, budget) =>
    new Promise((resolve, reject) => {
        let settled = false;
        const fail = (error) => {
            if (settled) return;
            settled = true;
            reject(error);
        };
        const succeed = () => {
            if (settled) return;
            settled = true;
            resolve();
        };

        zip.openReadStream(entry, (openError, readStream) => {
            if (openError) {
                fail(
                    invalidArchive(
                        `Could not read "${entry.fileName}" from the archive: ${openError.message}`
                    )
                );
                return;
            }

            // `wx` refuses to reuse a path: a duplicate entry name would
            // otherwise let one file overwrite another inside the archive.
            const writeStream = fs.createWriteStream(destination, {
                mode: 0o644,
                flags: 'wx',
            });
            let entryBytes = 0;

            readStream.on('data', (chunk) => {
                entryBytes += chunk.length;
                budget.actual += chunk.length;

                if (
                    entryBytes > MAX_ENTRY_BYTES ||
                    budget.actual > MAX_TOTAL_BYTES
                ) {
                    readStream.destroy();
                    writeStream.destroy();
                    fail(
                        invalidArchive(
                            'The archive expands to more than a plugin may be.'
                        )
                    );
                }
            });
            readStream.on('error', (error) => {
                writeStream.destroy();
                fail(
                    invalidArchive(
                        `Could not read "${entry.fileName}" from the archive: ${error.message}`
                    )
                );
            });
            writeStream.on('error', (error) => {
                readStream.destroy();
                fail(
                    error.code === 'EEXIST'
                        ? invalidArchive(
                              `The archive contains "${entry.fileName}" twice.`
                          )
                        : error
                );
            });
            writeStream.on('close', succeed);

            readStream.pipe(writeStream);
        });
    });

/**
 * Unpack an archive into `staging`, which must not exist yet.
 *
 * The single pass matters: yauzl can only stream the entry it most recently
 * handed back, so listing every name first and reading them afterwards is not
 * possible without opening the archive twice. Each entry is therefore planned
 * and written as it arrives.
 */
async function extractArchive(buffer, staging) {
    await fsp.mkdir(staging, { recursive: true });

    let zip;
    try {
        zip = await fromBufferPromise(buffer, {
            lazyEntries: true,
            validateEntrySizes: true,
        });
    } catch {
        throw invalidArchive(
            'The uploaded file is not a readable ZIP archive.'
        );
    }

    const budget = { declared: 0, actual: 0 };
    let entries = 0;

    try {
        await new Promise((resolve, reject) => {
            let settled = false;
            const close = () => {
                try {
                    zip.close();
                } catch {
                    // The archive is already unusable; there is nothing to fix.
                }
            };
            const fail = (error) => {
                if (settled) return;
                settled = true;
                close();
                reject(error);
            };
            const succeed = () => {
                if (settled) return;
                settled = true;
                resolve();
            };

            zip.on('entry', (entry) => {
                if (settled) return;

                entries += 1;
                if (entries > MAX_ENTRIES) {
                    fail(
                        invalidArchive(
                            `The archive contains more than ${MAX_ENTRIES} entries.`
                        )
                    );
                    return;
                }

                let planned;
                try {
                    planned = planEntry(entry, budget);
                } catch (error) {
                    fail(error);
                    return;
                }

                if (!planned) {
                    zip.readEntry();
                    return;
                }

                const destination = path.join(staging, ...planned.segments);
                if (!isInside(staging, destination)) {
                    fail(
                        invalidArchive(
                            `The archive tries to write outside the plugin directory ("${entry.fileName}").`
                        )
                    );
                    return;
                }

                fsp.mkdir(path.dirname(destination), { recursive: true })
                    .then(() =>
                        writeEntryToFile(zip, entry, destination, budget)
                    )
                    .then(() => zip.readEntry())
                    .catch(fail);
            });

            zip.on('error', (error) =>
                fail(
                    invalidArchive(
                        `The archive could not be read: ${error.message}`
                    )
                )
            );
            zip.on('end', succeed);

            zip.readEntry();
        });
    } finally {
        try {
            zip.close();
        } catch {
            // Already closed, or nothing left to close.
        }
    }
}

/**
 * Fold a wrapper directory away.
 *
 * Zipping a folder - on macOS, on Windows, or through GitHub's "Download ZIP" -
 * puts the plugin one level down, so the archive holds `calm-mode/plugin.json`
 * rather than `plugin.json`. That is the normal way an operator will produce
 * the file, and rejecting it would mean rejecting the obvious input. Only a
 * single top-level directory that actually holds the manifest is unwrapped, so
 * an archive cannot use this to smuggle a second plugin's files into the first.
 */
async function unwrapTopLevelDirectory(staging) {
    const atRoot = path.join(staging, MANIFEST_FILENAME);
    if (await exists(atRoot)) return staging;

    let entries;
    try {
        entries = await fsp.readdir(staging, { withFileTypes: true });
    } catch {
        return staging;
    }

    if (entries.length !== 1 || !entries[0].isDirectory()) return staging;

    const inner = path.join(staging, entries[0].name);
    if (!(await exists(path.join(inner, MANIFEST_FILENAME)))) return staging;

    for (const child of await fsp.readdir(inner)) {
        await fsp.rename(path.join(inner, child), path.join(staging, child));
    }
    await fsp.rm(inner, { recursive: true, force: true });

    return staging;
}

const readManifestFile = async (dir) => {
    let raw;
    try {
        raw = JSON.parse(
            await fsp.readFile(path.join(dir, MANIFEST_FILENAME), 'utf8')
        );
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw invalidArchive(
                `The archive does not contain ${MANIFEST_FILENAME} at its root. ZIP the plugin's own directory (or its contents), not a parent folder.`
            );
        }
        throw invalidArchive(
            `${MANIFEST_FILENAME} is not valid JSON: ${error.message}`
        );
    }
    return raw;
};

/** The directory a plugin with this id is installed as. */
const pluginTarget = (pluginsDir, id) => {
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
        throw new AppError(`Invalid plugin id: ${id}`, 400, 'VALIDATION_ERROR');
    }
    return path.join(path.resolve(pluginsDir), id);
};

/**
 * Refuse to install an id that a differently named directory already provides.
 *
 * The directory name is an implementation detail - the id in the manifest is
 * the plugin's identity - so two directories can claim the same id, and the
 * frontend would then see the plugin twice with no way to tell which files it
 * loaded. Naming the existing directory is the only way an operator can act on
 * it.
 */
async function assertIdIsNotClaimedElsewhere(pluginsDir, id) {
    let entries;
    try {
        entries = await fsp.readdir(pluginsDir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === id) continue;
        if (entry.name.startsWith('.')) continue;

        let claimed = null;
        try {
            claimed = JSON.parse(
                await fsp.readFile(
                    path.join(pluginsDir, entry.name, MANIFEST_FILENAME),
                    'utf8'
                )
            );
        } catch {
            continue;
        }

        if (claimed && claimed.id === id) {
            throw new AppError(
                `Plugin ${id} is already installed from the directory "${entry.name}". Remove that directory first.`,
                409,
                'CONFLICT'
            );
        }
    }
}

const randomToken = () => crypto.randomBytes(8).toString('hex');

/** Remove a temporary directory, reporting a failure instead of throwing. */
const removeTree = async (target) => {
    try {
        await fsp.rm(target, { recursive: true, force: true });
    } catch (error) {
        // Leaving a `.staging-*` directory behind is untidy but harmless: the
        // listing skips dot directories, and the next install does not reuse
        // the name. Failing the request here would be worse, because the plugin
        // itself may already be installed and working.
        console.error(`Could not remove ${target}: ${error.message}`);
    }
};

/**
 * Install (or update) a plugin from an archive.
 *
 * `updated` distinguishes replacing an existing plugin from installing a new
 * one, which is the only difference the UI cares about. Everything else is the
 * same operation: the archive carries its own id, so a second upload of the
 * same plugin is an update by definition.
 */
async function installFromBuffer(buffer, options = {}) {
    const pluginsDir = options.dir || getPluginsDir();
    const hostVersion =
        options.hostVersion === undefined
            ? getHostVersion()
            : options.hostVersion;
    const pluginApiVersion =
        options.pluginApiVersion === undefined
            ? PLUGIN_API_VERSION
            : options.pluginApiVersion;

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw invalidArchive('The uploaded file is empty.');
    }
    if (buffer.length > MAX_ARCHIVE_BYTES) {
        throw new AppError(
            `The archive is larger than the ${Math.floor(MAX_ARCHIVE_BYTES / 1024 / 1024)} MB a plugin upload may be.`,
            413,
            'VALIDATION_ERROR'
        );
    }

    await fsp.mkdir(pluginsDir, { recursive: true });

    // Both temporary directories are dot-prefixed siblings of the target, so a
    // half-finished install is never listed as a plugin, and the final rename
    // stays on one filesystem and is therefore atomic.
    const staging = path.join(pluginsDir, `.staging-${randomToken()}`);
    const retired = path.join(pluginsDir, `.retired-${randomToken()}`);

    // The previous version, while it is sitting in `retired` waiting to be
    // replaced or put back. Null once it is no longer the only copy.
    let previous = null;
    // Set when the new version could not be swapped in *and* the old one could
    // not be put back: `retired` then holds the only copy, so it is kept.
    let keepRetired = false;
    let target = null;

    try {
        await extractArchive(buffer, staging);
        await unwrapTopLevelDirectory(staging);

        const raw = await readManifestFile(staging);
        const result = validateManifest(raw, {
            hostVersion,
            pluginApiVersion,
        });

        if (!result.ok) {
            throw invalidArchive(
                `${MANIFEST_FILENAME} is not a usable plugin manifest: ${result.errors.join('; ')}`
            );
        }

        const missing = missingReferencedFiles(staging, result.manifest);
        if (missing.length > 0) {
            throw invalidArchive(
                `The plugin is incomplete: ${missing.join('; ')}`
            );
        }

        const id = result.manifest.id;
        await assertIdIsNotClaimedElsewhere(pluginsDir, id);

        target = pluginTarget(pluginsDir, id);
        const updated = await exists(target);

        if (updated) {
            await fsp.rename(target, retired);
            previous = retired;
        }

        await fsp.rename(staging, target);

        return {
            id,
            name: result.manifest.name,
            version: result.manifest.version || null,
            updated,
            dir: target,
        };
    } catch (error) {
        // An update replaces the working copy only at the rename, so a failure
        // before that point leaves the old plugin exactly where it was.
        if (previous) {
            try {
                await fsp.rename(previous, target);
                previous = null;
            } catch (restoreError) {
                keepRetired = true;
                console.error(
                    `Could not restore the previous version of ${target}. ` +
                        `It is still in ${retired}: ${restoreError.message}`
                );
            }
        }
        throw error;
    } finally {
        await removeTree(staging);
        // On an update this is the previous version, now replaced. When the
        // restore above failed it holds the only copy, and is left alone so
        // the plugin can be recovered by hand.
        if (!keepRetired) {
            await removeTree(retired);
        }
    }
}

/**
 * Remove an installed plugin.
 *
 * The directory's own manifest has to name the id being removed. Otherwise an
 * id would be able to address a directory that reports itself as something
 * else, and a removal would delete a plugin the caller never named.
 */
async function removePlugin(id, options = {}) {
    const pluginsDir = options.dir || getPluginsDir();
    const target = pluginTarget(pluginsDir, id);

    if (!(await exists(target))) {
        throw new AppError(`Unknown plugin: ${id}`, 404, 'NOT_FOUND');
    }

    let installed;
    try {
        installed = JSON.parse(
            await fsp.readFile(path.join(target, MANIFEST_FILENAME), 'utf8')
        );
    } catch {
        throw new AppError(
            `The directory for ${id} has no readable ${MANIFEST_FILENAME}, so it is not a plugin this app installed.`,
            409,
            'CONFLICT'
        );
    }

    if (!installed || installed.id !== id) {
        throw new AppError(
            `The directory for ${id} declares plugin id "${installed && installed.id}", so it was not removed.`,
            409,
            'CONFLICT'
        );
    }

    await fsp.rm(target, { recursive: true, force: true });
    return { id };
}

module.exports = {
    MAX_ARCHIVE_BYTES,
    MAX_ENTRIES,
    MAX_TOTAL_BYTES,
    installFromBuffer,
    removePlugin,
    pluginTarget,
    parseEntrySegments,
};
