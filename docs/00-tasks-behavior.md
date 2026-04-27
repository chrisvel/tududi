# Tasks - Behavior Rules

This document explains how tasks work in TaskNoteTaker from a user behavior perspective (excluding recurring tasks, which are covered in [01-recurring-tasks-behavior.md](01-recurring-tasks-behavior.md)). For technical implementation details, see the backend code in `/backend/modules/tasks/` and `/backend/models/task.js`.

---

## **Task Creation**

### Basic Task Creation

1. **A task requires only a name to be created**
   - All other fields (due date, priority, project, etc.) are optional
   - Task name cannot be empty or just whitespace
   - Tasks are created with "Not Started" status by default

2. **Every task gets a unique identifier (UID)**
   - Used in URLs and API calls
   - Never changes during the task's lifetime
   - Example: `tsk_abc123def456`

3. **Tasks belong to a user**
   - The creator becomes the owner
   - Only the owner (or those with shared access) can view/modify the task
   - Admins can access all tasks

### Quick Capture

4. **Tasks can be created from multiple places:**
   - Main task list (+ button)
   - Today page quick add
   - Inbox (converted from inbox items)
   - Quick capture modal (keyboard shortcut)
   - Telegram bot
   - API

---

## **Task Fields & Properties**

### Name & Description

5. **Task name is the primary identifier**
   - Required field, maximum length varies by database
   - Displayed in lists, calendars, and notifications
   - Can be edited at any time

6. **Task note is for detailed information**
   - Optional text field for longer descriptions
   - Supports plain text (no markdown formatting)
   - Useful for context, instructions, or reference materials

### Status Lifecycle

7. **Seven status states exist:**
   - **Not Started (0):** Default state, task hasn't been worked on yet
   - **In Progress (1):** Task is actively being worked on
   - **Done (2):** Task is completed
   - **Archived (3):** Task is finished and archived for historical record
   - **Waiting (4):** Task is blocked or waiting on something/someone
   - **Cancelled (5):** Task was abandoned or is no longer needed
   - **Planned (6):** Task is scheduled to be worked on

8. **Status changes affect visibility:**
   - "Done", "Archived", and "Cancelled" remove tasks from active views
   - "In Progress", "Planned", and "Waiting" appear in Today page Planned section
   - Status determines which section of the Today page shows the task

9. **Completion tracking is automatic:**
   - Changing status to "Done" sets `completed_at` timestamp to current time
   - Changing status from "Done" to anything else clears `completed_at`
   - Completed tasks show in "Completed" section of Today page

### Priority Levels

10. **Three priority levels:**
    - **Low (0):** Default priority, no special urgency
    - **Medium (1):** Moderate importance
    - **High (2):** Urgent or critical task

11. **Priority affects sorting:**
    - In most views, tasks are sorted High → Medium → Low
    - Priority is a visual indicator (colored flag icons)
    - Does not affect task behavior, only display order

### Due Dates

12. **Due dates are optional:**
    - Tasks without due dates are considered "someday/maybe"
    - Due dates are stored with date and time
    - Displayed in user's timezone

13. **Due date behavior:**
    - Tasks become "overdue" if due date passes and status is not "Done"
    - Overdue tasks appear in "Overdue" section on Today page
    - Due today tasks appear in "Suggested" section (if not in Planned status)
    - No automatic status changes when due date passes

### Defer Until

14. **Defer Until hides tasks until a specific time:**
    - Set a date/time when you want the task to become visible
    - Task is completely hidden from all views until defer time passes
    - Useful for "start this task on Monday" or "remind me in 2 hours"

15. **Defer Until behavior:**
    - System checks every 5 minutes for tasks whose defer time has passed
    - When defer time is reached, task becomes visible in appropriate sections
    - Optional notification sent when task becomes active (configurable)
    - Defer time can be edited or cleared at any time

16. **Defer Until is different from due date:**
    - Defer = "don't show me this until..."
    - Due date = "this needs to be finished by..."
    - A task can have both defer and due date
    - If both exist: task hidden until defer time, then due date determines urgency

