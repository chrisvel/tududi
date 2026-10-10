# Focus - Behavior Rules

How the Focus chip narrows the app to one part of your life. For technical details see `/backend/services/scopeService.js`, `/frontend/utils/focus.ts` and `/frontend/components/Focus/`.

---

## What a Focus is

A Focus is an area, optionally one project inside it, and optionally a set of tags. It is picked once from the chip at the left of the top bar and stays until it is cleared, on every device, because it is saved with the account (`ui_settings.focus`).

While a Focus is set:

- **Today and the planner** suggest only tasks in the Focus. Tasks already placed in the day's plan are never removed; the ones outside the Focus are dimmed.
- **Upcoming** and **Tasks** show only tasks in the Focus, including the projects due in the week on Upcoming.
- **Projects** is locked to the Focus area (the area filter shows the area instead of a dropdown) and narrowed to the Focus project and tags.
- **Notes** shows the notes of projects in the Focus, narrowed by tags.
- **Universal search** (the live search box) only finds items in the Focus area or project. Saved Views keep their own criteria and are not scoped.
- **New tasks** from the capture box get the Focus project and tags when the text names none. A `+project` or `#tag` typed in the text wins; Focus tags are added to the text's tags. Converting an inbox item to a task works the same way.
- **New notes** from the capture box or the Notes page get the Focus project.
- **New projects** from the capture box or the New project panel start in the Focus area.

Everything else is unscoped: the Calendar, Kanban and Eisenhower boards, the Inbox list, tag and area detail pages, Habits, the REST API, MCP and Telegram.

## Picking and clearing

The chip reads **Focus** when none is set, and the scope otherwise, as `Area › Project · #tag`. On phones only the icon shows, with a dot while a Focus is set. Clicking it opens a small panel with the area, the projects of that area, and tags; **Apply** saves, **Clear** removes it. On wider screens an × next to the chip clears it in one click.

An empty list while a Focus is set says "Showing Work only" with a link to clear it, so an empty page is not mistaken for an empty account.

## When things move

- A Focus that names a deleted area or project, or a project moved out of the Focus area, is dropped the next time the app loads its areas and projects.
- Until then, or for API callers sending stale uids, the lists come back empty rather than failing.
- Shared projects count as in the Focus area by your own placement of them (the area you gave the project on the Projects page), the same rule the Projects page uses.

---

## Scope parameters (API)

The client sends the Focus as plain query params on each list request; the server never applies a saved Focus on its own. API tokens, MCP and Telegram therefore see unscoped lists unless they pass the params themselves.

| Param         | Meaning                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `area_uid`    | Items in the area: tasks carrying the area directly or through their project, projects in the area (with per-user placement of shared projects), notes of those projects |
| `project_uid` | Items of the project. With `area_uid`, the project must sit in that area or nothing matches                                                                              |
| `tags`        | Comma-separated tag names; an item must carry every one. An unknown tag matches nothing                                                                                  |

Endpoints that accept them:

| Endpoint                         | Notes                                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/tasks`                 | All `type`s, the Today lists (`include_lists=true`) and the `projects` block of `type=upcoming`                                               |
| `GET /api/daily-plan`            | Items are kept; each gets `in_focus: true                                                                                                     | false` when scope params are sent |
| `GET /api/daily-plan/candidates` | Every group is scoped                                                                                                                         |
| `GET /api/notes`                 | `area_uid` means notes of projects in the area                                                                                                |
| `GET /api/projects`              | `area_uid` is the same as the existing `area`                                                                                                 |
| `GET /api/search`                | `area_uid` and `project_uid` (tags were already a search filter)                                                                              |
| `PUT /api/profile/ui-settings`   | Body `{ focus: { area_uid, project_uid?, tags? } }` saves the chip's Focus; `{ focus: null }` clears it. Up to ten tags; uids are not checked |

A scope naming something the user cannot see matches nothing. The tasks endpoint's `area_uid` now includes tasks inherited through a project in the area; the Area detail page relies on this.
