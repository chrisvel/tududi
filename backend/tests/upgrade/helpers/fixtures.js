const fs = require('fs');
const os = require('os');
const path = require('path');

const FIXTURE_DIR = path.join(__dirname, '..', '..', 'fixtures', 'legacy');
const BACKEND_DIR = path.join(__dirname, '..', '..', '..');

function listSqliteFiles(dir) {
    if (!dir || !fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((file) => file.endsWith('.sqlite3'))
        .sort()
        .map((file) => path.join(dir, file));
}

function readManifest() {
    try {
        return JSON.parse(
            fs.readFileSync(path.join(FIXTURE_DIR, 'manifest.json'), 'utf8')
        );
    } catch (_) {
        return {};
    }
}

// Committed fixtures plus any *.sqlite3 found under $LEGACY_FIXTURE_DIR, which
// lets a verification run include a copy of a real database without
// committing it.
function listFixtures() {
    const manifest = readManifest();
    const committed = listSqliteFiles(FIXTURE_DIR).map((file) => ({
        name: path.basename(file, '.sqlite3'),
        file,
        manifest: manifest[path.basename(file, '.sqlite3')] || null,
    }));
    const extra = listSqliteFiles(process.env.LEGACY_FIXTURE_DIR).map(
        (file) => ({
            name: `external:${path.basename(file, '.sqlite3')}`,
            file,
            manifest: null,
        })
    );
    return [...committed, ...extra];
}

function copyToTemp(fixtureFile) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tududi-upgrade-'));
    const target = path.join(dir, 'production.sqlite3');
    fs.copyFileSync(fixtureFile, target);
    for (const suffix of ['-wal', '-shm']) {
        const sidecar = `${fixtureFile}${suffix}`;
        if (fs.existsSync(sidecar)) {
            fs.copyFileSync(sidecar, `${target}${suffix}`);
        }
    }
    return { dir, file: target };
}

function removeTemp(dir) {
    if (dir && fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function migrationFiles() {
    return fs
        .readdirSync(path.join(BACKEND_DIR, 'migrations'))
        .filter((file) => file.endsWith('.js'))
        .sort();
}

module.exports = {
    FIXTURE_DIR,
    BACKEND_DIR,
    listFixtures,
    copyToTemp,
    removeTemp,
    migrationFiles,
};
