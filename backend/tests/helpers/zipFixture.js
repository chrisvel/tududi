'use strict';

/**
 * Build ZIP archives in memory, for tests.
 *
 * The installer's job is to decide what an archive is allowed to do, so its
 * tests have to be able to produce archives no archiver would: one with a `..`
 * segment, a symbolic link, a duplicate name, or a header that lies about how
 * much data follows. Writing those by hand means writing ZIP, which is a small,
 * stable format - a local file header per entry, a central directory, and an
 * end-of-central-directory record.
 *
 * Entries default to a regular file created on Unix. `mode` and `versionMadeBy`
 * exist so a test can ask for something else. CRC-32 is computed for real:
 * yauzl does not verify it, but a fixture with a wrong checksum is a fixture
 * that would not survive being checked by anything else.
 */

const zlib = require('zlib');

const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        }
        table[index] = value;
    }
    return table;
})();

const crc32 = (buffer) => {
    let crc = -1;
    for (const byte of buffer) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ -1) >>> 0;
};

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;

// 1980-01-01, the earliest date the format can express.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

const UNIX_REGULAR_FILE = 0o100644;
const UNIX_DIRECTORY = 0o40755;

const asBuffer = (content) => {
    if (content === undefined || content === null) return Buffer.alloc(0);
    if (Buffer.isBuffer(content)) return content;
    if (typeof content === 'string') return Buffer.from(content, 'utf8');
    return Buffer.from(JSON.stringify(content), 'utf8');
};

/**
 * @param {Array<{name: string, content?: string|Buffer, deflate?: boolean,
 *                mode?: number, versionMadeBy?: number,
 *                declaredUncompressedSize?: number}>} entries
 * @returns {Buffer} the archive
 */
function buildZip(entries) {
    const parts = [];
    const centralRecords = [];
    let offset = 0;

    for (const entry of entries) {
        const name = Buffer.from(entry.name, 'utf8');
        const raw = asBuffer(entry.content);
        const method = entry.deflate ? 8 : 0;
        const data = entry.deflate ? zlib.deflateRawSync(raw) : raw;
        const declared =
            entry.declaredUncompressedSize === undefined
                ? raw.length
                : entry.declaredUncompressedSize;
        const crc = crc32(raw);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(LOCAL_SIGNATURE, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0, 6);
        local.writeUInt16LE(method, 8);
        local.writeUInt16LE(DOS_TIME, 10);
        local.writeUInt16LE(DOS_DATE, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(declared, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);

        parts.push(local, name, data);

        const mode =
            (entry.mode === undefined
                ? entry.name.endsWith('/')
                    ? UNIX_DIRECTORY
                    : UNIX_REGULAR_FILE
                : entry.mode) >>> 0;

        const central = Buffer.alloc(46);
        central.writeUInt32LE(CENTRAL_SIGNATURE, 0);
        // High byte 3 is Unix, so the mode in `externalAttributes` means
        // something. Windows archivers write 0 or 20 here and put flags there
        // instead, which the installer has to tolerate.
        central.writeUInt16LE(entry.versionMadeBy ?? 0x0314, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0, 8);
        central.writeUInt16LE(method, 10);
        central.writeUInt16LE(DOS_TIME, 12);
        central.writeUInt16LE(DOS_DATE, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(declared, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE((mode << 16) >>> 0, 38);
        central.writeUInt32LE(offset, 42);

        centralRecords.push(central, name);
        offset += local.length + name.length + data.length;
    }

    const centralDirectory = Buffer.concat(centralRecords);

    const end = Buffer.alloc(22);
    end.writeUInt32LE(EOCD_SIGNATURE, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20);

    return Buffer.concat([...parts, centralDirectory, end]);
}

/** A plugin whose manifest and files are internally consistent. */
const validPluginManifest = (overrides = {}) => ({
    id: 'demo-plugin',
    name: 'Demo Plugin',
    version: '1.0.0',
    pluginApi: 1,
    entry: 'dist/index.js',
    ...overrides,
});

/** The entries of a complete, installable plugin. */
const validPluginEntries = (manifestOverrides = {}, extraEntries = []) => {
    const manifest = validPluginManifest(manifestOverrides);
    return [
        { name: 'plugin.json', content: JSON.stringify(manifest, null, 2) },
        { name: manifest.entry, content: '// plugin entry\n' },
        ...(manifest.styles || []).map((style) => ({
            name: style,
            content: '/* plugin styles */\n',
        })),
        ...extraEntries,
    ];
};

module.exports = {
    buildZip,
    crc32,
    validPluginManifest,
    validPluginEntries,
    UNIX_REGULAR_FILE,
    UNIX_DIRECTORY,
    SYMLINK_MODE: 0o120777,
};