---

## **Subtasks**

### Subtask Hierarchy

17. **Tasks can have subtasks (one level deep)**
    - Subtasks are full tasks with all properties (status, priority, due date, etc.)
    - Maximum one level: tasks can have subtasks, but subtasks cannot have their own subtasks
    - Parent-child relationship is tracked via `parent_task_id`

18. **Subtasks are displayed under their parent:**
    - Parent task shows a summary (e.g., "2 of 5 completed")
    - Subtasks can be collapsed/expanded in the UI
    - Subtasks are ordered by `order` field, then creation date

19. **Subtasks have their own lifecycle:**
    - Each subtask has independent status, priority, due date
    - Completing all subtasks doesn't auto-complete the parent
    - Completing the parent doesn't auto-complete subtasks
    - Deleting the parent deletes all subtasks (cascade)

20. **Subtask visibility rules:**
    - Subtasks don't appear in main task lists (only under parent)
    - Subtasks don't show in Today page sections independently
    - Searching for subtasks shows them with parent context
    - Filtering applies to parent tasks, not individual subtasks

### Subtask Ordering

21. **Subtasks can be manually reordered:**
    - Drag-and-drop in the UI updates the `order` field
    - Order is sequential integers (1, 2, 3, etc.)
    - New subtasks are added at the end (highest order + 1)

---

## **Attachments**

### File Uploads

22. **Tasks can have file attachments:**
    - Multiple files can be attached to a single task
    - File size limit: 10MB per file (configurable via `FILE_UPLOAD_LIMIT_MB` environment variable)
    - Stored in `/uploads/tasks/` directory

23. **Allowed file types:**
    - Images: jpg, jpeg, png, gif, webp, svg
    - Documents: pdf, doc, docx, xls, xlsx, ppt, pptx
    - Text: txt, md, csv
    - Archives: zip, tar, gz
    - Other common formats

24. **Attachment metadata:**
    - Original filename is preserved in database
    - File is renamed on disk for uniqueness (task-[timestamp]-[random].[ext])
    - Each attachment gets a unique UID
    - Attachments track: filename, file size, MIME type, upload date

25. **Attachment management:**
    - Uploaded by task owner or users with write access
    - Can be downloaded by anyone with read access to the task
    - Deleting attachment removes file from disk
    - Deleting task removes all attachments and their files

---

## **Project Assignment**

### Linking to Projects

26. **Tasks can belong to a project:**
    - Optional `project_id` field links task to project
    - Tasks without a project are "standalone"
    - Project assignment determines which project view shows the task

27. **Project assignment effects:**
    - Task inherits project's sharing permissions
    - If user has access to project, they have same access to project's tasks
    - Deleting a project can orphan or delete tasks (depends on user choice)
    - Task completion contributes to project's progress metrics

28. **Changing project assignment:**
    - Can move task from one project to another
    - Can remove task from project (makes it standalone)
    - Subtasks inherit parent task's project
    - Changing parent's project doesn't automatically update subtasks

---

## **Tags**

### Tagging System

29. **Tasks can have multiple tags:**
    - Tags are flexible labels for categorization
    - Same tag can be used across tasks, notes, and projects
    - Tags are created automatically when first used
    - Tags are case-insensitive and normalized

30. **Tag behavior:**
    - Adding/removing tags doesn't affect task status or visibility
    - Tags enable filtering: "show all tasks with #urgent"
    - Tags appear as clickable chips in the UI
    - Tag autocomplete suggests existing tags while typing

