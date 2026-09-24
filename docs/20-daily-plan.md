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
- **Not planned:** the tasks the classic page would show (overdue, due today, in progress, suggested) that are not in the plan. **Add to today** appends one without a time.
- **Replan** reopens the planner. Starting the day again keeps the first start time.
- The sidebar shows `done/total` next to Today once the day is started.

---

## Planner (`/today/plan`)

- **Left column:** a short list, "What could you do today?": five candidates at a time in order of importance (overdue, due today, in progress, suggested), each shown as its name and one grey line. **Show 5 more** adds five, and **Browse** opens the per-group filters and the inbox. Tasks already planned leave the list. Hovering or focusing a row (always on touch screens) shows its 15m / 30m / 1h / 2h chips and, for overdue tasks, **Tomorrow**, **Next week** (moves the due date) and **Drop** (cancels the task).
- **Adding:** **+** places the task in the first free slot after now that fits its length, avoiding planned tasks and busy meetings. If nothing fits it is added without a time. Dragging a card onto the timeline places it where it is dropped. The chosen length is saved as the task's estimate.
- **Timeline:** 08:00 to 18:00, widened to whole hours around anything planned or on the calendar outside that range, in 15-minute steps. Blocks can be dragged and resized; overlapping tasks are refused. Meetings are grey, events marked "free" are dashed, and gaps of 30 minutes or more are labelled.
- **List mode:** an ordered list without a timeline, reorderable by drag or keyboard, with an optional start time per row. Screens narrower than 768px always use list mode.
- **Capacity:** "Xh planned of Yh free" as plain text, where free time is the visible range minus busy meetings. It turns red, with a bar, only when overbooked.
- **Calm by default:** only **Draft with AI** and **Done** are buttons; the timeline/list switch and leaving without starting live in the ⋯ menu. Meetings are faint outlines, the timeline opens scrolled to now, and tips show one at a time.
- Every change saves itself half a second after the last edit. **Start my day** saves, marks the plan started and returns to Today. **Cancel** keeps the plan as a draft.
- Inbox items can be turned into tasks and added in one click.

---

## Task estimates

Tasks have an optional `estimated_minutes` (5 to 720), set from the **Estimate** card on the task page or when a task is added to a plan. It is the default block length; each day's block can differ from it.

---

## Calendar feeds

Profile → **Calendars** connects read-only iCal feeds, such as Google Calendar's "Secret address in iCal format". Apple Calendar, Outlook and Fastmail links work too, and `webcal://` links are accepted.

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
| `calendar_feeds` | Name, color, encrypted URL, host, last fetch time and last error |

Plans and feeds are not included in backups: plans are short-lived, and feed addresses are encrypted with this server's key.

---

## API

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/daily-plan?date=` | The plan, or `null`. The date defaults to today in the user's timezone |
| GET | `/api/daily-plan/candidates` | `{ overdue, due_today, in_progress, suggested, inbox, inbox_count }`, each task in one group only |
| PUT | `/api/daily-plan/:date` | Replaces all items: `{ items: [{ task_uid, start_minute, duration_minutes }] }`, in order. Rejects overlaps, slots past midnight, duplicates and tasks the user cannot see |
| POST | `/api/daily-plan/:date/start` | Marks the day started |
| POST | `/api/daily-plan/:date/carry-over` | Appends `{ task_uids }` to that day's plan without a time, skipping tasks already there |
| DELETE | `/api/daily-plan/:date` | Clears the plan. `:date` may be `today` |
| GET/POST/PATCH/DELETE | `/api/calendar-feeds[/:uid]` | Manage feeds. POST fetches the feed once and refuses it if it cannot be read |
| GET | `/api/calendar-feeds/events?date=` | `{ date, events, errors }` for that day |

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
