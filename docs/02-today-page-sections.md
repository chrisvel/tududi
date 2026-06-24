# Today Page Sections - Behavior Rules

This document explains how the four main sections of the Today page work in tududi. For technical implementation details, see `/backend/modules/tasks/queries/metrics-queries.js` and `/backend/modules/tasks/queries/metrics-computation.js`.

---

## Overview

The Today page is divided into **four main sections** that organize your tasks:

1. **Overdue** - Tasks past their due date that need attention
2. **Planned** - Tasks you're actively working on today
3. **Suggested** - Tasks recommended for you to work on next
4. **Completed** - Tasks you finished today

Each section follows specific rules to show the right tasks without duplication.

---

## 1. PLANNED SECTION

### What Appears Here

Tasks with any of these three statuses:
- **In Progress** - Tasks you're actively working on
- **Planned** - Tasks you scheduled to work on
- **Waiting** - Tasks blocked or waiting for something

### Key Rules

1. **Status is what matters, not the "today" checkbox**
   - A task marked "Planned" appears here even if you haven't checked "today"
   - A task with "Not Started" status won't appear here even with "today" checked

2. **Deferred tasks are hidden**
   - If you set "Defer Until" to a future time, the task won't appear until that time arrives
   - Once the defer time passes, the task automatically becomes visible

3. **Only parent tasks appear**
   - Subtasks don't show up (they're shown under their parent)
   - Recurring parent templates are hidden (only today's instance shows)

4. **Completed or cancelled tasks are excluded**
   - Once done, archived, or cancelled, tasks move out of this section

### Display Order

Tasks are sorted by:
1. Priority (High → Medium → Low)
2. Due date (earliest first)
3. Project (grouped together)

### Special Cases

- **Habits**: Appear under a separate "Habits planned for today" header
- **Recurring tasks**: Only today's occurrence shows, not the template

---

## 2. OVERDUE SECTION

### What Appears Here

Tasks with a due date **before today** that are **NOT already in the Planned section**.

### Key Rules

1. **Time-based filtering**
   - Due date must be before today (respects your timezone)
   - "Today" is calculated using your local timezone settings

2. **Excludes tasks already in Planned**
   - If a task is overdue but you marked it "In Progress" or "Planned", it stays in Planned
   - Avoids showing the same task in multiple sections

3. **No completed or cancelled tasks**
   - Done, archived, and cancelled tasks don't appear

4. **Project deadlines affect task visibility**
   - If a task has no due date but its project is overdue, the task appears here
   - Helps you see work related to overdue projects

5. **Deferred tasks are hidden**
   - If you deferred a task to tomorrow, it won't show in Overdue today
   - Even if originally overdue, deferred tasks hide until defer time passes

### Display Order

Same as Planned section:
1. Priority (High → Medium → Low)
2. Due date (earliest first)
3. Project (grouped together)

### User Control

- Can be hidden entirely via Today Settings
- Collapse/expand state is remembered in your browser

---

## 3. SUGGESTED SECTION

### What Appears Here

Tasks automatically selected as good candidates to work on next, ordered by relevance.

### When Suggestions Appear

Suggestions are only shown if:
- You have 3 or more open tasks, OR
- You have tasks in progress, OR
- You have tasks due today

If none of these are true, no suggestions are shown.

### Eligibility Rules

1. **Excludes tasks already visible elsewhere**
   - Tasks in Planned, Overdue, Due Today, In Progress, or Completed don't appear
   - Avoids duplication across sections

2. **Excludes deferred tasks**
   - Tasks with "Defer Until" set to the future don't appear
   - Only shows tasks available to work on right now

3. **Excludes far-future tasks**
   - Tasks with a due date more than 3 days away are not suggested
   - Tasks due today, tomorrow, or the day after are still eligible (and get a boost)

4. **Excludes "someday" tasks by default**
   - Tasks tagged "someday" are only included as a fallback if fewer than 6 suggestions exist

5. **One task per project**
   - The system picks the single best next action per active project
   - Inactive (done/cancelled) projects are excluded entirely

6. **No subtasks or recurring templates**
   - Only parent tasks you can directly act on are shown

### Scoring

Every eligible task receives a base score from its priority, then context boosts are added:

| Signal | Score added |
|--------|-------------|
| High priority | 100 base |
| Medium priority | 60 base |
| Low priority | 30 base |
| No priority | 0 base |
| Orphan task (no project) | +5 |
| Due today or overdue | +15 |
| Advances an active goal | +12 |
| Matches your current context tag | +10 |
| Revives a stalled project | +8 |
| Helps rebalance an under-represented area (balance mode) | +15–30 |

### Display Order

After scoring, tasks are sorted into **9 ordered buckets**. Within each bucket, tasks are ranked by their score:

| Position | Bucket |
|----------|--------|
| 1 | Project tasks — **High** priority |
| 2 | Orphan tasks — **High** priority |
| 3 | Project tasks — **Medium** priority |
| 4 | Orphan tasks — **Medium** priority |
| 5 | Project tasks — **Low** priority |
| 6 | Orphan tasks — **Low** priority |
| 7 | Project tasks — **No** priority |
| 8 | Orphan tasks — **No** priority |
| 9 | **Aging nudge** — one old null-priority orphan task untouched for 60+ days |

**Orphan tasks** are tasks with no project assigned.
**Aging nudge** only applies to null-priority orphan tasks that haven't been updated in 60+ days. Tasks with any explicit priority set (high/medium/low) are never demoted to the aging bucket regardless of age.

### User Control

- Can be hidden entirely via Today Settings (hidden by default)
- Collapse/expand state is remembered in your browser
- Shows 5 tasks initially, with "Show more" to load additional suggestions

---

## 4. COMPLETED SECTION

### What Appears Here

Tasks you **completed today**, including:
- Regular tasks marked as "Done" today
- Recurring tasks you completed today (can appear multiple times if you completed multiple occurrences)

### Key Rules

1. **Time-based filtering**
   - Only tasks completed within today's 24-hour window (respects your timezone)
   - "Today" runs from 00:00:00 to 23:59:59 in your local timezone

2. **Includes recurring task history**
   - Recurring tasks track each completion separately
   - If you complete a recurring task multiple times today, all instances are shown
   - Completions are preserved in history even though the task advances to the next occurrence

3. **Only parent tasks appear**
   - Subtasks don't show (they're counted with their parent)
   - Recurring parent templates are excluded (only completed instances shown)

