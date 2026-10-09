# Onboarding - Behavior Rules

How an account's first visit works. For technical details see `/backend/modules/onboarding/`, `/frontend/components/Onboarding/` and the admin trends in `/backend/modules/admin/service.js`.

---

## The welcome page

Until an account has been through it, every signed-in page redirects to `/welcome`, a page inside the normal layout (navbar and sidebar stay). Existing accounts see it once too: the column that records the visit starts null for everyone. The page is the welcome video (YouTube, `youtube-nocookie.com`, id in `WELCOME_VIDEO_ID` in `Welcome.tsx`; the CSP's `frame-src` allows that host) centred on the page with one button, **I'm done, let's start**. The button records the visit as the `empty` starter and opens Today. Once recorded, `/welcome` redirects to Today. The demo account never sees it.

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
