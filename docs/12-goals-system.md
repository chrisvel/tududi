# Goals System - Behavior Rules

This document explains how goals work in tududi. For technical details see `/backend/modules/goals/` and `/frontend/components/Goal/`.

---

## Overview

**Goals** are top-level outcome intentions that answer *why* a group of projects or tasks exists. They are the highest-level planning layer — above Areas — with their own list page, detail page, and sidebar navigation.

**Hierarchy position:**
```
Goals (season- or year-scale outcomes)   ← top level
  ├── Projects (specific initiatives)
  │     └── Tasks (actionable items)
  └── Tasks (directly assigned, without a project)

Areas (life domains, organizational containers)  ← parallel, not parent
  └── Projects (can belong to an area AND a goal)
```

**Key characteristics:**
- Top-level standalone entities — accessible from `/goals` and the sidebar
- Not tied to any area; goals are independent of the Areas system
- Projects can link to a goal regardless of which area they belong to
- Have a time horizon: `season` or `year`
- Have a status lifecycle: `active → achieved / paused / dropped`
- Tasks can be assigned directly to a goal (in addition to the project→goal path)

---

## Goal Properties

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | yes | The outcome statement. Max 255 chars. |
| `why` | text | no | The motivation behind the goal. Displayed in italics. |
| `horizon` | enum | yes | `season` or `year`. Default: `season`. |
| `target_date` | date | no | Optional deadline for the goal. |
| `status` | enum | yes | `active`, `achieved`, `paused`, `dropped`. Default: `active`. |
| `area_id` | integer | no | Stored in DB but not exposed in UI. Goals are area-independent. |
| `uid` | string | auto | URL-safe unique identifier. |

---

## Goal Lifecycle

### Status transitions

```
active → achieved   (outcome reached)
active → paused     (temporarily on hold)
active → dropped    (abandoned or no longer relevant)
paused → active     (resuming)
```

There is no enforced ordering — any status can transition to any other.

### Creating a goal

Goals can be created from multiple entry points:

1. **Goals list page** (`/goals`): header button opens GoalModal
2. **Sidebar**: click the **+** icon next to the Goals section heading
3. **Area detail page**: click **Add goal** next to the Goals heading

GoalModal fields:
- Title (required)
- Why (optional)
- Horizon (`season` / `year`)
- Status (defaults to `active`)
- Target date (optional)
- Area (optional — pick from dropdown or leave blank)

### Editing a goal

Click the pencil (edit) icon on any goal card on the Goals list page, or the edit button in the Goal detail page header. GoalModal opens pre-filled. Save to update.

From the Area detail page: click the pencil icon on a goal row — same GoalModal opens.

### Deleting a goal

Click the trash icon (Goals list page, Goal detail page, or Area detail page). A confirmation dialog warns that linked projects will become unlinked. The goal record is deleted; projects that referenced it have `goal_id` set to `null`.

---

## Scarcity Rule

The Area detail page displays a warning banner when an area has **more than 5 active goals**. This is a soft nudge, not an enforced limit.

---

## Goals List Page (`/goals`)

A grid view of all the user's goals across all areas.

**Layout:** Responsive grid (1 / 2 / 3 / 4 columns depending on screen size)

**Each goal card shows:**
- Title
- Why text (truncated)
- Status badge (color-coded)
- Horizon badge
- Area name (if set)
- Project count and task count in a footer stats bar
- Three-dot menu (hover) with Edit and Delete

Clicking a card navigates to the Goal detail page.

---

## Goal Detail Page (`/goal/:uid-slug`)

The goal detail page shows everything assigned to the goal, modelled after the Tag detail page.

**URL format:** `/goal/{uid}-{title-slug}` — e.g., `/goal/abc123-launch-new-product`

**Header banner:**
- Goal title
- Why text (italic, below title)
- Status badge and horizon badge
- Target date (if set)
- Area name as a link to the area (if set)
- Task and project counts
- Edit (pencil) and Delete (trash) buttons

**Two-column layout:**

```
┌─────────────────────┐  ┌─────────────────────────────┐
│  Projects (1/3)     │  │  Tasks (2/3)                │
│                     │  │                             │
│  [project card]     │  │  [active tasks list]        │
│  [project card]     │  │                             │
│                     │  │  Completed (n)              │
│                     │  │  [completed tasks list]     │
└─────────────────────┘  └─────────────────────────────┘
```