4. **Excludes skipped occurrences**
   - If you skipped a recurring task occurrence, it doesn't count as completed

### Display Order

Tasks are sorted by:
- **Completion time** (most recently completed first)

### Additional Data

The Completed section also provides:
- **Weekly completion trend**: 7-day chart showing your completion pattern
- **Completion count**: Total tasks completed today
- **Progress percentage**: Completed vs. planned tasks

### User Control

- Can be hidden entirely via Today Settings (visible by default)
- Collapse/expand state is remembered in your browser

---

## Section Priority Rules

### No Duplication

A task appears in **exactly one section** based on this priority:

1. **Completed** (highest priority) - If done today, shows only here
2. **Planned** - If status is in_progress/planned/waiting, shows only here
3. **Overdue** - If due before today and not planned, shows here
4. **Suggested** - If not in any above section and meets criteria, shows here

### Example Scenarios

**Scenario 1: Overdue task you're working on**
- Due date: 2 days ago
- Status: In Progress
- **Appears in:** Planned (not Overdue, because status takes priority)

**Scenario 2: High-priority task with no due date**
- Priority: High
- Due date: None
- Status: Not Started
- **Appears in:** Suggested (not Overdue, because no due date)

**Scenario 3: Task deferred until tomorrow**
- Due date: Yesterday (overdue)
- Defer until: Tomorrow
- Status: Not Started
- **Appears in:** Nowhere (hidden until defer time passes)

