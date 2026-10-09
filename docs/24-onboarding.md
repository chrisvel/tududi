# Onboarding - Behavior Rules

How a new account's first visit works. For technical details see `/backend/modules/onboarding/`, `/frontend/components/Onboarding/` and the admin trends in `/backend/modules/admin/service.js`.

---

## The welcome screen: pick a starter

Every account's first visit to `/` or `/today` opens a full-screen starter picker over Today. Existing accounts see it once too (the column that records the choice starts null for everyone). Any other path (a shared note, an invitation, the inbox) opens as usual, and the screen waits for the next visit to Today.

- **Four starters, one tap.** Running a household, Work and a side project, Studying, and Just me. The first is selected on load; the primary button names the chosen one ("Set up Running a household"). Cards are a radio group: arrow keys move, Enter confirms. A preview beside the cards shows the areas, their goal line and project, the habits, the tasks due today and the note. On phones the selected card shows a compact summary instead.
- **The welcome video** (YouTube, `youtube-nocookie.com`, id in `WELCOME_VIDEO_ID` in `StarterPicker.tsx`) plays beside the cards. The CSP's `frame-src` allows that host.
- **What a starter creates:** areas with a colour, at most one goal and one project per area (the project links to the goal and starts in progress), a few tasks with relative due dates and tags, one or two habits, and a note "How this is set up". The copy lives in `onboarding.starter.*` in the translation files and the shape in `frontend/utils/starters.ts`; the frontend sends the resolved structure and the server bounds it (6 areas, 8 projects, 15 tasks, 4 habits).
- **Dates are relative** (`today`, `tomorrow`, `+3d`, `sat`, `next-week`) and resolve in the user's timezone on the day the starter is applied, never in the past.
- **Not only for empty accounts.** An area, project or habit with the same name (case-insensitive) is reused rather than duplicated, and a note with the same title is not created twice. Tasks are always created.
- **Examples.** Seeded tasks carry the starter key in `tasks.example_of`. The first edit through `PATCH /api/task/:uid` clears it, so a changed example is the person's own. Completed examples are left alone too.
- **Just me** creates one habit (Morning walk) and opens the brain dump. **Start empty** records `empty`, creates nothing and opens the brain dump, the welcome as it was before. Any other starter reloads Today so every list and the sidebar pick the new records up.
- The demo account never sees it (`onboarding_starter` is set to `empty` when it is prepared).

## The first week on Today

While the account is within seven days of the welcome and picked a starter with content, Today (before the day is started) shows:

- a line "N of your tasks are examples from the starter" with **Remove examples**, which deletes the untouched, unfinished examples and reloads the day; it goes away once no examples are left;
- a card **Add the rest of your week** that opens the brain dump.

## The brain dump

The brain dump modal no longer opens on its own. **Brain dump** in the navbar menu (under the avatar), the card above and the Just me and Start empty paths open it on any page, headed "Brain dump" (or "Welcome to tududi" while `onboarded_at` is still null).

- **One box, one line per thing.** Enter adds the line to a list under the box. Tags (`#home`), projects (`+Kitchen`) and dates ("tomorrow", "next Tuesday") parse exactly as in the Add box, and show as chips on the line. Three prompts under the list tick off as lines are added: something from work, something at home, the thing you keep putting off.
- **Plan my day** turns every line into a task. Tags are created as needed, a `+project` becomes a planned project, a parsed date becomes the due date. Lines with a date on another day stay off today's plan; every other line is added to it without a time, after whatever is already planned. The modal closes and the planner (`/today/plan`) opens with those tasks in the plan, ready to be given times and started. Opened from the planner itself, the modal hands the tasks to it directly, the way the Add box does.
- **Skip for now** / **Close**, the close button, Escape or a click outside all close it. On an error the lines stay; tasks already created keep their uid so a retry does not create them twice.

---

## Empty states

Pages that are empty for a new account offer one-click starters under their usual buttons:

| Page   | Starters                                           |
| ------ | -------------------------------------------------- |
| Areas  | Home, Work, Health, Family (an area with that name) |
| Habits | Morning walk, Read 20 minutes (daily), Weekly review (weekly); the new habit opens so the schedule can be changed |

---

## Data model and API

- `users.onboarding_starter`: the starter picked on the welcome screen (`household`, `work-side`, `studying`, `simple` or `empty`). Null until then, for existing accounts too, so everyone sees the screen once.
- `users.onboarded_at`: when the welcome was finished or dismissed. Set by the starter picker and by the brain dump's first completion.
- `tasks.example_of`: the starter key while a seeded task is an untouched example.
- `GET /api/current_user` and `GET /api/profile` include both user columns (`null` until set).
- `POST /api/onboarding/starter` with `{ key, areas, habits, note }` (or just `{ key: "empty" }`) seeds the starter in one transaction, sets both columns and returns `{ onboarding_starter, onboarded_at, created: { areas, goals, projects, tasks, habits, notes } }`. Unknown keys and oversized payloads are 400. Hosted plan limits apply to projects, tasks and notes.
- `GET /api/onboarding/examples` returns `{ count }` of untouched, unfinished examples; `DELETE /api/onboarding/examples` removes them and returns `{ removed }`.
- `POST /api/onboarding/complete` sets `onboarded_at` and returns `{ onboarded_at }`. Later calls return the first time.
- The brain dump's open state lives in `frontend/utils/brainDumpUi.ts`.

## Admin numbers

The admin overview's trends block carries an `onboarding` object:

| Field        | Meaning                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------- |
| `new_users`  | Signups in the last 7 days                                                               |
| `first_plan` | Of those, how many have a day plan with three or more tasks                              |
| `cohort`     | Signups 7 to 14 days ago                                                                 |
| `three_days` | Of those, how many planned on three different days within seven days of signing up       |

Shown on Admin → Overview as **Planned a first day** and **Kept planning**.