31. **Tag inheritance:**
    - Subtasks have their own independent tags
    - Tags are not inherited from parent task or project
    - Deleting a tag removes it from all tasks (but doesn't delete tasks)

---

## **Task Completion**

### Marking Tasks as Done

32. **Completing a task:**
    - Change status to "Done" (manually or via checkbox)
    - `completed_at` timestamp is set to current time
    - Task moves to "Completed" section on Today page
    - Task disappears from active task lists

33. **Completion behavior for subtasks:**
    - Parent can be completed even if subtasks are not done
    - Subtasks can be completed independently
    - Completing the parent doesn't complete subtasks
    - Progress indicator shows "X of Y completed" for subtasks

34. **Un-completing a task:**
    - Changing status from "Done" to any other status
    - Clears the `completed_at` timestamp
    - Task reappears in active views
    - Task history preserves the completion event

### Completed Task Visibility

35. **Where completed tasks appear:**
    - "Completed" section on Today page (if completed today)
    - Project details page with "Show completed" filter
    - Search results (if specifically queried)
    - Task history and timeline views

36. **Completed tasks are excluded from:**
    - Main task lists by default
    - Today page "Planned" and "Suggested" sections
    - Overdue calculations
    - Upcoming view (future due dates)

---

## **Task Events & History**

### Activity Tracking

37. **Every task change is logged:**
    - Task creation event
    - Status changes
    - Field updates (name, due date, priority, etc.)
    - Assignment to project
    - Tag additions/removals
    - Attachment uploads/deletions

38. **Event data includes:**
    - Event type (created, status_changed, field_updated, etc.)
    - User who made the change
    - Timestamp of the change
    - Old value and new value (for field changes)
    - Additional metadata (source: web, API, Telegram, etc.)

39. **Task timeline:**
    - Events are displayed in chronological order
    - Shows full audit trail of task's lifecycle
    - Useful for understanding when and why changes occurred
    - Cannot be edited or deleted (immutable history)

---

## **Habit Mode**

### Habit Tracking

40. **Tasks can be habit trackers:**
    - `habit_mode` flag enables habit-specific features
    - Different from recurring tasks (habits focus on streak tracking)
    - Example: "Exercise 3 times per week"

41. **Habit properties:**
    - **Target count:** How many times per period (e.g., 3 times)
    - **Frequency period:** daily, weekly, or monthly
    - **Streak mode:**
      - Calendar: Count consecutive days
      - Scheduled: Count consecutive completions on scheduled days
    - **Flexibility mode:**
      - Strict: Must complete on exact schedule
      - Flexible: Can complete within the period

42. **Habit tracking:**
    - `habit_current_streak`: Current consecutive completions
    - `habit_best_streak`: Longest streak ever achieved
    - `habit_total_completions`: Total times completed
    - `habit_last_completion_at`: When last completed

43. **Habit completion:**
    - Completing a habit increments counters
    - Streak breaks if missed according to mode rules
    - Habit widgets show progress toward target count
    - Visual indicators for streak status (on track, at risk, broken)

---

## **Task Deletion**

### Deleting Tasks

44. **Deleting a task:**
    - Removes the task from the database
    - Cascade deletes all subtasks
    - Removes all attachments (files deleted from disk)
    - Removes task events/history
    - Removes tag associations (tags themselves remain)

45. **Soft delete is not implemented:**
    - Deletion is permanent (no trash/recycle bin)
    - No undo operation
    - Completed tasks can be archived instead of deleted

46. **Deleting a parent task:**
    - All subtasks are deleted (cannot be orphaned)
    - Warning shown if parent has subtasks
    - User must confirm deletion

47. **Permission to delete:**
    - Only task owner can delete their tasks
    - Users with write access via project sharing can delete
    - Admins can delete any task

---

## **Task Sharing & Permissions**

### Access Control

48. **Tasks inherit permissions from projects:**
    - If a task belongs to a project, anyone with project access has same access to task
    - Access levels: none, read-only (ro), read-write (rw), admin
    - Owner always has full access

49. **Standalone tasks:**
    - Tasks without a project are only visible to owner
    - Cannot be shared directly (must assign to a project to share)
    - Admins can view all tasks regardless of ownership

50. **Permission effects:**
    - **Read-only:** Can view task, cannot edit or delete
    - **Read-write:** Can edit task fields, add subtasks, upload attachments
    - **Admin/Owner:** Can delete task, change project assignment, share

---

## **Task Ordering & Sorting**

### Default Sort Order

51. **Tasks are typically sorted by:**
    1. Priority (High → Medium → Low)
    2. Due date (earliest first, nulls last)
    3. Created date (newest first for same priority/due date)

52. **Custom sorting options:**
    - Name (alphabetical)
    - Status
    - Created date
    - Updated date
    - Manual order (drag-and-drop, for subtasks)

53. **Grouping options:**
    - By project
    - By status
    - By priority
    - By due date (today, tomorrow, this week, later)
    - By tags

---

## **Task Notifications**

### Notification Types

54. **Tasks trigger notifications for:**
    - Task due soon (based on due date)
    - Task overdue
    - Defer Until time reached
    - Task assigned to you (shared via project)

55. **Notification channels:**
    - In-app notifications (navbar indicator)
    - Email (configurable per notification type)
    - Telegram (configurable per notification type)
    - Push notifications (configurable per notification type)

56. **Notification preferences:**
    - User can enable/disable per notification type
    - User can choose which channels for each type
    - Notifications can be dismissed or marked as read
    - Duplicate notifications are prevented (deduplication logic)

---

## **Special Behaviors**

### Task Visibility Rules

57. **A task is hidden from views if:**
    - Defer Until time has not yet passed
    - Status is "Done", "Archived", or "Cancelled" (unless showing completed)
    - User doesn't have permission to view it
    - It's a subtask (only shown under parent)
    - It's a recurring parent template (only instances shown)

58. **Overdue detection:**
    - Task is overdue if: `due_date < now` AND `status != Done/Archived/Cancelled`
    - Overdue tasks appear in "Overdue" section on Today page
    - Overdue count shows in navbar and project metrics
    - No automatic status change occurs

### Task Intelligence

59. **Task intelligence features (optional, can be disabled):**
    - Auto-suggest next actions based on task context
    - Smart suggestions for tasks to work on (Today page "Suggested" section)
    - Productivity insights and patterns
    - Next task recommendation based on priority, due date, and context

60. **Suggestion algorithm considers:**
    - Due dates (tasks due soon ranked higher)
    - Priority level
    - Project deadlines
    - Task age (older tasks surfaced)
    - Completion patterns (time of day you usually work on similar tasks)

---

## **Key Concepts**

### Task Instance

A single task record in the database with a unique ID and UID. Contains all task properties (name, status, priority, dates, etc.).

### Parent-Child Relationship

Hierarchical link between a parent task and its subtasks. One level deep only. Tracked via `parent_task_id` field.

### Completion Timestamp

The exact date and time when a task's status changed to "Done". Stored in `completed_at` field. Used for filtering "completed today" tasks.

### Task Events

Immutable audit log of all changes to a task. Each event records who changed what, when, and the before/after values.

### Defer Until

A feature that hides a task from all views until a specified date/time. Different from due dates - it's about when to START thinking about the task, not when to FINISH it.

### Task Ownership

The user who created the task owns it by default. Ownership can be transferred via project sharing, but the original `user_id` doesn't change.

### Habit Tracking

A mode that transforms a task into a habit tracker with streak counting, target counts, and flexible scheduling. Useful for building consistent behaviors.

---

## **Related Documentation**

- [Recurring Tasks Behavior](01-recurring-tasks-behavior.md) - How recurring tasks work
- [Today Page Sections](02-today-page-sections.md) - Task filtering and display on Today page
- [Upcoming View](03-upcoming-view.md) - 7-day task preview
- [Projects](06-projects.md) - Project assignment and task organization
- [Tags System](09-tags-system.md) - Tagging and categorization
- [User Management](08-user-management.md) - Permissions and sharing

**Technical Implementation Files:**
- Task model: `/backend/models/task.js`
- Task service: `/backend/modules/tasks/`
- Task completion: `/backend/modules/tasks/operations/completion.js`
- Subtasks: `/backend/modules/tasks/operations/subtasks.js`
- Attachments: `/backend/modules/tasks/attachments.js`
- Task events: `/backend/modules/tasks/taskEventService.js`
- Deferred tasks: `/backend/modules/tasks/deferredTaskService.js`

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-15
**Audience:** Developers, AI assistants, and end users