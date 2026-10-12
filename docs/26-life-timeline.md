# Life Timeline

The Life tab (`/life`) shows a person's life on one zoomable line, from weeks to decades, plus their Vision. It is Phase 6 of Life-to-Day (T-601, T-602).

## What is on the line

- **Milestones (layer 1, above the axis).** Life events and goal milestones stored in `ltd_milestones`. Click one to edit it. A milestone linked to a goal shows an "Open goal" link in its editor; a milestone without a goal never opens a goal page.
- **Dated goals (layer 2, below the axis).** Every goal that is not dropped and has a `target_date` or a `period_end`, read from the goals list as it is. Nothing is copied into `ltd_milestones`. Clicking one opens the existing Goal detail page.
- **Today** is the vertical line.

Each layer can be switched off. Zoom with the presets (Weeks, Months, Years, Decades), the − and + buttons, the mouse wheel (around the cursor), pinch, or `+`/`−` on the focused timeline. Drag, a horizontal wheel, or the arrow keys move along the line; `Home` returns to today. The line pans inside its own box, so the page never scrolls sideways.

## Calendars and direction

- Dates are stored as ISO Gregorian days (`YYYY-MM-DD`). The server refuses years before 1600, so a Jalali date such as `1403-07-01` cannot be saved as if it were Gregorian.
- Display follows the user's calendar setting (`frontend/utils/jalali.ts`): in the Jalali calendar the axis ticks sit on Jalali year, month and Saturday boundaries and card dates are Jalali.
- `date_precision` (`day`, `month`, `year`) only changes how the date is shown. The picked day is kept, so a Jalali month never shifts into the Gregorian one.
- The time axis runs left to right by default, also in Persian (assumption A-11). "Time runs right to left" mirrors it and is saved in `ui_settings.appearance.lifeTimelineAxis`.

## Vision

The Vision section lists goals with `horizon = 'vision'`. "Add vision" and "Edit vision" open the existing goal panel with that horizon. There is no separate Vision entity.

## API

All routes are under `/api` and need a signed-in user or an API token.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/milestones?from=YYYY-MM-DD&to=YYYY-MM-DD` | Own milestones, both bounds optional and inclusive, ordered by date |
| POST | `/milestones` | `title`, `date` required; `date_precision`, `kind`, `goal_uid`, `note`, `color` optional. `kind` defaults to `goal_milestone` when a goal is linked |
| PATCH | `/milestones/:uid` | Changes only the fields sent; `goal_uid: null` unlinks |
| DELETE | `/milestones/:uid` | Human users only; returns `journal_uid` for Undo |

`goal_uid` must be one of the caller's own goals. Another user's goal returns 404 and nothing is saved. Every write is recorded in the Journal (`milestone_create`, `milestone_update`, `milestone_delete`) and can be undone with `POST /api/journal/revert`; Undo of a delete restores the row, unlinked if its goal is gone. An API token (MCP) cannot delete a milestone.

## Schema

`ltd_milestones`: `id, uid, user_id (CASCADE), title, date (DATEONLY), date_precision (day|month|year), kind (life_event|goal_milestone), goal_id NULL (SET NULL), note, color, created_at, updated_at`, indexed on `(user_id, date)` and `goal_id`. Migration `20261012100000-create-ltd-milestones.js` uses `safeCreateTable` and is additive on SQLite and PostgreSQL.

## Code

- `frontend/utils/timeline.ts`: `dateToX`, `getTickMarks`, `assignLanes`, `computePinchZoom`, ported unchanged from lifeGLANCE (MIT, commit `cbc01c1`).
- `frontend/components/LifeTimeline/`: the scale (`LifeTimeline.tsx`), Jalali axis labels (`axis.ts`) and the milestone editor (`MilestonePanel.tsx`).
- `backend/modules/ltd-milestones/`: routes and service.

Not built: Chapters, media, recurring milestones, "On this day", PNG export and the dayGLANCE/lifeGLANCE importer (T-603).
