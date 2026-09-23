# Upcoming View - Behavior Rules

This document explains how the Upcoming view works in tududi. For technical implementation details, see `/backend/modules/tasks/queries/query-builders.js` and `/backend/modules/tasks/recurringTaskService.js`.

---

## Overview

The **Upcoming view** is a forward-looking calendar that shows tasks scheduled for the next 7 days, organized by date. It differs from the Today view by showing all upcoming work rather than just today's active tasks.

**Key characteristics:**
- Shows tasks due in the next 7 days
- Grouped by day of the week
- Displays recurring task occurrences
- Includes deferred tasks whose defer date falls in the window
- Shows upcoming projects

**URL:** `/upcoming`

---

## Basic Rules

1. **Time range is 7 days ahead**
   - Starts today at midnight (your timezone)
   - Ends 7 days from now at 11:59 PM (your timezone)

2. **Grouped by day, not by status or project**
   - Tasks organized into columns/sections by due date
   - Labels: "Today", "Tomorrow", "Monday, March 17", etc.
   - Deferred tasks without a due date appear in a "No Due Date" section

3. **All tasks are loaded at once**
   - No "Load More" or pagination
   - Shows complete 7-day view

4. **Recurring tasks show as multiple occurrences**
   - Each occurrence appears on its due date
   - Same task can appear on multiple days
   - These are "virtual" previews generated on-the-fly

5. **Cannot create new tasks from Upcoming view**
   - "New Task" button is hidden
   - Create tasks from Inbox, Today, or specific projects instead

---

## What Tasks Appear in Upcoming

### Tasks Included

A task appears in Upcoming if it matches **any** of these conditions:

1. **Regular tasks with due dates**
   - Due date falls within the next 7 days
   - Not marked as completed (unless viewing completed tasks)

