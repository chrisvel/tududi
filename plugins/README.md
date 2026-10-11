# Plugins

Each directory here is one plugin. The server lists whatever it finds under this directory (or under `TUDUDI_PLUGINS_DIR`), and each user decides on their own account which of them to enable.

[calm-mode](calm-mode) is the worked example: it registers a page, a theme, a settings panel and a navigation filter, it is tested, and its README explains the design choices. Read it alongside this guide.

For the host side — validation rules, the full API reference, the HTTP surface and the trust model — see [docs/26-plugins.md](../docs/26-plugins.md).

---

## The smallest plugin that works

```
plugins/hello/
  plugin.json
  dist/index.js
```

```json
{
    "id": "hello",
    "name": "Hello",
    "version": "1.0.0",
    "pluginApi": 1,
    "host": ">=1.9 <2",
    "entry": "dist/index.js"
}
```

```js
// src/index.tsx -> dist/index.js
let api;

export function activate(host) {
    api = host;

    host.registerRoute({
        id: 'hello',
        path: 'hello',
        element: HelloPage,
        nav: { label: 'Hello', order: 50 },
    });
}

function HelloPage() {
    const React = api.React;
    return React.createElement('div', { className: 'p-6' }, 'Hello');
}
```

Drop the directory in, reload, and enable it under **Profile → Plugins**. The page is served at `/plugins/hello/hello` and the sidebar entry appears while it is enabled.

---

## Rules that are enforced

**Never bundle React.** The host passes its own instance as `api.React`; JSX compiles to `React.createElement` against it. Two React copies inside one renderer breaks hooks, and it is the most common way an in-page plugin fails. This has a sharp edge: the plugin cannot `import { useState } from 'react'` either. Capture the host instance in `activate` and read hooks off it at render time — `calm-mode/src/react.ts` is a five-line module that does exactly this, and throws a clear error if a component renders before activation.

**Everything goes through `activate`.** A plugin's module body may run before the host is ready. Registration after disposal throws on purpose.

**Declare the API major you were built against.** `pluginApi` must equal the host's (`1` today). The host refuses to import a plugin built for another major rather than running it against an API it does not have. `host` is a separate, advisory range for the Tududi version, and it is checked too.

**Paths stay inside the plugin.** `entry` and `styles` must be relative, with no `..` and no scheme. Anything else is rejected before the plugin is offered.

**The bundle has to exist.** The host checks that `entry` and every `styles` file are present and reports the plugin as broken, naming the build command, if they are not — so a plugin that was never built is obvious in the plugin manager instead of failing in the browser with a 404.

**`nosniff` and no dotfiles.** Plugin files are served with `X-Content-Type-Options: nosniff` and dotfiles are never served, so a plugin's `.env` is not readable over HTTP.

---

## Building

`calm-mode` builds with esbuild to ESM; the same recipe works for any plugin:

```js
const shared = {
    bundle: true,
    format: 'esm',
    target: 'es2018',
    platform: 'browser',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    external: ['react', 'react-dom'],
};

await build({
    ...shared,
    entryPoints: ['src/index.tsx'],
    outfile: 'dist/index.js',
});
await build({ entryPoints: ['src/theme.css'], outfile: 'dist/index.css' });
```

Notes from the working build:

- **ESM, not IIFE.** The host loads the entry with a dynamic `import()`, so the bundle must have real exports. A bundle without an `activate` export is reported as such.
- **Relative chunks are fine.** A second entry (`dist/preferences.js`) resolves over HTTP relative to the plugin's own URL. Bare imports are not — nothing else is on the host's import map.
- **Stylesheets are plain CSS.** The host injects them as `<link>` elements before the entry runs; they are not scoped for you, so use a class on `<html>` (which is what a theme registration is for) rather than styling bare element names.

---

## What a plugin can contribute

| Registration            | Result                                                              |
| ----------------------- | ------------------------------------------------------------------- |
| `registerRoute`         | A page under `/plugins/<id>/`, optionally with a sidebar entry      |
| `registerTheme`         | A single class on `<html>` plus CSS custom properties, while active |
| `registerSettingsPanel` | A panel under the plugin in Profile → Plugins                       |
| `registerNavFilter`     | Hides sidebar items (return exactly `false`)                        |

Ids are namespaced by the host as `<pluginId>:<localId>`, so two plugins cannot collide and one cannot claim another's route. `registerTheme` accepts exactly one class token, and `tokens` keys must be `--custom-properties`, because both are written straight onto the document element.

Data access goes through `api.api.get/post/put/patch/del`, which is the authenticated REST API with the user's own session. A plugin reads and writes the same records the app does, with the same permissions.

---

## Shortcuts (optional)

`shortcuts` in `plugin.json` puts a plugin page in the installed app's launcher menu:

```json
"shortcuts": [
    { "name": "One thing", "description": "Open the single-page view", "path": "focus" }
]
```

`path` is relative to the plugin's own route prefix, at most 4 shortcuts are kept, and they only appear for users who have enabled the plugin.

---

## Testing

`calm-mode` uses `node --test` for the modules that can be pure:

```sh
cd plugins/calm-mode
npm install
npm test        # build + node --test
npm run typecheck
```

Keep the logic that touches the account — notification preferences, settings migration — in a pure module that can be tested without a browser. That is where a mistake is not merely cosmetic; `calm-mode/src/preferences.ts` captures the previous push flags so that quietening reminders can be undone exactly.

---

## Trust

Plugin code runs in the page with the signed-in user's session: the same trust level as the person installing it. Nothing is sandboxed. Installing a plugin is an operator decision made on the server, enabling it is a user decision made in the app, and a plugin's README should say plainly what it reads and writes — as `calm-mode` does.
