# Daily Plan - Behavior Rules

This document explains how the Today page, the "Plan my day" planner and calendar feeds work. For technical details see `/backend/modules/daily-plan/`, `/backend/modules/calendar-feeds/` and `/frontend/components/DailyPlan/`.

---

## Overview

Today has two modes:

1. **Planning** (`/today/plan`): a full-screen planner. Pick tasks, give each a rough length and place them in free time around your meetings.
2. **Doing** (`/today`): only what you committed to, in order, with the current block on top.

The classic Today page (Overdue, Planned, Suggested, Completed sections, metrics and the AI brief) is still available at `/today_legacy`. Its rules are in [Today Page Sections](02-today-page-sections.md).

---

## Today (`/today`)

| State | What you see |
|-------|--------------|
| No plan, or a plan that was never started | A card with overdue, due today and inbox counts, free hours, today's meetings, **Plan your day** (or **Continue planning** for a draft) and a link to the classic page |
| Plan started | The header shows done/total and time left, then the **Now** card, the agenda (tasks and meetings in time order) and a collapsed **Not planned** list |

- **Now card:** the block running right now; otherwise the next planned block; otherwise the first unfinished task without a time. **Mark done** completes the task. **Push to later** removes the time slot and moves the task to the end of the list.
- **Reordering:** drag an **Anytime** task to move it among the other Anytime tasks; the new order is saved as the plan's item order. Timed tasks stay in time order.
- **Not planned:** the tasks the classic page would show (overdue, due today, in progress, suggested) that are not in the plan. **Add to today** appends one without a time.
- **Replan** reopens the planner. Starting the day again keeps the first start time.
- The sidebar shows `done/total` next to Today once the day is started.

---

## Planner (`/today/plan`)

- **Left column:** a short list, "What could you do today?": five candidates at a time in a fixed order (see **Candidate order** below), each shown as its name and one grey line. The name opens the task. **Show 5 more** adds five, and **Browse** opens the per-group filters and the inbox. Tasks already planned leave the list. Resting the pointer on a row for a moment, or focusing it (always on touch screens), opens its 15m / 30m / 1h / 2h chips and, for overdue tasks, **Tomorrow**, **Next week** (moves the due date) and **Drop** (cancels the task). The short delay keeps rows from opening and closing while the mouse passes over them.
- Task names on the timeline and in the list view also open the task.

### Candidate order

The order comes from `backend/modules/daily-plan/ranking.js` and each user sets it in **Profile > Planning**.

1. Every candidate falls in one of eight buckets: its group (overdue, including started tasks past their due date; due today; in progress; everything else) split into tasks in a project and tasks without one.
2. Buckets follow the user's order (drag or the arrow buttons; saved at once). The default is each group in turn, project tasks first.
3. Inside a bucket: higher priority first, then the earlier due date, then the older task.

The order is stored in `users.ui_settings.planning.candidateOrder`. A saved order that is missing buckets or has unknown ones is repaired on read, and the profile form's own save keeps the stored order.

## Task estimates

Tasks have an optional `estimated_minutes` (5 to 720), set from the **Estimate** card on the task page or when a task is added to a plan. It is the default block length; each day's block can differ from it.

---

## Calendar feeds

Profile → **Calendars**, or the **Calendars** button on the Calendar page, connects read-only iCal feeds, such as Google Calendar's "Secret address in iCal format". Apple Calendar, Outlook and Fastmail links work too, and `webcal://` links are accepted.

- **Calendar page:** each connected calendar is a chip above the month, week and day views. Click a chip to show or hide that calendar's events; the choice is saved per calendar (`show_on_calendar`, on by default). Hiding a calendar only affects the Calendar page: its meetings still block time on Today and the planner.

- Tududi never writes to these calendars.
- The address is a secret: it is stored encrypted (needs `TUDUDI_SESSION_SECRET` or `TUDUDI_OIDC_SECRET_ENCRYPTION_KEY`) and the API only returns its host.
- The server fetches the feed through the SSRF guard (public hosts only, every redirect checked), with a 10 second timeout and a 5 MB limit, and caches it for 15 minutes per process.
- Recurring events (RRULE, RDATE, EXDATE, moved instances), time zones, all-day events and events crossing midnight are expanded in the user's timezone. Cancelled events are dropped.
- If a feed stops working, Today keeps the last good copy when one is cached, and the error shows on the Calendars tab.

---

## Data model