2. **Tasks becoming available from deferral**
   - "Defer Until" date falls within the next 7 days
   - Still placed by due date, not by defer date (see [Defer Until Behavior](#defer-until-behavior))

3. **Recurring task occurrences**
   - All occurrences of recurring tasks in the next 7 days
   - Generated automatically from the recurring pattern
   - Each occurrence appears on its scheduled date

4. **Deferred tasks without due dates**
   - Appear in the "No Due Date" section
   - Only tasks picked up by rule 2; undated tasks that are not deferred into the window do not appear

### Tasks Excluded

**Tasks that don't appear:**

1. **Overdue tasks** (due before today)
   - Past-due non-recurring tasks don't appear
   - Exception: Recurring tasks continue showing future occurrences

2. **Future tasks** (due more than 7 days ahead)
   - Only shows the next 7-day window
   - Tasks due next month won't appear

3. **Completed tasks, when the "Active" filter is selected**
   - The default filter is "All", which includes completed tasks
   - Can toggle between Active/Completed/All

Subtasks are included: the view requests `include_subtasks=true`, so a subtask with a due date in the window appears on its own day like any other task.

---

## How Recurring Tasks Work in Upcoming

### Virtual Occurrences

Recurring tasks appear as **virtual occurrences** - previews of future instances:

1. **Each occurrence gets its own date**
   - A daily task appears 7 times (once per day)
   - A weekly task appears 1-2 times (depending on the week)
   - A monthly task appears 0-1 times (if it falls within 7 days)

2. **Occurrences are generated automatically**
   - Based on the recurring pattern (daily, weekly, monthly, etc.)
   - Respects the recurrence interval (every 2 days, every 3 weeks, etc.)
   - Stops at the recurrence end date (if set)

3. **Each occurrence can be acted on independently**
   - Click to view details
   - Mark as complete
   - Edit the parent task (affects all future occurrences)

### Recurrence Patterns

**Patterns shown in Upcoming:**

- **Daily**: Every N days
  - Example: Every 2 days shows on Day 1, Day 3, Day 5, Day 7

- **Weekly**: Every N weeks on specific day(s)
  - Example: Every Monday shows next Monday (and following Monday if within 7 days)
  - Example: Mon+Wed+Fri shows 3 occurrences per week

- **Monthly**: Every N months on specific day
  - Example: 15th of every month (only appears if within 7 days)

- **Monthly Weekday**: Every N months on specific weekday
  - Example: 2nd Thursday of every month

- **Monthly Last Day**: Last day of every month

### Overdue Recurring Tasks

If a recurring task is overdue:
- The system automatically advances to the next future occurrence
- Past-due occurrences are skipped
- Only upcoming occurrences appear in the view

**Example:**
- Recurring task: "Weekly Report" every Monday
- Today: Wednesday, March 12
- Last completed: Monday, March 3 (overdue)
- **Shows in Upcoming**: Monday, March 17 (next occurrence)
- **Doesn't show**: Monday, March 10 (past, skipped)

---

## Grouping and Organization

### Day-Based Grouping

Tasks are organized into date columns/sections:

**Group Labels:**
1. **"Today"** - Tasks due today
2. **"Tomorrow"** - Tasks due tomorrow
3. **"[Weekday], [Date]"** - Other dates (e.g., "Monday, March 17")
4. **"No Due Date"** - Tasks without due dates

**Languages:**
- Group labels are translated into all 25 supported languages
- Date formats respect your locale settings

### Within Each Day

Tasks are sorted by:
- Selected sort order (due date, priority, name, etc.)
- Default: Creation date (newest first)

**Sort options available:**
- Due date (earliest or latest first)
- Priority (high to low, or low to high)
- Name (A-Z or Z-A)
- Status (by completion state)
- Created date (newest or oldest first)
- Completed date (for completed tasks)

### No Project Grouping

Unlike the main Tasks view:
- Cannot group by project
- All tasks mixed together by date
- Projects shown separately below the task list

---

## Status Filtering

### Filter Options

You can filter what appears in Upcoming:

1. **All** (default, no `status` in the URL)
   - Shows both active and completed tasks
   - Mixed view of everything

2. **Active**
   - Shows only open tasks
   - Excludes done, archived and cancelled tasks

3. **Completed**
   - Shows done and archived tasks whose due date falls in the 7-day window
   - It is not a history of the past week: a task due next Tuesday that you already finished shows here, one finished yesterday does not

### How to Filter

- Open the sort dropdown in the toolbar and pick an option under "Show"
- Selection is saved to URL (can bookmark)
- Changes immediately update the view

---

## Defer Until Behavior

### How Deferred Tasks Appear

A defer date in the window makes the backend fetch a task, but the view always places tasks by **due date**:

1. **Deferred into the window, due inside the window**
   - Appears on its due date
   - The same would happen without the defer date

2. **Deferred into the window, no due date**
   - Appears in the "No Due Date" section
   - This is the only way an undated task reaches Upcoming

3. **Deferred into the window, due after the window**
   - Does not appear: grouping drops every task due after the last day

4. **Deferred beyond the window**
   - Appears only if its due date is in the window (it is then fetched by its due date, like any task)
   - Otherwise it does not appear until the defer date is within 7 days

### Example Scenarios

**Scenario 1: Deferred, no due date**
- Task: "Review contract"
- Due date: none
- Defer until: March 15
- Today: March 12
- **Shows in Upcoming:** Yes, under "No Due Date"

**Scenario 2: Deferred, due after the window**
- Task: "Q2 planning"
- Due date: April 1
- Defer until: March 14
- Today: March 12
- **Shows in Upcoming:** No (due date is beyond the 7-day window)

---

## Upcoming Projects

### What Projects Appear

Projects show separately at the bottom of Upcoming if:
- Project has a due date set
- Due date falls within the next 7 days
- Project status is not done or cancelled

### Project Display

- Shown in an "Upcoming Projects" list below the tasks
- Sorted by due date
- Click to view project details

---

## Special Features

### Responsive Layout

**Desktop (wide screens):**
- Horizontal columns for each day
- Board-style layout
- Tasks arranged left to right across the week

**Mobile (narrow screens):**
- Vertical stacked sections
- One day at a time
- Scroll down to see future days

### No Search

- Search bar is hidden in Upcoming view
- Use main Tasks view or Inbox for searching
- Upcoming is for browsing by date only

### No Pagination

- All tasks for 7 days load immediately
- No "Load More" button
- Fast loading optimized for weekly view

### Auto-Refresh

The Upcoming view automatically refreshes:
- When you complete a task
- When you change task status
- When you edit a task's due date

---

## Differences from Today View

| Feature | Today View | Upcoming View |
|---------|------------|---------------|
| **Time range** | Only today | Next 7 days |
| **Grouping** | By section (Planned, Overdue, etc.) | By date |
| **Status focus** | Active tasks only | All tasks (filterable) |
| **Recurring display** | Parent + today's instance | All virtual occurrences |
| **New task creation** | Available | Not available |
| **Search** | Available | Not available |
| **Pagination** | Yes (Load More) | No (all loaded) |
| **Layout** | Vertical list | Board layout |

---

## User Settings

### Configurable Options

| Setting | Default | How to Change |
|---------|---------|---------------|
| **Status filter** | All | "Show" options in the sort dropdown |
| **Sort order** | Created date (newest) | Sort dropdown in toolbar |
| **Sort direction** | Descending | Toggle in sort dropdown |

### Saved Preferences

- **Sort order**: Saved to browser localStorage
- **Status filter**: Saved to URL (can bookmark)
- **Mobile/Desktop**: Auto-detected from screen size

---

## Common Use Cases

### 1. Planning Your Week

**What to do:**
- Open Upcoming view on Monday morning
- Scan across all 7 days
- See what's coming and when
- Reschedule overloaded days

### 2. Checking Recurring Tasks

**What to do:**
- Look for recurring tasks appearing multiple times
- Verify the pattern is correct
- Edit parent task if pattern needs adjustment

### 3. Finding Available Tasks

**What to do:**
- Check the "No Due Date" section
- It lists undated tasks you deferred into this week
- Plan when to work on them

### 4. Reviewing Completed Work

**What to do:**
- Switch to "Completed" status filter
- See which tasks due this week are already done

---

## Example Scenarios

### Scenario 1: Daily Recurring Task

**Setup:**
- Task: "Morning workout"
- Pattern: Every day at 7 AM
- Today: Monday, March 10

**Shows in Upcoming:**
- Monday, March 10: Morning workout
- Tuesday, March 11: Morning workout
- Wednesday, March 12: Morning workout
- Thursday, March 13: Morning workout
- Friday, March 14: Morning workout
- Saturday, March 15: Morning workout
- Sunday, March 16: Morning workout

**Total appearances:** 7 times (once per day)

### Scenario 2: Weekly Multi-Day Recurring Task

**Setup:**
- Task: "Team standup"
- Pattern: Every Mon, Wed, Fri
- Today: Monday, March 10

**Shows in Upcoming:**
- Monday, March 10: Team standup
- Wednesday, March 12: Team standup
- Friday, March 14: Team standup
- Monday, March 17: Team standup

**Total appearances:** 4 times

### Scenario 3: Deferred Task Becoming Available

**Setup:**
- Task: "Review proposal"
- Due date: March 15
- Defer until: March 14
- Today: March 10

**Shows in Upcoming:**
- Saturday, March 15: Review proposal
- (Placed on its due date, not on the defer date)
- (With a due date of March 25 it would not appear at all)

### Scenario 4: One-Time Task with Due Date

**Setup:**
- Task: "Submit report"
- Due date: March 15
- Today: March 10

**Shows in Upcoming:**
- Saturday, March 15: Submit report

**Total appearances:** 1 time (not recurring)

---

## Troubleshooting

### "My task doesn't appear in Upcoming"

**Check these:**
1. Is the due date more than 7 days away? (Only shows next 7 days)
2. Is the due date in the past? (Overdue tasks don't appear)
3. Is it marked as completed? (Switch the filter to "All" or "Completed")
4. Is it deferred? (It still shows on its due date; with no due date it is under "No Due Date"; due after the window it does not show)
5. Does it have no due date and no defer date in the window? (Undated tasks only appear when deferred into the window)

### "My recurring task shows too many times"

**This is normal if:**
- Pattern is daily (shows 7 times)
- Pattern is multi-day weekly (shows multiple times per week)

**To reduce occurrences:**
- Increase the recurrence interval (every 2 days instead of daily)
- Change to single-day weekly pattern
- Set a recurrence end date

### "My recurring task doesn't show at all"

**Check these:**
1. Is the recurrence end date in the past? (Task stopped recurring)
2. Is the task completed and not advancing? (Check completion-based setting)
3. Is the next occurrence beyond 7 days? (Monthly tasks may not appear)

---

## Related Documentation

- [Recurring Tasks Behavior](01-recurring-tasks-behavior.md) - How recurring tasks work
- [Today Page Sections](02-today-page-sections.md) - How Today page differs from Upcoming
- [Architecture Overview](architecture.md) - Technical architecture
- [Development Workflow](development-workflow.md) - Working with the codebase

**Technical Implementation Files:**
- Backend query builder: `/backend/modules/tasks/queries/query-builders.js`
- Recurring task service: `/backend/modules/tasks/recurringTaskService.js`
- Frontend component: `/frontend/components/Tasks.tsx`
- Grouping logic: `/backend/modules/tasks/operations/grouping.js`

---

**Document Version:** 1.1.0
**Last Updated:** 2026-09-22
**Audience:** Developers, AI assistants, and end users
