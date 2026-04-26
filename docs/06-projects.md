# Projects - Behavior Rules

This document explains how projects work in tasknotetaker from a user behavior perspective. For technical implementation details, see the backend code in `/backend/modules/projects/` and frontend components in `/frontend/components/Project/`.

---

## Overview

**Projects** are containers for organizing related tasks and notes in tasknotetaker. They sit in the middle of the hierarchy (Areas > Projects > Tasks) and provide a focused workspace for achieving specific goals.

**Key characteristics:**
- Group related tasks and notes together
- Track progress and completion percentage
- Can belong to an Area for higher-level organization
- Support collaboration through sharing
- Have status lifecycle (Planned → In Progress → Done)
- Can be pinned to sidebar for quick access
- Support tags, priorities, and due dates

**URL:** `/project/:uid`

---

## Core Principles

1. **Projects are optional containers**
   - Tasks and notes can exist without projects (orphaned)
   - But projects help organize work into logical groupings

2. **Projects don't cascade delete**
   - Deleting a project orphans its tasks/notes, doesn't delete them
   - This prevents accidental data loss

3. **Projects track progress automatically**
   - Completion percentage calculated from child tasks
   - "Stalled" detection for projects with no active tasks

4. **Projects can be shared**
   - Share with other users (read-only or read-write)
   - Shared project access extends to all tasks/notes within

---

## Hierarchy

```
Areas (highest level - life domains)
  └── Projects (mid level - specific goals/initiatives)
        ├── Tasks (actionable items)
        └── Notes (reference material)
```

**Example:**
```
Area: "Personal"
  └── Project: "Home Renovation"
        ├── Task: "Get quotes from contractors"
        ├── Task: "Choose paint colors"
        └── Note: "Inspiration photos from Pinterest"
```

---

## Project Properties

### Basic Information

1. **Name** (required)
   - The project title
   - Example: "Q1 Marketing Campaign", "Home Renovation", "Learn Spanish"

2. **Description** (optional)
   - Longer explanation of the project's purpose
   - Supports multi-line text
   - Displayed at top of project page

3. **UID** (auto-generated)
   - Unique identifier for the project
   - Used in URLs: `/project/:uid`
   - Cannot be changed

### Organization

4. **Area** (optional)
   - Parent area this project belongs to
   - Used for high-level grouping
   - Can be changed or removed
   - Examples: "Work", "Personal", "Health"

5. **Tags** (optional)
   - Flexible categorization system
   - Multiple tags supported: `#q1`, `#urgent`, `#client-work`
   - Tags created automatically when used
   - Shared across projects, tasks, and notes

### Status and Lifecycle

6. **Status** (required, default: `not_started`)
   - **Planned**: Future project, not started yet
   - **Not Started**: Ready to begin but not yet started
   - **In Progress**: Currently being worked on
   - **Waiting**: Blocked or waiting on external dependency
   - **Done**: Project completed successfully
   - **Cancelled**: Project abandoned or no longer relevant

7. **Priority** (optional)
   - 0 = None (default)
   - 1 = Medium
   - 2 = High
   - Visual indicator in UI (colored dot)

8. **Due Date** (optional)
   - When the project should be completed
   - Triggers notifications when approaching or overdue
   - Displayed in project cards and detail view

### Display and Organization

9. **Pin to Sidebar** (boolean, default: `false`)
   - Pins project to left sidebar for quick access
   - Pinned projects shown above unpinned ones
   - Useful for currently active projects

10. **Banner Image** (optional)
    - Visual header image for the project
    - Uploaded via image picker
    - Displayed at top of project detail page
    - Can be edited or removed

### Task Display Preferences

11. **Show Completed Tasks** (boolean, default: `false`)
    - Controls whether completed tasks are visible
    - Per-project setting
    - Helps reduce clutter on active projects

