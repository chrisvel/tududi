# Onboarding - Behavior Rules

How a new account's first visit works. For technical details see `/backend/modules/onboarding/`, `/frontend/components/Onboarding/` and the admin trends in `/backend/modules/admin/service.js`.

---

## The welcome page

Until an account has been through it, every signed-in page redirects to `/welcome`, a page inside the normal layout (navbar and sidebar stay). Existing accounts see it once too: the column that records the visit starts null for everyone. The page is the welcome video (YouTube, `youtube-nocookie.com`, id in `WELCOME_VIDEO_ID` in `Welcome.tsx`; the CSP's `frame-src` allows that host) centred on the page with one button, **I'm done, let's start**. The button records the visit as the `empty` starter, opens Today and the brain dump. Once recorded, `/welcome` redirects to Today. The demo account never sees it.

## The brain dump

The brain dump modal no longer opens on its own. The welcome page's button and **Brain dump** in the navbar menu (under the avatar) open it on any page, headed "Brain dump" (or "Welcome to tududi" while `onboarded_at` is still null).

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

- `users.onboarding_starter`: set when the welcome page's button is pressed (`empty`; the API also accepts `household`, `work-side`, `studying` and `simple`). Null until then, for existing accounts too, so everyone sees the page once.
- `users.onboarded_at`: when the welcome was finished or dismissed. Set by the welcome page and by the brain dump's first completion.
- `tasks.example_of`: the starter key while a task seeded through the API is an untouched example.
- `GET /api/current_user` and `GET /api/profile` include both user columns (`null` until set).
- `POST /api/onboarding/starter` with `{ key: "empty" }` (what the welcome page sends) records the visit; with `{ key, areas, habits, note }` it seeds a starter in one transaction (areas with colour, goal and projects, tasks with relative due dates such as `today`, `tomorrow`, `+3d`, `sat`, `next-week`, habits, a note; same-name areas, projects and habits are reused), sets both columns and returns `{ onboarding_starter, onboarded_at, created: { areas, goals, projects, tasks, habits, notes } }`. Unknown keys and oversized payloads are 400. Hosted plan limits apply to projects, tasks and notes.
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
