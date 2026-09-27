# Habits

Habits are tasks with `habit_mode = true`. They live on the Habits page (`/habits`) and each has a detail page (`/habit/:uid`). A habit is not a recurring task: it never creates new task rows, it collects check-ins.

## Types

- **Build** habits are things to do: "Read 20 pages", "Meditate 3× a week".
- **Quit** habits are things to avoid: "No sugar". Every day without a slip counts. Logging a completion on a quit habit records a slip. Quit habits cannot skip days.

## Goals and frequency

| Setting | Field | Notes |
|---|---|---|
| Count | `habit_target_count` | Check-ins needed per period |
| Amount | `habit_target_value` + `habit_unit` | Makes the habit measurable; check-ins carry a `value` and the period is met when the values add up to the target |
| Frequency | `habit_frequency_period` | `daily`, `weekly`, `monthly` or `interval` |
| Days | `habit_schedule_days` | Daily habits only, weekdays 0 (Sunday) to 6. `null` means every day. Unscheduled days never break a streak |
| Interval | `habit_interval_days` | For `interval`: periods of N days, anchored on the day the habit was created |
| Time of day | `habit_time_of_day` | `morning`, `afternoon`, `evening` or `null` (anytime). Groups cards on the Habits page |
| Reminder | `habit_reminder_time` | `HH:MM` in the user's timezone |
| Color | `habit_color` | A hex value from the shared palette; `null` uses the default green. Cards, progress, the history grid and buttons take this color |

Weekly and monthly periods follow the user's first day of week and calendar months.

### Check-ins per day

A simple daily habit takes one check-in per day. Several check-ins per day are allowed when the habit is measurable, or daily with a count above 1 (capped at the count). Weekly and monthly count habits take one check-in per day, so "3× a week" means three different days.

## Check-ins, notes and skips

Check-ins are rows in `recurring_completions` (shared with recurring tasks) with optional `value` and `note` columns. A row with `skipped = true` is a skipped day: the period is neutral, neither a success nor a miss. Checking in on a skipped day replaces the skip. Past days can be checked in, skipped or edited from the day panel under the history grid.

## Streaks and strength

`backend/modules/habits/habitEngine.js` is the single source of truth. It works on day keys (`YYYY-MM-DD`) in the user's timezone and walks every period from the habit's first day (its creation day, or an earlier back-filled check-in) up to the current period:

- **success:** the goal was met (quit habits: no slip)
- **fail:** the goal was missed
- **neutral:** skipped, or an unscheduled day
- **pending:** the current period while it can still be met

The **current streak** counts successes backwards from the current period, passing over neutral and pending periods and stopping at the first fail. Missing today does not zero the streak until the day is over. The **best streak** is the longest such run.

**Strength** (0-100) follows Loop Habit Tracker: each judged period moves the score towards that period's fraction of the goal (partial progress counts), with a half-life of about 13 periods for daily habits and proportionally longer for longer periods. A single miss after a long run dents the score instead of resetting it.

The counters on the task row (`habit_current_streak`, `habit_best_streak`, `habit_total_completions`, `habit_last_completion_at`, `habit_strength`) are caches. They are rebuilt on every check-in, skip, deletion, settings change and on `GET /api/habits`, so a missed day shows up without any background job.

## Archiving

Archiving sets the habit's status to archived (3). It disappears from the Habits page and from Today, keeps its history, and can be restored from the Archived list. Deleting removes the habit and every check-in.

## Reminders

`habit_reminders` runs every 5 minutes in `taskScheduler.js` (`habitReminderService.js`). At or after the reminder time, and at most once a day (`habit_reminder_sent_on`), it creates a `reminder` notification when the habit is still open: not met, not skipped and scheduled today. Reminders later than an hour after the set time are dropped. Quit habits get an encouraging check-in while they are clean. Channels come from the `habitReminders` notification preference (in-app on by default, Telegram optional).

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/habits` | Active habits with `habit_progress`; `?archived=true` for archived |
| GET | `/api/habits/:uid` | One habit with `habit_progress` |
| POST | `/api/habits` | Create |
| PUT | `/api/habits/:uid` | Update settings (only habit fields are accepted) |
| POST | `/api/habits/:uid/complete` | Check in: `{ completed_at?, value?, note? }` |
| POST | `/api/habits/:uid/skip` | Skip a day: `{ date?, note? }` |
| GET | `/api/habits/:uid/completions` | Check-ins and skips in `start_date`..`end_date` |
| PATCH | `/api/habits/:uid/completions/:id` | Edit a check-in's `value` or `note` |
| DELETE | `/api/habits/:uid/completions/:id` | Remove a check-in or skip |
| GET | `/api/habits/:uid/stats` | Streaks, strength, completion rate over judged periods |
| POST | `/api/habits/:uid/archive`, `/unarchive` | Archive or restore |
| DELETE | `/api/habits/:uid` | Delete with history |

`habit_progress` describes the current period: `period_start`, `period_end`, `progress`, `goal`, `met`, `skipped`, `check_ins`, `today_check_ins`, `scheduled_today`, `multiple_per_day` and `first_day` (the first day of history).

The legacy fields `habit_streak_mode` and `habit_flexibility_mode` are still stored and accepted but no longer affect anything.