12. **Task Sort Order** (string, default: `created_at:desc`)
    - How tasks are sorted within the project
    - Options: `created_at:asc`, `created_at:desc`, `due_date:asc`, `priority:desc`, etc.
    - Per-project preference

---

## Calculated Properties

These properties are computed automatically based on project content:

### Task Status Tracking

**task_status** object:
- `total`: Total number of tasks in project
- `done`: Count of completed tasks
- `in_progress`: Count of tasks currently being worked on
- `not_started`: Count of tasks not yet started

**Example:**
```json
{
  "total": 10,
  "done": 6,
  "in_progress": 3,
  "not_started": 1
}
```

### Completion Percentage

**completion_percentage**: `0-100`
- Calculated as: `(done / total) * 100`
- Rounded to whole number
- Shows `0%` if project has no tasks
- Based on parent tasks only (subtasks don't count separately)

### Stalled Detection

**is_stalled**: `true | false`
- A project is "stalled" when:
  - Status is `in_progress` OR `planned`
  - AND has zero active tasks (no "in_progress" or "not_started" tasks)
- Indicates projects that need attention
- Surfaced in Productivity Assistant

**Example scenarios:**
- ✅ Status: `in_progress`, Tasks: 5 (3 done, 2 not_started) → NOT stalled
- ❌ Status: `in_progress`, Tasks: 5 (all done) → STALLED
- ✅ Status: `done`, Tasks: 5 (all done) → NOT stalled (done projects can't be stalled)
- ❌ Status: `planned`, Tasks: 0 → STALLED

### Sharing Metadata

**share_count**: Number of users project is shared with
**is_shared**: `true` if `share_count > 0`

---

## Project Lifecycle

### Creating a Project

**Ways to create:**
1. Click "New Project" button on Projects page
2. Use `+Project` syntax in Inbox and convert
3. Create via modal when adding task/note

**Required fields:**
- Name

**Default values:**
- Status: `not_started`
- Pin to sidebar: `false`
- Show completed tasks: `false`
- Task sort order: `created_at:desc`

**Auto-generated:**
- UID (unique identifier)
- Timestamps (created_at, updated_at)

### Editing a Project

**What you can edit:**
- All basic properties (name, description, area, status, priority, due date)
- Tags (add/remove)
- Banner image (upload/change/remove)
- Display preferences (pin, show completed, sort order)

**What you cannot edit:**
- UID
- User ID (owner)
- Created timestamp

**Who can edit:**
- Project owner (full access)
- Users with read-write (`rw`) share access
- Admin users

### Changing Status

**Status transitions:**
- Any status can change to any other status (no enforced workflow)
- Common flows:
  - `planned` → `in_progress` → `done`
  - `not_started` → `in_progress` → `done`
  - `in_progress` → `waiting` → `in_progress`
  - `in_progress` → `cancelled`

**Effects of status change:**
- Affects "active projects" filter (planned/in_progress/waiting)
- Affects stalled detection
- Updates last modified timestamp

### Deleting a Project

**What happens:**
1. Project record is deleted from database
2. **Tasks belonging to project are orphaned** (project_id set to null)
3. **Notes belonging to project are orphaned** (project_id set to null)
4. Project tags associations are removed
5. Share permissions are deleted

**What is NOT deleted:**
- Tasks (they become orphaned, appear in "No Project" filter)
- Notes (they become orphaned)
- Tags (they remain in system)
- Area (parent area is unaffected)

**Who can delete:**
- Project owner only
- Admin users

**No undo:**
- Deletion is permanent
- Use status `cancelled` if you want to preserve but deactivate

---

## Areas and Projects

### What is an Area?

An **Area** is a top-level category representing a life domain or responsibility area. Examples:
- Personal
- Work
- Health
- Finance
- Learning

### Relationship

**Projects belong to Areas (optional):**
- One project can belong to one area
- A project can have no area (orphaned)
- An area can have multiple projects
- Deleting an area orphans its projects (doesn't delete them)

### Grouping

**On Projects page:**
- Projects can be grouped by area (`?grouped=true`)
- Shows "No Area" group for orphaned projects
- Useful for high-level overview of work

**Example grouped view:**
```
Work
  ├── Q1 Marketing Campaign
  ├── Website Redesign
  └── Client Onboarding

Personal
  ├── Home Renovation
  └── Learn Spanish

No Area
  └── Random Ideas
```

---

## Tasks and Notes in Projects

### Adding Tasks to Projects

**Ways to assign task to project:**
1. Select project in task detail modal
2. Use `+ProjectName` syntax in Inbox
3. Create task directly from project page
4. Bulk assign existing orphaned tasks

**Task inheritance:**
- Tasks inherit nothing from parent project
- Task status is independent of project status
- Task due date is independent of project due date
- Task priority is independent of project priority

**Task visibility:**
- All project tasks shown on project detail page
- Can filter by status (not_started, in_progress, done)
- Can toggle "Show completed" per project
- Parent tasks only (subtasks nested under parents)

### Adding Notes to Projects

**Ways to assign note to project:**
1. Select project in note modal
2. Use `+ProjectName` syntax in Inbox when converting to note
3. Create note directly from project page

**Note display:**
- Notes shown in separate "Notes" section on project page
- Sorted by most recent first
- Can be tagged independently

### Orphaned Tasks/Notes

**What are orphaned items:**
- Tasks or notes with no project assigned (`project_id = null`)
- Created without project, or project was deleted

**How to find:**
- Tasks page: Filter by "No Project"
- Can bulk-assign to projects later

**Not a problem:**
- Orphaned items are perfectly valid
- Projects are optional organizational containers

---

## Project Sharing and Collaboration

### Share Levels

1. **Read-Only (`ro`)**
   - View project, tasks, and notes
   - Cannot edit or add content
   - Cannot share with others

2. **Read-Write (`rw`)**
   - View project, tasks, and notes
   - Edit existing content
   - Add new tasks and notes
   - Cannot delete project
   - Cannot change sharing settings

3. **Owner (implicit)**
   - Full control
   - Can delete project
   - Can change sharing settings
   - Can change project status

### Sharing a Project

**How to share:**
1. Open project detail page
2. Click "Share" button
3. Enter email of user to share with
4. Select access level (read-only or read-write)
5. User receives notification

**Requirements:**
- Other user must have a tasknotetaker account
- Must use exact email address
- Cannot share with yourself

### Access Inheritance

**When you share a project:**
- Shared user gets access to ALL tasks in project
- Shared user gets access to ALL notes in project
- Access level applies to entire project tree

**Example:**
- You share "Website Redesign" project with Alice (read-write)
- Alice can now view/edit:
  - The project itself
  - All tasks in the project
  - All notes in the project
  - All subtasks of tasks in the project

### Shared Projects Behavior

**For shared users:**
- Shared projects appear in their Projects list
- Can filter projects by ownership vs shared
- Shared indicator shown on project card
- Cannot change Area (only owner can)
- Cannot delete project (only owner can)

**Notifications:**
- Project owner sees share count badge
- Shared users see owner's name
- Activity on shared project can trigger notifications

---

## Due Dates and Notifications

### Setting Due Dates

**Project due date:**
- Optional field
- Date + time picker
- Represents project deadline

**Independent from task due dates:**
- Project due date doesn't affect task due dates
- Tasks can be due before, during, or after project due date
- No validation or warnings if dates mismatch

### Due Date Notifications

**Automated notifications created when:**
1. **Due Soon**: Project due date within 24 hours
2. **Overdue**: Project due date has passed

**Notification timing:**
- Checked via cron job (runs periodically)
- Notifications sent in-app
- Can also send via Telegram if configured

**Notification rules:**
- Only for projects with status NOT `done` or `cancelled`
- Only if user has notifications enabled for this type
- Won't create duplicate notifications
- Old unread notifications deleted before creating new one
- Dismissed notifications won't be recreated

**Example messages:**
- "Your project 'Website Redesign' is due in 6 hours"
- "Your project 'Q1 Report' was due yesterday"
- "Your project 'Client Onboarding' was due 3 days ago"

---

## Filtering and Viewing Projects

### Projects List Page

**URL:** `/projects`

**Default view:**
- All projects for current user
- Includes owned and shared projects
- Sorted alphabetically by name
- Shows project cards with:
  - Name, description (truncated)
  - Status badge
  - Priority indicator
  - Completion percentage
  - Task count
  - Tags
  - Area name
  - Pinned indicator
  - Shared indicator

### Filter Options

1. **By Status**
   - Query: `?status=in_progress`
   - Values: `planned`, `not_started`, `in_progress`, `waiting`, `done`, `cancelled`
   - Can filter multiple: `?status[]=in_progress&status[]=planned`

2. **By Active State**
   - Query: `?active=true`
   - `true`: Shows planned, in_progress, waiting
   - `false`: Shows not_started, done, cancelled

3. **By Area**
   - Query: `?area=:area-uid`
   - Shows only projects in specified area
   - Use area UID from URL

4. **By Pinned**
   - Query: `?pin_to_sidebar=true`
   - `true`: Only pinned projects
   - `false`: Only unpinned projects

5. **Grouped by Area**
   - Query: `?grouped=true`
   - Groups projects under area names
   - Special "No Area" group for orphaned projects

**Example URLs:**
- `/projects?status=in_progress` - Active projects
- `/projects?active=true` - All active projects
- `/projects?pin_to_sidebar=true` - Pinned projects only
- `/projects?area=abc123&grouped=true` - Projects in specific area, grouped

---

## Sidebar Pinning

### What is Pinning?

**Pin to Sidebar** is a quick-access feature that:
- Shows project in left sidebar navigation
- Provides one-click access to frequently used projects
- Appears under "Pinned Projects" section

### How to Pin

**Ways to pin:**
1. Click pin icon on project card
2. Toggle "Pin to sidebar" in project modal
3. Update via project detail page

**Pin behavior:**
- Pinned projects shown above unpinned ones in sidebar
- Sorted alphabetically within pinned section
- Can pin unlimited projects (but UI gets crowded)

### When to Pin

**Good candidates for pinning:**
- Currently active projects you access daily
- Projects in "in_progress" status
- Projects with frequent task additions
- Projects you're actively collaborating on

**Not recommended:**
- Completed or cancelled projects
- Future/planned projects not yet active
- Projects you rarely access

---

## Project Insights and Metrics

### Task Status Metrics

Displayed on project cards and detail page:

**Total tasks**: Count of all parent tasks (excluding subtasks)
**Completion percentage**: Visual progress bar
**Breakdown by status**:
- Done (green)
- In progress (blue)
- Not started (gray)

### Stalled Projects

**What is a stalled project?**
- Status is `planned` or `in_progress`
- Has zero active tasks (all tasks are done, or no tasks exist)

**Why it matters:**
- Indicates project needs attention
- Either needs new tasks, or should change status to "done"
- Surfaced in Productivity Assistant feature

**How to fix:**
1. Add new tasks to move project forward
2. Change status to "done" if actually complete
3. Change status to "waiting" or "cancelled" if appropriate

### Productivity Assistant

**Location:** Today page (if enabled in settings)

**Insights about projects:**
- **Stalled Projects**: Lists projects that need tasks/actions
- **Projects Near Deadline**: Due soon or overdue
- **Vague Projects**: Projects with vague task descriptions

---

## Common Workflows

### Workflow 1: Start a New Project

**Scenario:** Beginning a new initiative

1. Navigate to `/projects`
2. Click "New Project" button
3. Fill in details:
   - Name: "Website Redesign"
   - Description: "Redesign company website for Q1 launch"
   - Area: Work
   - Status: Planned
   - Priority: High
   - Tags: #q1, #design
4. Save project
5. Add first task: "Research design trends"
6. Change status to "In Progress" when ready to begin

### Workflow 2: Track Project Progress

**Scenario:** Monitoring ongoing project

1. Open project detail page
2. Review completion percentage (e.g., 60%)
3. Check task breakdown:
   - 6 done
   - 2 in progress
   - 2 not started
4. Complete some tasks
5. Completion percentage updates automatically
6. When all tasks done, mark project status as "Done"

### Workflow 3: Share Project with Collaborator

**Scenario:** Working with team member

1. Open project "Client Onboarding"
2. Click "Share" button
3. Enter collaborator email: alice@example.com
4. Select "Read-Write" access
5. Save
6. Alice receives notification
7. Alice can now:
   - View all project tasks
   - Add new tasks
   - Complete tasks
   - Add notes
8. Both see real-time updates

### Workflow 4: Organize with Areas

**Scenario:** High-level life organization

1. Create Areas:
   - Work
   - Personal
   - Health
2. Assign projects to areas:
   - "Q1 Marketing" → Work
   - "Home Renovation" → Personal
   - "Exercise Routine" → Health
3. View projects grouped by area
4. Get high-level view of balance across life domains

### Workflow 5: Clean Up Completed Projects

**Scenario:** End of quarter cleanup

1. Navigate to `/projects?status=in_progress`
2. Review each project:
   - If all tasks done → Change status to "Done"
   - If abandoned → Change status to "Cancelled"
   - If stalled → Add new tasks or change status
3. Move completed projects out of active view
4. Focus on truly active projects

---

## Project Display Rules

### Project Cards (List View)

**Information shown:**
- Project name (bold, clickable)
- Description (first 100 chars, truncated with "...")
- Status badge (color-coded)
- Priority dot (if set)
- Completion percentage bar
- Task count: "X of Y tasks done"
- Area name (if assigned)
- Tags (up to 3 shown, "+N more" if exceeded)
- Last updated timestamp
- Pin indicator (star icon)
- Share indicator (user icon + count)

**Color coding:**
- **Planned**: Purple badge
- **Not Started**: Gray badge
- **In Progress**: Blue badge
- **Waiting**: Yellow badge
- **Done**: Green badge
- **Cancelled**: Red badge

### Project Detail Page

**Sections:**
1. **Banner Image** (if set) - full-width header
2. **Project Header**
   - Name (editable inline)
   - Status dropdown
   - Priority selector
   - Pin toggle
   - Share button
3. **Metadata Row**
   - Area (linked)
   - Due date (if set)
   - Tags (editable)
4. **Description** (expandable text area)
5. **Progress Section**
   - Completion percentage bar
   - Task breakdown (done/in progress/not started)
6. **Tasks Section**
   - Task list (sorted per project preference)
   - "Add Task" button
   - Show/hide completed toggle
7. **Notes Section**
   - Note cards (most recent first)
   - "Add Note" button
8. **Insights Panel** (if productivity assistant enabled)
   - Auto-suggested next actions
   - Stalled warning
   - Due date alerts

---

## Special Features

### 1. Auto-Suggest Next Action

**What it does:**
- AI-powered suggestions for next steps
- Analyzes project context, tasks, and notes
- Suggests concrete actions to move project forward

**Appears when:**
- Project has description and some tasks
- User has AI features enabled
- Accessed via "Suggest Next Action" button

**Example suggestions:**
- "Schedule a meeting with the designer"
- "Review the latest mockups"
- "Get feedback from stakeholders"

### 2. Banner Images

**Purpose:**
- Visual identity for projects
- Makes projects more recognizable
- Improves aesthetic appeal

**How to set:**
1. Click "Edit Banner" on project detail page
2. Upload image file (JPG, PNG)
3. Image stored in `/api/uploads/projects/`
4. Can replace or remove later

**Recommended:**
- Use relevant imagery (website screenshot for web project, house for renovation)
- High resolution (1200x400 or larger)
- Landscape orientation

### 3. Task Sorting Preferences

**Per-project sorting:**
- Each project can have its own task sort order
- Doesn't affect other projects
- Persisted across sessions

**Sort options:**
- Created date (newest/oldest first)
- Due date (soonest/latest first)
- Priority (highest/lowest first)
- Status (by progress)
- Name (A-Z, Z-A)

**Use cases:**
- Sprint project: Sort by priority
- Research project: Sort by created date
- Deadline-driven project: Sort by due date

### 4. Keyboard Shortcuts

**On project page:**
- `n`: Create new task
- `Shift+N`: Create new note
- `e`: Edit project details
- `p`: Pin/unpin project
- `/`: Focus search

**Global shortcuts:**
- `g` then `p`: Go to Projects page

---

## Troubleshooting

### "My tasks disappeared when I deleted the project"

**What happened:**
- Tasks are not deleted, they're orphaned
- They still exist in your database

**How to find:**
1. Go to Tasks page
2. Filter by "No Project"
3. You'll see all orphaned tasks
4. Re-assign to a different project if needed

### "Project shows 0% complete but I have completed tasks"

**Possible causes:**
1. All completed items are subtasks (only parent tasks count)
2. Completed items were soft-deleted
3. Tasks belong to different project

**How to check:**
1. Open project detail page
2. Check task list - are completed tasks visible?
3. Toggle "Show completed tasks" if hidden
4. Verify tasks actually belong to this project

### "Shared project not appearing for collaborator"

**Checklist:**
1. Did you use exact email address?
2. Does user have tasknotetaker account with that email?
3. Check share count - is it > 0?
4. Have them refresh their projects list
5. Check notifications - did they receive share notification?

### "Project marked as stalled but it has tasks"

**Why it's stalled:**
- All tasks are marked "done"
- Or all tasks are subtasks (parent tasks are all done)

**How to fix:**
1. Add new tasks for next phase of work
2. Or change project status to "done" if actually complete
3. Or change status to "waiting" if blocked

### "Can't delete a project"

**Possible reasons:**
1. You're not the owner (only owner can delete)
2. Permission issue (check if you have `rw` or just `ro`)

**Alternative:**
- If you can't delete, change status to "cancelled"
- Unpin from sidebar
- Filter it out of active views

---

## Related Documentation

- [Areas](07-areas.md) - Top-level organizational categories and project grouping
- [Recurring Tasks Behavior](01-recurring-tasks-behavior.md) - How recurring tasks work within projects
- [Today Page Sections](02-today-page-sections.md) - How project tasks appear on Today page
- [Inbox Page](04-inbox-page.md) - How to create projects from inbox
- [Architecture Overview](architecture.md) - Technical architecture
- [Backend Patterns](backend-patterns.md) - Module structure
- [Database & Migrations](database.md) - Data model details

**Technical Implementation Files:**
- Project model: `/backend/models/project.js`
- Area model: `/backend/models/area.js`
- Projects service: `/backend/modules/projects/service.js`
- Projects controller: `/backend/modules/projects/controller.js`
- Projects repository: `/backend/modules/projects/repository.js`
- Due project service: `/backend/modules/projects/dueProjectService.js`
- Permissions service: `/backend/services/permissionsService.js`
- Frontend components: `/frontend/components/Project/`
- Project detail page: `/frontend/components/Project/ProjectDetails.tsx`
- Project item card: `/frontend/components/Project/ProjectItem.tsx`
- Project modal: `/frontend/components/Project/ProjectModal.tsx`
- Share modal: `/frontend/components/Project/ProjectShareModal.tsx`

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-14
**Audience:** Developers, AI assistants, and end users