# Task Effect and Life Lessons

Each task linked to a goal says which five-year path or Vision it sits on, where the outcome of that path stands, and at most one life lesson that should shape it. This is Phase 11 of Life-to-Day (T-1101 to T-1104, blueprint 14.7, ADR-014).

## Task effect

`taskEffect(task, snapshot, { lessons, today })` in `backend/modules/ltd-progress/effect.js` is a pure function. It reads the existing whyChain and outcome `O` from the projection and stores nothing.

| Field | Rule |
| --- | --- |
| `chain` | The whyChain from the task's goal (or its project's goal) to the root, each node with `uid`, `title`, `horizon`, `why` |
| `fiveYear` / `vision` | The first chain node with that horizon, else `null` |
| `meaning` | `why` of the five-year goal, else of the vision, else of the nearest goal; `null` when none has text |
| `outcome` | The nearest goal upwards whose `O` is not null: `{ goal_uid, title, horizon, value }` |
| `activity` | Whether finishing the task moves `A` of that goal (the task is in `W`, or is a habit of a goal with a period). Without an outcome, the nearest goal is used |
| `lesson` | At most one lesson (below), else `null` |
| `kind` | `linked` when the chain is not empty, else `unlinked` |

Finishing a task can move `A`; `O` only moves with a metric check-in. The UI says this in two sentences and never shows a percent of a task's own effect.

### Which lesson a task shows

1. Only `active` lessons of the same user.
2. Each lesson scores its best link: the task's own goal (or its project's goal) 4, another goal of the chain 3, the task's project 2, the task's area or its project's area 1, a tag of the task 1.
3. Ties: a lesson due for review (`review_on` today or earlier) first, then the most recently updated.
4. A lesson with no matching link, or no link at all, never appears on a task. It stays in the Life list.

## Where it shows

- **Now card:** one path line and, when a lesson matches, one line with its if/then (or its title). "More about this path" opens the outcome sentence and the "why".
- **Focus:** the same two lines.
- **Task page:** the "Long path" card with the path, the chain, the outcome sentence, the "why" and the lesson.
- **Goal page:** the lessons linked to that goal, with the form.
- **Life tab:** the lesson list under Vision, and a "Lessons" layer on the axis (off by default, saved in `ui_settings.appearance.lifeLessonsOnAxis`).
- **Today:** at most one review question a day, the active lesson whose `review_on` came first. After an answer there is no second question that day. When the day is over, the day review offers "Write a lesson".

## Lessons

The form has four boxes: what I expected, what happened, if, then. Only the title is required. `if_text` and `then_text` are both set or both empty (otherwise 400). `learned_on` defaults to today and `review_on` to `learned_on` + 14 days; `review_on` may be saved empty. Days are ISO Gregorian, and years before 1600 are refused, so a Jalali date cannot pass as Gregorian.

A fourth active lesson linked to the same goal is saved, and the response carries `warning: "three_is_enough"`.

Review answers:

| Verdict | Effect |
| --- | --- |
| `holds` | A check; `review_on` = that day + 14 |
| `not_yet` | A check; `review_on` = that day + 7 |
| `park` | A check; `status = parked`, `review_on = null` |

Every write, a review included, is a Journal entry (`lesson_create`, `lesson_update`, `lesson_check`, `lesson_delete`) and can be undone with `POST /api/journal/revert`. Undo of a delete restores the lesson with its links and checks. Only a signed-in human deletes; an API token or MCP gets 403.

## API

All routes are under `/api`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/lessons/effect?task_uid=` | The task effect of an own task |
| GET | `/lessons?status=&goal_uid=` | Own lessons; `status` is `active`, `parked`, `retired` or `all` (default) |
| POST | `/lessons` | `title` required; `expected`, `happened`, `if_text`, `then_text`, `learned_on`, `review_on`, `source_type`, `source_uid`, `links: [{ type: goal\|project\|area\|tag, uid }]`. Accepts a client `uid` and `Idempotency-Key` |
| PATCH | `/lessons/:uid` | Changes only the fields sent; `links` replaces the links; `status` may change |
| DELETE | `/lessons/:uid` | Human session only; returns `journal_uid` |
| POST | `/lessons/:uid/checks` | `verdict`, optional `note` and `date` |
| GET | `/lessons/due?date=` | The one review question of that day, or `null` |

A goal, project, area, tag or task of another user returns 404 and nothing is saved.

## MCP

`get_task_effect`, `list_lessons` and `get_lesson` are R0 reads. `create_lesson` and `update_lesson` are R2: they create a Proposal and nothing is written until the user applies it in the app. There is no delete tool.

## Schema

Migration `20261016000001-ltd-lessons.js` (`safeCreateTable`, additive, `down` refuses):

- `ltd_lessons`: `id, uid, user_id (CASCADE), title, expected, happened, if_text, then_text, learned_on (DATEONLY), source_type (free|milestone|task|goal) NULL, source_uid NULL, status (active|parked|retired), review_on NULL, created_at, updated_at`
- `ltd_lesson_links`: `id, lesson_id (CASCADE), target_type (goal|project|area|tag), target_id`, unique on `(lesson_id, target_type, target_id)`
- `ltd_lesson_checks`: `id, uid, lesson_id (CASCADE), checked_on, verdict (holds|not_yet|park), note, created_at`

## Code

- `backend/modules/ltd-progress/effect.js`: `taskEffect`.
- `backend/modules/ltd-lessons/`: routes, service, repository (with Journal Undo) and the MCP capabilities.
- `frontend/utils/lessonsService.ts`, `frontend/components/Lessons/`.