| Table | Purpose |
|-------|---------|
| `daily_plans` | One row per user per local date (`plan_date`), with `started_at` set by **Start my day** |
| `daily_plan_items` | The tasks in a plan: `position`, `start_minute` (minutes after local midnight, null for untimed) and `duration_minutes` |
| `daily_plans.ai_wrap_up` | The stored AI wrap-up for that day (JSON, optional) |
| `calendar_feeds` | Name, color, encrypted URL, host, last fetch time and last error, and `show_on_calendar` |

Plans and feeds are not included in backups: plans are short-lived, and feed addresses are encrypted with this server's key.

---

## API

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/daily-plan?date=` | The plan, or `null`. The date defaults to today in the user's timezone |
| GET | `/api/daily-plan/candidates` | `{ overdue, due_today, in_progress, suggested, inbox, inbox_count, ranked }`, each task in one group only; `ranked` lists task uids in the user's order |
| GET | `/api/daily-plan/ranking` | `{ order, default_order }`, the eight bucket keys such as `overdue:project` |
| PUT | `/api/daily-plan/ranking` | Body `{ order }` with every bucket key once; 400 otherwise |
| PUT | `/api/daily-plan/:date` | Replaces all items: `{ items: [{ task_uid, start_minute, duration_minutes }] }`, in order. Rejects overlaps, slots past midnight, duplicates and tasks the user cannot see |
| POST | `/api/daily-plan/:date/start` | Marks the day started |
| POST | `/api/daily-plan/:date/carry-over` | Appends `{ task_uids }` to that day's plan without a time, skipping tasks already there |
| DELETE | `/api/daily-plan/:date` | Clears the plan. `:date` may be `today` |
| GET/POST/PATCH/DELETE | `/api/calendar-feeds[/:uid]` | Manage feeds. POST fetches the feed once and refuses it if it cannot be read. PATCH also takes `show_on_calendar` |
| GET | `/api/calendar-feeds/events?date=` | `{ date, events, errors }` for that day |
| GET | `/api/calendar-feeds/events?start=&end=` | `{ start, end, events, errors }` for up to 62 days; each event carries its `date`, and a multi-day event appears once per day. Hidden calendars are included, the Calendar page filters them |

---

## AI help

Everything in this section appears only while the **AI assistant** is switched on for the user (Profile → Features), the same switch as the Daily Brief. With it off the planner and Today look exactly as described above, and the AI endpoints return `403`.

- **Planning tips** (planner and Today): worked out locally, no model call, at most three at a time.
  - Missed blocks: offers **Move to next free slots**.
  - Overbooking: "Planned 3h 30m, only 1h 25m free: 2h 5m over".
  - A free gap that fits an unplanned task: offers **Place it**.
  - No break for three hours or more.
  - Today shows only the missed-block and gap tips.
- **Draft with AI** (planner header):
  - On an empty plan it drafts straight away; otherwise it offers **Fill free time** (keeps what is planned) or **Start over**.
  - The server gives the model the candidates (up to 60), busy meetings, free gaps, the current time and the user's "About you".
  - The server then cleans up the answer (`sanitizeDraft` in `backend/modules/daily-plan/ai.js`): only known tasks, 15-minute grid, never in the past or on top of a meeting or another block. A clash moves to the next free slot, or loses its time.
  - The draft is applied locally, so it autosaves like any edit. **Undo** restores the previous plan. Drafted blocks show a sparkle, with the AI's reason as a tooltip.
- **Length guesses:** when the planner opens, one request estimates up to 40 candidates without an estimate. The guess is pre-selected on the card's chips (marked with a dot) and saved as the task's estimate only when the task is added. Guesses are cached per server process for 24 hours.
- **Day wrap-up** (Today):
  - Offered once the last timed block has ended, or when everything is done.
  - Returns a short summary, wins, a pattern and the unfinished tasks worth carrying over.
  - **Add to tomorrow** appends the selected ones, untimed, to the next day's plan (`POST /api/daily-plan/:date/carry-over`).
  - Stored in `daily_plans.ai_wrap_up`, so it is not regenerated on every visit.

Each draft, estimate batch or wrap-up counts as one AI request, and one AI credit in hosted mode. See [AI Assistant](13-ai-assistant.md).

## Known limitations

- Two open planners for the same day overwrite each other; the last save wins.
- Unfinished tasks are not carried over to the next day's plan.
- There are no MCP tools for the plan yet.
