# Plugins

How Tududi loads third-party interface extensions. For the authoring side see [plugins/README.md](../plugins/README.md) and the worked example in [plugins/calm-mode](../plugins/calm-mode).

---

## What a plugin is

A plugin is a directory on the server holding a `plugin.json` and the JavaScript bundle that manifest points at. Enabling it adds pages, a theme, settings panels or narrower navigation to the app — it does not replace anything. The tasks, projects, areas and notes underneath are always the same records.

A plugin is **interface-only**. It runs in the page, against the host's own React instance, and reaches data through the same REST API the app uses, with the signed-in user's own session. There is no plugin-supplied server code, so a plugin cannot add an endpoint, and nothing a plugin does is invisible to the API's normal authorization.

---

## Installing a plugin

Plugins live under `<repo>/plugins/`, or wherever `TUDUDI_PLUGINS_DIR` points. Each immediate subdirectory is one plugin; a dot-directory is skipped.

```
plugins/
  calm-mode/
    plugin.json
    dist/index.js
    dist/index.css
```

The server reads the directory on every `GET /api/plugins` — no restart is needed to see a new plugin, and no build writes into it. That is deliberate: the webpack build runs with `clean: true` and its output is served `immutable` for a year, so plugin files served from `dist` would either be deleted by a build or could never be updated.

**A plugin must be built before it can be enabled.** The server checks that the files `entry` and each of `styles` name actually exist, and reports a plugin whose bundle is missing as broken with the build command in the message, rather than offering it for enabling and then failing in the browser with a 404. In the Docker image plugins are built in the builder stage and copied in already built.

Installation and enabling are separate steps:

| Step                      | Who                                      | Where                              |
| ------------------------- | ---------------------------------------- | ---------------------------------- |
| Put the directory on disk | The operator (root access to the server) | `plugins/` or `TUDUDI_PLUGINS_DIR` |
| Enable it                 | Each user, for their own account         | Profile → Plugins                  |

An operator-installed plugin is listed as `enabled: false` until a user turns it on. Disabling it disposes every registration it made, so nothing it added stays behind.

### Installing from the app

An operator does not need shell access to add a plugin: Profile → Plugins accepts a `.zip` upload and writes it into the plugins directory. **This is the same trust decision as dropping the directory in by hand** — it puts code that every account loads onto the server — so it is restricted to an admin, and refused for a request authenticated with an API token or an OIDC access token (those are not a person deciding to run new code). The listing reports `canManage` so the browser only offers the controls this account can actually use. An instance whose roles table is still empty allows any signed-in user, the same bootstrap rule user management follows, and never on a hosted instance.

The archive may hold the plugin's files directly or one wrapper directory (what "Compress folder" and GitHub's "Download ZIP" produce), and is expected to contain a valid `plugin.json` naming its own id — the id in the manifest is what is installed, not the file name:

```sh
# Either of these installs as <plugins>/calm-mode
calm-mode/plugin.json, calm-mode/dist/…
plugin.json, dist/…
```

Uploading an archive whose id is already installed **replaces** it: one request covers both installing and updating, and the response says which happened. Uploading an id another directory already provides is refused, since the frontend would otherwise see one plugin twice. Every refusal is a `400` naming the reason, and nothing is written into the plugins directory unless the whole archive passed:

| Guard                                 | Limit / rule                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Upload size                           | 10 MB, refused while it is still arriving                                                         |
| Entries                               | 2000                                                                                              |
| One file                              | 16 MB                                                                                             |
| Uncompressed total                    | 64 MB, from the declared sizes and again from the bytes that actually arrive                      |
| Paths                                 | Relative, at most 300 characters and 12 levels; `..`, absolute and drive-letter paths are refused |
| Symlinks                              | Refused                                                                                           |
| Duplicate entry names                 | Refused                                                                                           |
| `__MACOSX/`, `.DS_Store`, `Thumbs.db` | Ignored, so an archive from Finder or Explorer is still installable                               |

