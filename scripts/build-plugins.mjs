#!/usr/bin/env node
/**
 * Build every plugin under `plugins/`.
 *
 * A plugin's bundle is not committed (`.gitignore` excludes `dist/`), so a
 * checkout has the source of every plugin and none of the built artifacts. The
 * server reports a plugin whose `entry` is missing as broken, with the build
 * command in the message - this is that command, for all of them at once.
 *
 * Written in Node rather than as a shell loop, because npm runs scripts through
 * cmd.exe on Windows, where a glob in a for-loop is not a thing.
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
);
const pluginsRoot = path.join(repoRoot, 'plugins');

const pluginDirectories = () => {
    if (!existsSync(pluginsRoot)) return [];

    return readdirSync(pluginsRoot)
        .filter((entry) => !entry.startsWith('.'))
        .map((entry) => path.join(pluginsRoot, entry))
        .filter((directory) => {
            if (!statSync(directory).isDirectory()) return false;
            return existsSync(path.join(directory, 'package.json'));
        });
};

// A command string rather than an argument list: npm is a shell script on POSIX
// and npm.cmd on Windows, so it has to go through a shell either way, and the
// shell is what resolves it. Every command here is a literal - no path or name
// from the filesystem is interpolated into it, only `cwd` below.
const run = (command, cwd) => execSync(command, { cwd, stdio: 'inherit' });

const directories = pluginDirectories();

if (directories.length === 0) {
    console.log('No plugins to build.');
    process.exit(0);
}

for (const directory of directories) {
    const name = path.relative(repoRoot, directory);

    // Installing every time would be slow and would fight a locked cache, so
    // node_modules is the marker for "dependencies are already here". A stale
    // node_modules is the person's problem to clear, and `npm install` reports
    // nothing either way.
    if (!existsSync(path.join(directory, 'node_modules'))) {
        console.log(`Installing dependencies for ${name}...`);
        run('npm install --no-audit --no-fund', directory);
    }

    console.log(`Building ${name}...`);
    run('npm run build', directory);
}

console.log(`Built ${directories.length} plugin(s).`);
