import { build } from 'esbuild';

/**
 * The plugin is built to a single ES module plus a stylesheet.
 *
 * React is deliberately never imported: the host passes its own instance to
 * `activate()`, and JSX compiles to `React.createElement` against that. Two
 * React copies in one renderer breaks hooks, so a plugin bundling its own is
 * the most common way an in-page plugin fails.
 */
const shared = {
    bundle: true,
    format: 'esm',
    target: 'es2018',
    platform: 'browser',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    external: ['react', 'react-dom'],
    logLevel: 'info',
};

await build({
    ...shared,
    entryPoints: ['src/index.tsx'],
    outfile: 'dist/index.js',
});

await build({
    ...shared,
    entryPoints: ['src/preferences.ts'],
    outfile: 'dist/preferences.js',
});

await build({
    entryPoints: ['src/theme.css'],
    outfile: 'dist/index.css',
});