**Projects section:**
- Lists projects with `goal_id` pointing to this goal
- Each project shows name, status, and a left-colored border
- Click navigates to the project detail page

**Tasks section:**
- Lists tasks with `goal_id` pointing to this goal (direct assignment, not via project)
- Active tasks shown first, completed tasks below in a "Completed (n)" subsection
- Task rows show name, due date, and a check icon

---

## Sidebar Integration

The Goals section appears in the left sidebar between Areas and Notes.

- **Click the section label** → navigates to `/goals`
- **Click the `+` icon** (hover to reveal) → opens GoalModal to create a new goal
- **Click the chevron** → expands/collapses an inline list of active goals
- **Each goal row** in the expanded list → navigates to that goal's detail page

Only `status = active` goals are shown in the expandable list.

---

## Project–Goal Relationship

Each project in an area can be in one of three states relative to goals:

| State | `goal_id` | `is_maintenance` | Meaning |
|-------|-----------|------------------|---------|
| Linked to goal | set | false | Project is working toward a specific goal |
| Maintenance | null | true | Project keeps something running — not goal-directed |
| Unlinked | null | false | Project not yet assigned to a goal or maintenance |

### Linking a project to a goal

**From the Area detail page**, unlinked projects show a **link…** button. Clicking it opens an inline picker to select a goal or mark as maintenance.

**From the Project modal** (when editing a project):
1. Expand the **Goal** section (flag icon in toolbar)
2. An area must already be selected — goals are fetched for that area
3. Choose from: No goal / Maintenance / active goals / inactive goals

### Unlinking

Deleting the goal sets `goal_id = null` on all its projects (they become unlinked). To manually unlink, open the project modal → Goal section → select **No goal**.

---

## Task–Goal Relationship

Tasks can be directly assigned to a goal, independent of any project.

### Assigning a task to a goal

From the **Task detail page** (`/task/:uid`): the right sidebar contains a **Goal** card (below the Area card). Click it to open a searchable dropdown of all goals. Select a goal to save.

To remove: click the X button on the selected goal, or click the card and choose a different goal.

### What this means

- A task can carry its own `goal_id` that is separate from its project's `goal_id`.
- The Goal detail page lists tasks that are directly assigned to the goal via this field.
- There is no inherited goal_id from project → task; task and project goals are independent fields.

---

## Area Detail Page — Goals Section

The Area detail page (`/area/:uid-slug`) retains a goals column that shows all goals belonging to that area.

**Changed from the original implementation:**
- "Add goal" button opens **GoalModal** (area pre-filled) instead of an inline form
- Goal titles are now **clickable links** to `/goal/:uid-slug`
- Deleting a goal uses a **ConfirmDialog** (not a browser `window.confirm`)
- Goal row edit/delete buttons remain; clicking edit opens GoalModal

**Buckets in the Goals column (unchanged):**
1. **Active goals** — each with its linked project cards underneath
2. **Maintenance** — projects flagged `is_maintenance = true`
3. **Unlinked** — projects with no goal and no maintenance flag
4. **Inactive goals** — collapsed under a `<details>` element

For the full Area detail page layout, see [Areas](07-areas.md).

---

## API Reference

All endpoints require authentication. Responses are scoped to the current user.

### List goals

```
GET /api/goals
GET /api/goals?area_uid=:uid
GET /api/goals?area_id=:id
```

Returns `{ goals: Goal[] }`. Pass `area_uid` or `area_id` to filter to a single area.

### Get goal (with related tasks and projects)

```
GET /api/goals/:uid
```

Returns `{ goal: Goal }`. The `goal` object includes `Tasks` and `Projects` arrays.

### Create goal

```
POST /api/goals
Body: { title, area_id?, why?, horizon?, target_date?, status? }
```

Returns `{ goal: Goal, active_goals_count: number }`.

**Validation:**
- `title` required, non-empty
- `area_id` is optional (nullable)

### Update goal

```
PATCH /api/goals/:uid
Body: { title?, area_id?, why?, horizon?, target_date?, status? }
```

Returns `{ goal: Goal, active_goals_count: number }`.

### Delete goal

```
DELETE /api/goals/:uid
```

Returns 204. Projects referencing this goal have `goal_id` set to `null`. Tasks referencing this goal have `goal_id` set to `null`.

---

## Database Schema

### `goals` table