A plugin is unpacked into a dot-prefixed staging directory beside its target (never listed as a plugin), validated there, and moved into place with a single `rename` — so a failed upload leaves the previous version exactly as it was, and an update cannot leave the old bundle's files behind. Removing a plugin (`DELETE /api/plugins/:id`) deletes the directory, for every account; a description left in someone's settings is harmless, and re-installing the plugin brings their choice back with it.

### Keeping installs in Docker

The plugins root is state, not build output, so the image declares it as a volume and the bundled deploy mounts a directory over it:

```yaml
volumes:
    - ./plugins:/app/plugins # deploy-custom.sh: $DATA_DIR/plugins
```

The plugins that ship with the app are kept in the image at `/app/plugins-bundled`, and the entrypoint copies them into the plugins root **when that root is empty** — which is what a first start with a fresh volume looks like. Seeding only an empty root is what makes a deliberately removed bundled plugin stay removed. Without the mount an install would still work and would be gone at the next `docker compose up`.

---

## `plugin.json`

| Field         | Required | Rules                                                                                                                                                    |
| ------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | yes      | `^[a-z0-9][a-z0-9._-]*$`, at most 64 characters. Also the directory name the server lists it under.                                                      |
| `name`        | yes      | Non-empty, at most 200 characters. Shown in Profile → Plugins.                                                                                           |
| `version`     | yes      | Semver, optionally `v`-prefixed (`1.0.0`, `v1.9.1`). Becomes the `?v=` on every asset URL.                                                               |
| `description` | no       | At most 200 characters.                                                                                                                                  |
| `pluginApi`   | yes      | The host extension-contract major the plugin was built against. A mismatch is fatal: the plugin is listed with the reason and never imported.            |
| `host`        | no       | A semver range for the Tududi version (`>=1.9 <2`, `>=1.9.0`, `1.9`, `*`, `                                                                              |     | ` alternatives). Checked against the running version. |
| `entry`       | yes      | Relative path to the ESM bundle that exports `activate`. Absolute, scheme-qualified and `..`-climbing paths are rejected.                                |
| `styles`      | no       | Array of relative stylesheet paths, injected as `<link>` elements before the entry is imported.                                                          |
| `shortcuts`   | no       | Up to 4 launcher shortcuts for the installed app, each `{ name, short_name?, description?, path }`. `path` is relative to the plugin's own route prefix. |

`pluginApi` is the hard gate and `host` is a courtesy: `pluginApi` protects the contract the host can actually enforce, while `host` lets a plugin refuse a version it has not been tested against even though the API major still matches. The version-range matcher is a deliberately small subset of npm's semver — comparators, `^`, `~`, X-ranges and `||` — implemented in [backend/modules/plugins/manifest.js](../backend/modules/plugins/manifest.js#L1) with the prerelease rule npm uses, so `2.0.0-beta.1` does not satisfy `>=1.9 <2`.

The same validation exists twice: the server in `backend/modules/plugins/manifest.js` is authoritative and rejects a plugin as `ok: false` with its errors, and [frontend/plugins/manifest.ts](../frontend/plugins/manifest.ts) re-checks the subset the browser depends on before building a URL and importing (`id` safety, `entry` and `styles` paths, API major). The client copy does not re-implement the version-range engine; two copies of that would only be two things to keep in step.

---

## The host API

`activate(api)` receives:

| Member                                                      | What it does                                                                                                                                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api.React`                                                 | The host's own React. A plugin must use this instead of importing React — two React copies in one renderer breaks hooks.                                                               |
| `api.registerRoute({ id, path, element, nav? })`            | A page at `/plugins/<pluginId>/<path>`, optionally with a sidebar entry (`label`, `icon`, `order`).                                                                                    |
| `api.registerTheme({ id, className, label?, tokens? })`     | A root class plus CSS custom properties, applied while the theme is active. `className` must be a single class token.                                                                  |
| `api.registerSettingsPanel({ id, label, element, order? })` | A panel listed under the plugin in Profile → Plugins.                                                                                                                                  |
| `api.registerNavFilter(fn)`                                 | Filters sidebar items. Returning exactly `false` hides the item; anything else — including a throw — keeps it, because hiding navigation by accident is worse than failing to hide it. |
| `api.activateTheme(localId \| null)`                        | Persists the active theme for this user and applies it. Only this plugin's own theme is reported back by `api.activeTheme()`.                                                          |
| `api.settings.get() / set(patch)`                           | The plugin's own settings slice, stored with the account.                                                                                                                              |
| `api.api.get/post/put/patch/del`                            | Authenticated wrapper over the REST API for anything the host does not model.                                                                                                          |
| `api.t(key, fallback)`                                      | The host's translation function.                                                                                                                                                       |
| `api.log.info/warn/error`                                   | Prefixed with `[plugin:<id>]`.                                                                                                                                                         |
| `api.onDispose(fn)`                                         | Runs when the plugin is disabled or the page unloads.                                                                                                                                  |

Every `register*` returns a `Disposable`. Calling any of them after disposal throws, so a plugin that keeps a timer running against a teardown deserves the error rather than silent misbehaviour.

**Namespacing is enforced, not documented.** Registrations are keyed `<pluginId>:<localId>`, one plugin cannot claim another's id, and route paths are built with the `/plugins/<pluginId>` prefix rather than accepted from the manifest. A plugin can only ever reach pages under its own namespace:

```ts
api.registerRoute({ id: 'focus', path: 'focus', element: FocusPage });
// served at /plugins/calm-mode/focus
```

Plugin pages are resolved by a single host route (`/plugins/:pluginId/*`) reading the registry, not by handing React Router extra `<Route>` elements: a `<Routes>` only accepts `Route` children directly and the plugin set is known only after an asynchronous load. The longest matching path wins, and an unmatched path says the page belongs to a plugin that is not enabled on this account — an empty page would read as a bug.

`activate` may return a cleanup function, which runs alongside the plugin's own disposables.

---

## Failure handling

One broken plugin must never stop the others from loading, or the app from starting.

- Validation runs before anything is imported; a manifest that fails is listed with its reasons and never executed. `frontend/plugins/manifest.ts` is explicit that anything other than an explicit yes is a no.
- A plugin whose entry point throws during import or activation is rolled back: its injected stylesheets are removed and everything it registered is disposed, so it cannot leave half a page behind.
- Plugins load sequentially, in id order. Parallel loading would make the sidebar order depend on network timing.
- Failures are reported in Profile → Plugins rather than in a console nobody reads, and never as a modal that blocks the app.
- Plugin pages are wrapped in an error boundary, so a render error inside one page does not take the shell down with it.

---

## HTTP surface

| Endpoint                                           | Auth            | Purpose                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/plugins`                                 | required        | Installed plugins plus this user's state (`enabled`, `settings`, `activeTheme`), the API version, the plugins directory and `canManage`.                                                                                                                     |
| `PUT /api/plugins/:id`                             | required        | `{ enabled }` and/or `{ settings }` for one plugin. Enabling a plugin the server has rejected is a 400 — otherwise the user would get a plugin that silently never appears.                                                                                  |
| `PUT /api/plugins/state`                           | required        | `{ activeTheme }` for the account.                                                                                                                                                                                                                           |
| `POST /api/plugins/install`                        | admin, no token | A multipart `.zip` upload (`plugin` field): installs it, or updates the plugin it names. `201` for a new plugin, `200` for a replacement, and the full listing back either way.                                                                              |
| `DELETE /api/plugins/:id`                          | admin, no token | Removes an installed plugin from the server, for every account.                                                                                                                                                                                              |
| `GET /plugins/<id>/<path>`                         | session only    | The plugin's own files. `no-cache` (revalidate) rather than immutable, plus the version query, and `nosniff` so a file is never reinterpreted as another type. A signed-out request is a 401, and an API token is a 403 - the page fetches a bundle with its own cookies, and a token is refused for installing for the same reason. A path that names no file is a plugin's *page* (`/plugins/<id>/focus`), a client-side route, and falls through to the app shell as before. |
| `GET /manifest.webmanifest` (and `/manifest.json`) | optional        | The web app manifest, with a launcher shortcut per enabled plugin.                                                                                                                                                                                           |

A plugin directory is served as static files, and **signing in is all it takes to read one in full**: everything in it that is not a dotfile is reachable, including `src/`, `test/` and lockfiles, not only the `entry` and `styles` a manifest declares. The gate asks the filesystem whether a file is about to be served rather than looking for an extension in the URL, so a `LICENSE` with no extension and a percent-encoded `dist/index%2Ejs` are gated exactly like `dist/index.js`. A **session** is what it takes, not a token: the page fetches a bundle with the cookies it already has, and a personal API token is the one credential that ends up in a phone or a script, so it is refused here exactly as it is for installing. Dotfiles are the exception - a plugin's own `.env` is not served - so that is where anything private belongs. Sign-in is required (a signed-out request is a 401), which keeps a plugin's source and whatever else sits beside its bundle off the open internet, but it does not make the directory private from other accounts. Installing a plugin that keeps secrets is therefore a decision about who else uses the instance, not a boundary that exists.

The bundles themselves are fetched by a signed-in page - a dynamic `import()` and a `<link>` for the stylesheet - so requiring a session turns nothing legitimate away, and the deploy proof checks both directions: refused without a session, served with one.

Per-user plugin state lives in the free-form `ui_settings` JSON column under `plugins`, so a plugin list needs no schema change. Every write merges: enabling a plugin, changing its settings and switching a theme all preserve the other keys in that column, including ones the server does not know about.

A plugin's `enabled` flag is presentation state, never an authorization decision. Plugin code runs in the page with the user's own session, so what a plugin can reach is exactly what that user can reach. Installing a plugin is an operator-level trust decision — the same model as Obsidian community plugins or Home Assistant custom cards — and it is worth saying plainly rather than implying a sandbox that does not exist.

---

## Launcher shortcuts

`shortcuts` in a plugin manifest become entries in the installed app's launcher menu, so a plugin's most useful screen is one tap from the home screen. The server merges them into the manifest it serves: the app's own shortcuts stay first and cannot be displaced, plugin shortcuts are capped at 4 in total, and a plugin's shortcut URL is always `/plugins/<id>/<relative path>`, so a manifest cannot point anywhere the plugin does not own. A plugin that is disabled, or that the host refused, contributes nothing — a shortcut to a page that 404s is worse than no shortcut.

The manifest is generated per user, so the service worker never caches it (neither at install nor at runtime) and it is served `private, no-store` with `Vary: Cookie`. A cached copy would keep a newly enabled plugin's shortcut invisible, and on a shared device it would hand the next user someone else's launcher.

---

## Tests

```sh
npm run backend:test -- tests/unit/modules/plugins tests/integration/plugins.test.js
npm run frontend:test -- frontend/plugins
cd plugins/calm-mode && npm test
```

The backend unit tests cover manifest validation, the version-range matcher, the file-existence check that catches an unbuilt plugin, and the manifest merge. The installer has its own suite, built on a ZIP writer in `backend/tests/helpers/zipFixture.js`, covering archives no archiver would produce: a `..` segment, an absolute path, a symlink, a duplicate name, more entries than the cap, a file past the per-file cap, a decompression bomb, and a top-level wrapper directory. The integration test installs a real plugin directory into a temporary `TUDUDI_PLUGINS_DIR` and drives discovery, enabling, bundle serving, the dotfile rule and the personalized manifest over HTTP — a mocked service would not prove that a directory an operator drops in becomes available. It also uploads real archives over multipart: installing, updating, and the three refusals (not a zip, not an admin, an API token). The frontend tests cover registry namespacing and disposal, and loader rollback when activation fails. The `plugins/calm-mode` tests cover the preference handling that touches a user's notification settings, which is the part where a mistake is not merely cosmetic.
