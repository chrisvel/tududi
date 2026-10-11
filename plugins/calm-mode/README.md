# Calm Mode

A neurodivergent-friendly plugin for [Tududi](https://github.com/chrisvel/tududi).

It is opt-in by design: it changes nothing until someone installs it on their
server **and** enables it on their own account. Nothing here is a fork — the
same tasks, projects, areas and notes are underneath, and switching Calm Mode
off puts everything back.

## What it does

| | |
|---|---|
| **Stillness** | Turns motion off whether or not the device reports a reduced-motion preference. Someone who needs stillness should not have to find a second setting. |
| **Reading rhythm** | Increases line spacing and letter spacing, which reaches text the plugin never renders. |
| **Softer urgency** | Mutes the red and amber families that read as alarm. The information stays; it stops shouting. |
| **Visible focus** | A thick, offset focus ring, for keyboard and switch users. |
| **One thing** | A page that shows the single next item from the plan you already committed to. No counts, no deadlines, no overdue wording. |
| **Show less navigation** | Keeps Today, Inbox and Upcoming. Everything else stays exactly where it is and stays reachable. Favourites are deliberately kept: your own shortlist is already the reduction you chose. |
| **Quieten reminders** | Turns push off for reminders about things becoming due or overdue. Assigned tasks and replies still reach you, and in-app notifications are untouched, so nothing is lost. Reversible. |

## Install

A plugin is a directory under the server's plugins root (`plugins/` in the repo,
or wherever `TUDUDI_PLUGINS_DIR` points):

```
plugins/calm-mode/
  plugin.json
  dist/index.js
  dist/index.css
```

```sh
npm install
npm run build
# then copy this directory into <your tududi install>/plugins/calm-mode
```

Restart the server, open **Profile → Plugins**, and enable it. Then open the
**Calm Mode** panel that appears under it and turn the mode on.

## Why it is built this way

**It never bundles React.** JSX compiles to `React.createElement` against the
React instance the host passes to `activate()`. Two React copies in one renderer
breaks hooks, which is the usual way an in-page plugin fails. The consequence is
that the plugin cannot `import { useState } from 'react'` either — components
read the hooks off `api.React`:

```tsx
const React = getReact();
const { useState, useEffect } = React;
```

**What a root class can reach, and what it cannot.** Stillness, spacing, focus
visibility and the alarm colours are all reachable from one class on `<html>`,
so they are global. A rebuilt palette is not: components write their colours as
Tailwind utilities, and the plugin overrides the urgency-bearing ones rather
than pretending to be a theming layer.

**Notification changes are reversible or they do not happen.** Quietening edits
an account's own notification preferences, so the previous push flags are
captured first (`src/preferences.ts`) and restored exactly on the way out. That
module is pure and directly tested:

```sh
npm test
```

## Trust

Plugin code runs in the page with the signed-in user's session. This plugin
reads your daily plan, creates and completes tasks, and can change your
notification preferences when you ask it to. That is the same trust model as
Obsidian community plugins or Home Assistant custom cards: the person running
the server decides what to install. Nothing is sandboxed, and the plugin says so
rather than implying otherwise.

## Compatibility

`pluginApi: 1`. The host refuses to import a plugin built for a different API
major rather than running it against an API it does not have.

`host: ">=1.9 <2"`. Verified against Tududi v1.9.1.