```sql
id          INTEGER  PRIMARY KEY AUTOINCREMENT
uid         STRING   UNIQUE NOT NULL
area_id     INTEGER  NULL  → areas.id  SET NULL on delete
user_id     INTEGER  NOT NULL  → users.id  CASCADE DELETE
title       STRING   NOT NULL
why         TEXT
horizon     ENUM('season', 'year')  DEFAULT 'season'
target_date DATEONLY
status      ENUM('active','achieved','paused','dropped')  DEFAULT 'active'
created_at  DATETIME
updated_at  DATETIME
```

**Indexes:** `area_id`, `user_id`, `status`

> Note: `area_id` changed from `NOT NULL` to nullable in migration `20260730000001-make-goals-area-id-nullable.js`.

### Project columns added by the goals feature

```sql
goal_id        INTEGER  → goals.id  SET NULL on delete
is_maintenance BOOLEAN  DEFAULT false
```

**Index:** `projects.goal_id`

### Task column added for direct goal assignment

```sql
goal_id  INTEGER  → goals.id  SET NULL on delete
```

**Index:** `tasks.goal_id` (migration `20260730000002-add-goal-id-to-tasks.js`)

---

## Technical Implementation

| Layer | File |
|-------|------|
| Migration (goals table) | `/backend/migrations/20260624000001-create-goals.js` |
| Migration (project columns) | `/backend/migrations/20260624000002-add-goal-columns-to-projects.js` |
| Migration (nullable area_id) | `/backend/migrations/20260730000001-make-goals-area-id-nullable.js` |
| Migration (task goal_id) | `/backend/migrations/20260730000002-add-goal-id-to-tasks.js` |
| Sequelize model | `/backend/models/goal.js` |
| Repository | `/backend/modules/goals/repository.js` |
| Service | `/backend/modules/goals/service.js` |
| Controller | `/backend/modules/goals/controller.js` |
| Routes | `/backend/modules/goals/routes.js` |
| MCP tools | `/backend/modules/mcp/tools/goalTools.js` |
| Frontend entity | `/frontend/entities/Goal.ts` |
| Frontend API client | `/frontend/utils/goalsService.ts` |
| Goals Zustand store | `/frontend/store/useStore.ts` (`goalsStore` slice) |
| Slug helper | `/frontend/utils/slugUtils.ts` (`createGoalUrl`) |
| Goal modal (create/edit) | `/frontend/components/Goal/GoalModal.tsx` |
| Goals list page | `/frontend/components/Goals.tsx` |
| Goal detail page | `/frontend/components/Goal/GoalDetails.tsx` |
| Sidebar section | `/frontend/components/Sidebar/SidebarGoals.tsx` |
| Task goal card | `/frontend/components/Task/TaskDetails/TaskGoalCard.tsx` |
| Goal dropdown component | `/frontend/components/Shared/GoalDropdown.tsx` |
| Area detail page | `/frontend/components/Area/AreaDetails.tsx` |
| Project modal (goal picker) | `/frontend/components/Project/ProjectModal.tsx` |

---

## MCP Tools

Goals are accessible via the MCP integration using five tools:

| Tool | Description |
|------|-------------|
| `list_goals` | List goals, optionally filtered by `area_id` or `status` |
| `get_goal` | Get a single goal by UID (includes linked tasks and projects) |
| `create_goal` | Create a new goal (`title` required; `area_id` is optional) |
| `update_goal` | Update title, why, horizon, target_date, area_id, or status |
| `delete_goal` | Delete a goal (linked projects and tasks become unlinked) |

See [MCP Integration](14-mcp-integration.md#goals-tools-5) for full parameter details.

---

## Related Documentation

- [Areas](07-areas.md) - Goals can optionally belong to areas; the Area detail page shows goals for that area
- [Projects](06-projects.md) - Projects carry `goal_id` and `is_maintenance` fields
- [Tasks Behavior](00-tasks-behavior.md) - Tasks carry their own `goal_id` for direct goal assignment
- [Tags System](09-tags-system.md) - Goal detail page follows the same section layout as the Tag detail page
- [Database & Migrations](database.md) - Migration workflow
- [Backend Patterns](backend-patterns.md) - Module structure followed by the goals module
- [MCP Integration](14-mcp-integration.md) - AI tool access to goals via Model Context Protocol

---

**Document Version:** 2.0.0
**Last Updated:** 2026-07-30
**Audience:** Developers and AI assistants