**Scenario 4: Recurring task completed**
- Recurrence: Daily
- Status: Done (just completed)
- **Appears in:** Completed (and task automatically resets for tomorrow)

---

## Time & Timezone Handling

### How "Today" is Calculated

- Your local timezone is detected from your account settings
- "Today" means from midnight to midnight in **your timezone**, not UTC
- All date comparisons respect your timezone

### Example

If you're in New York (EST, UTC-5):
- Today starts: 2026-03-14 00:00:00 EST = 2026-03-14 05:00:00 UTC
- Today ends: 2026-03-14 23:59:59 EST = 2026-03-15 04:59:59 UTC

A task completed at 11:30 PM EST shows in "Completed Today" even though it's technically the next day in UTC.

---

## User Settings

### Today Page Settings

You can customize what appears on your Today page:

| Setting | Default | Effect |
|---------|---------|--------|
| Show Overdue/Due Today | On | Shows/hides Overdue section |
| Show Suggestions | Off | Shows/hides Suggested section |
| Show Completed | On | Shows/hides Completed section |
| Show Metrics | Off | Shows/hides task metrics widget |
| Show Daily Quote | On | Shows/hides daily motivational quote |
| Show Progress Bar | On | Shows/hides completion progress bar |

### Where to Change Settings

- Click the settings icon (⚙️) on the Today page
- Settings auto-save when you toggle them
- Settings are stored per user account

### Collapsible Sections

Each section can be collapsed or expanded:
- Click the section header to collapse/expand
- Your preference is saved in your browser
- Persists across sessions

---

## Special Features

### Defer Until

**What it does:**
- Hides a task from all sections until a specific date/time
- Useful for tasks you can't work on yet

**How it works:**
1. Set "Defer Until" to a future date/time
2. Task disappears from Planned, Overdue, and Suggested sections
3. System sends you a notification 5 minutes before defer time
4. Task automatically reappears when defer time is reached

**Example:**
- Task: "Call plumber"
- Defer until: Monday 9 AM
- Result: Task hidden until Monday at 9 AM, then appears in appropriate section

### Recurring Tasks

**How they appear:**
- Only today's occurrence shows in sections (not the parent template)
- Parent templates are automatically hidden to avoid duplication
- When you complete today's occurrence, it moves to Completed and resets for next occurrence

**Completion tracking:**
- Each completion is recorded separately
- You can complete a recurring task multiple times in one day
- All completions show in the Completed section

### Habits

**Special handling:**
- Habits appear in the Planned section under "Habits planned for today"
- Separate from regular tasks
- Have their own "Habits completed today" subsection in Completed

---

## Performance & Limits

### Pagination

Each section shows a limited number of tasks by default:
- Initial display: 20 tasks per section
- "Load More" button: Loads next 20 tasks
- "Load All" button: Shows all tasks at once
- Counter shows: "Showing X of Y tasks"

### Auto-Refresh

The Today page automatically refreshes:
- When you mark a task complete
- When you change task status
- When you defer a task
- Every few minutes to catch changes made elsewhere

---

## Related Documentation

- [Recurring Tasks Behavior](01-recurring-tasks-behavior.md) - How recurring tasks work
- [Architecture Overview](architecture.md) - Technical architecture
- [Development Workflow](development-workflow.md) - Working with the codebase
- [Database & Migrations](database.md) - Data model details

**Technical Implementation Files:**
- Backend eligibility & sorting: `/backend/modules/tasks/queries/metrics-computation.js`
- Backend queries: `/backend/modules/tasks/queries/metrics-queries.js`
- Frontend scoring & ordering: `/frontend/utils/suggestionScoringUtils.ts`
- Frontend component: `/frontend/components/Task/TasksToday.tsx`
- Task model: `/backend/models/task.js`

---

**Document Version:** 1.1.0
**Last Updated:** 2026-06-25
**Audience:** Developers, AI assistants, and end users