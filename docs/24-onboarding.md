# Onboarding - Behavior Rules

How a new account's first visit works. For technical details see `/backend/modules/onboarding/`, `/frontend/components/Onboarding/` and the admin trends in `/backend/modules/admin/service.js`.

---

## The welcome modal

A new account's first visit to `/` or `/today` opens a modal over Today, with the app blurred behind it. Any other path (a shared note, an invitation, the inbox) opens as usual, and the modal waits for the next visit to Today.

- **One box, one line per thing.** Enter adds the line to a list under the box. Tags (`#home`), projects (`+Kitchen`) and dates ("tomorrow", "next Tuesday") parse exactly as in the Add box, and show as chips on the line. Three prompts under the list tick off as lines are added: something from work, something at home, the thing you keep putting off.
- **Plan my day** turns every line into a task. Tags are created as needed, a `+project` becomes a planned project, a parsed date becomes the due date. Lines with a date on another day stay off today's plan; every other line is added to it without a time, after whatever is already planned. The plan is started, the modal closes and Today reloads with the first line in the **Now** card.
- **Skip for now**, the close button, Escape or a click outside all record the modal as seen and leave the app as it is. It does not open on its own again.
- The demo account never sees it.
- **Brain dump** in the navbar menu (under the avatar) opens the same modal any time, on any page, headed "Brain dump" instead of "Welcome", with **Close** in place of Skip. Planning from it adds to today's plan and goes to Today.

On an error the lines stay; tasks already created keep their uid so a retry does not create them twice.

---

## Empty states

Pages that are empty for a new account offer one-click starters under their usual buttons:

| Page   | Starters                                           |
| ------ | -------------------------------------------------- |
| Areas  | Home, Work, Health, Family (an area with that name) |
| Habits | Morning walk, Read 20 minutes (daily), Weekly review (weekly); the new habit opens so the schedule can be changed |

---

## Data model and API

- `users.onboarded_at`: when the welcome modal was finished or dismissed. It is null for accounts that existed before the column was added too, so everyone sees the screen once on their next visit to Today.
- `GET /api/current_user` and `GET /api/profile` include `onboarded_at` (`null` until set).
- `POST /api/onboarding/complete` sets it and returns `{ onboarded_at }`. Later calls return the first time.
- The modal's open state lives in `frontend/utils/brainDumpUi.ts`; after planning it fires a `dailyPlanChanged` window event, which Today listens for.

## Admin numbers

The admin overview's trends block carries an `onboarding` object:

| Field        | Meaning                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------- |
| `new_users`  | Signups in the last 7 days                                                               |
| `first_plan` | Of those, how many have a day plan with three or more tasks                              |
| `cohort`     | Signups 7 to 14 days ago                                                                 |
| `three_days` | Of those, how many planned on three different days within seven days of signing up       |

Shown on Admin → Overview as **Planned a first day** and **Kept planning**.
