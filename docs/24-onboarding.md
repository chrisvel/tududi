# Onboarding - Behavior Rules

How an account's first visit works. For technical details see `/backend/modules/onboarding/`, `/frontend/components/Onboarding/` and the admin trends in `/backend/modules/admin/service.js`.

---

## The welcome page

Until an account has been through it, every signed-in page redirects to `/welcome`, a page inside the normal layout (navbar and sidebar stay). Existing accounts see it once too: the column that records the visit starts null for everyone. Life-to-Day (T-506, blueprint 21.5) turned this page into three steps, each with **Skip**, and **Skip setup** at the top records the visit at once:

1. **Language, calendar and digits.** Defaults: Persian, Jalali and Persian digits. Saved to the profile language and `ui_settings.locale`.
2. **One goal for this season.** A `season` goal, optionally under a `vision` goal typed in the same step. With no Areas yet, three suggested Areas (Health, Work, Relationships) are offered; picking one creates it.
3. **Your first day.** Work hours (default 09:00–17:00, saved as the planner's capacity window) and one task, which is put on today's plan and the day is started, so Today opens on the Now card.

The finish (or any skip that ends the flow) records the visit as the `empty` starter. PWA install and notification permission are not part of these steps. Once recorded, `/welcome` redirects to Today. The demo account never sees it. The E2E `ltd-today.spec.ts` walks the three steps to the Now card and asserts under three minutes.

## Empty states

Pages that are empty for a new account offer one-click starters under their usual buttons:

| Page   | Starters                                           |
| ------ | -------------------------------------------------- |
| Areas  | Home, Work, Health, Family (an area with that name) |
| Habits | Morning walk, Read 20 minutes (daily), Weekly review (weekly); the new habit opens so the schedule can be changed |

---

## Data model and API

- `users.onboarding_starter`: set when the welcome page's button is pressed (`empty`; the API also accepts `household`, `work-side`, `studying` and `simple`). Null until then, for existing accounts too, so everyone sees the page once.
- `users.onboarded_at`: when the welcome page was done with. Set together with `onboarding_starter`.
- `tasks.example_of`: the starter key while a task seeded through the API is an untouched example.
- `GET /api/current_user` and `GET /api/profile` include both user columns (`null` until set).
- `POST /api/onboarding/starter` with `{ key: "empty" }` (what the welcome page sends) records the visit; with `{ key, areas, habits, note }` it seeds a starter in one transaction (areas with colour, goal and projects, tasks with relative due dates such as `today`, `tomorrow`, `+3d`, `sat`, `next-week`, habits, a note; same-name areas, projects and habits are reused), sets both columns and returns `{ onboarding_starter, onboarded_at, created: { areas, goals, projects, tasks, habits, notes } }`. Unknown keys and oversized payloads are 400. Hosted plan limits apply to projects, tasks and notes.
- `GET /api/onboarding/examples` returns `{ count }` of untouched, unfinished examples; `DELETE /api/onboarding/examples` removes them and returns `{ removed }`.


## Admin numbers

The admin overview's trends block carries an `onboarding` object:

| Field        | Meaning                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------- |
| `new_users`  | Signups in the last 7 days                                                               |
| `first_plan` | Of those, how many have a day plan with three or more tasks                              |
| `cohort`     | Signups 7 to 14 days ago                                                                 |
| `three_days` | Of those, how many planned on three different days within seven days of signing up       |

Shown on Admin → Overview as **Planned a first day** and **Kept planning**.
