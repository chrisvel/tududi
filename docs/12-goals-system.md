# Goals System - Behavior Rules

This document explains how goals work in tududi. For technical details see `/backend/modules/goals/` and `/frontend/components/Area/AreaDetails.tsx`.

---

## Overview

**Goals** are outcome-level intentions that sit between Areas and Projects in the organizational hierarchy. They answer *why* a group of projects exists, give projects a destination to aim at, and make it easy to see whether your active work is moving toward something meaningful.

**Hierarchy position:**
```
Areas (life domains)
  └── Goals (season- or year-scale outcomes)
        └── Projects (specific initiatives)
              └── Tasks (actionable items)
```

**Key characteristics:**
- Belong to exactly one Area
- Have a time horizon: `season` or `year`
- Have a status lifecycle: `active → achieved / paused / dropped`
- Projects can be linked to a goal, flagged as maintenance, or left unlinked
- Managed entirely from the Area detail page - no separate Goals page

---

## Goal Properties

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | yes | The outcome statement. Max 255 chars. |
| `why` | text | no | The motivation behind the goal. Displayed in italics under the title. |
| `horizon` | enum | yes | `season` or `year`. Default: `season`. |
| `target_date` | date | no | Optional deadline for the goal. |
| `status` | enum | yes | `active`, `achieved`, `paused`, `dropped`. Default: `active`. |
| `area_id` | integer | yes | The parent area. Cannot be changed after creation. |
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

There is no enforced ordering - any status can move to any other.

### Creating a goal

1. Navigate to an Area detail page (`/area/:uid-slug`)
2. Click **Add goal** next to the Goals heading
3. Fill in the inline form:
   - Title (required)
   - Why (optional, displayed as context)
   - Horizon (`season` / `year`)
   - Status (defaults to `active`)
   - Target date (optional)
4. Click **Add goal** to save

### Editing a goal

Click the pencil icon on any goal row. The same inline form opens, pre-filled. Click **Update** to save.

### Deleting a goal

Click the trash icon. A confirmation prompt warns that linked projects will become unlinked. The goal record is deleted; projects that referenced it have their `goal_id` set to `null` (they become "unlinked" projects in the Area view).

---

## Scarcity Rule

The Area detail page displays a warning banner when an area has **more than 5 active goals**. The message encourages the user to achieve or pause one before adding more. This is a soft nudge, not an enforced limit.

---

## Project–Goal Relationship

Each project in an area can be in one of three states relative to goals:

| State | `goal_id` | `is_maintenance` | Meaning |
|-------|-----------|------------------|---------|
| Linked to goal | set | false | Project is working toward a specific goal |
| Maintenance | null | true | Project keeps something running - not goal-directed |
| Unlinked | null | false | Project not yet assigned to a goal or maintenance |

### Linking a project to a goal

From the Area detail page, unlinked projects show a **link…** button. Clicking it opens an inline picker:
1. Select a goal from the dropdown (only active goals shown)
2. Click **Link** to save - or click **Maintenance** to mark it as maintenance instead
3. The project moves out of the "Unlinked" bucket immediately

From the Project modal (when editing a project):
1. Expand the **Goal** section (flag icon in toolbar)
2. An area must already be selected - goals are fetched for that area
3. Choose from: No goal / Maintenance / active goals / inactive goals
4. Save the project

### Unlinking

Deleting the goal sets `goal_id` to `null` on all its projects. To manually unlink a project, open the project modal → Goal section → select **No goal**.

---

## Area Detail Page Layout

The Area detail page (`/area/:uid-slug`) is the primary interface for goals. It has a two-column layout:

```
┌─────────────────────────────────────┐
│  Area header (name, description,    │
│  stats: projects / tasks / goals)   │
└─────────────────────────────────────┘
┌─────────────────┐  ┌────────────────┐
│  Goals column   │  │  Tasks column  │
│  (1/3 width)    │  │  (2/3 width)   │
│                 │  │                │
│  [Add goal]     │  │  Active tasks  │
│                 │  │  Completed     │
│  ● Goal A       │  │  tasks         │
│    PROJECTS     │  │                │
│    ┌──────────┐ │  │                │
│    │ Project 1│ │  │                │
│    └──────────┘ │  │                │
│                 │  │                │
│  ● Goal B       │  │                │
│    No projects  │  │                │
│    linked       │  │                │
│                 │  │                │
│  🔧 Maintenance │  │                │
│    PROJECTS     │  │                │
│    ┌──────────┐ │  │                │
│    │ Project 2│ │  │                │
│    └──────────┘ │  │                │
│                 │  │                │
│  › Unlinked (1) │  │                │
│                 │  │                │
│  ▼ Inactive (2) │  │                │
└─────────────────┘  └────────────────┘
```

**Buckets in the Goals column (in order):**
1. **Active goals** - each with its project cards underneath
2. **Maintenance** - projects flagged `is_maintenance = true`
3. **Unlinked** - projects with no goal and no maintenance flag
4. **Inactive goals** - collapsed under a `<details>` element; shows `achieved`, `paused`, `dropped` goals

**Project cards** show:
- A left-colored border using the project's color
- A "PROJECTS" label above the card group
- Project name (links to project detail)

---

## API Reference

All endpoints require authentication. Responses are scoped to the current user.

### List goals

```
GET /api/goals
GET /api/goals?area_id=:id
```

Returns `{ goals: Goal[] }`. Pass `area_id` to filter to a single area.

### Get goal

```
GET /api/goals/:uid
```

Returns `{ goal: Goal }`.

### Create goal

```
POST /api/goals
Body: { title, area_id, why?, horizon?, target_date?, status? }
```

Returns `{ goal: Goal, active_goals_count: number }`.

**Validation:**
- `title` required, non-empty
- `area_id` required

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

Returns 204. Projects referencing this goal have `goal_id` set to `null`.

---

## Database Schema

### `goals` table

```sql
id          INTEGER  PRIMARY KEY AUTOINCREMENT
uid         STRING   UNIQUE NOT NULL
area_id     INTEGER  NOT NULL  → areas.id  CASCADE DELETE
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

### Project columns added by this feature

```sql
goal_id        INTEGER  → goals.id  SET NULL on delete
is_maintenance BOOLEAN  DEFAULT false
```

**Index:** `projects.goal_id`

---

## Technical Implementation

| Layer | File |
|-------|------|
| Migration (goals table) | `/backend/migrations/20260624000001-create-goals.js` |
| Migration (project columns) | `/backend/migrations/20260624000002-add-goal-columns-to-projects.js` |
| Sequelize model | `/backend/models/goal.js` |
| Repository | `/backend/modules/goals/repository.js` |
| Service | `/backend/modules/goals/service.js` |
| Controller | `/backend/modules/goals/controller.js` |
| Routes | `/backend/modules/goals/routes.js` |
| Frontend entity | `/frontend/entities/Goal.ts` |
| Frontend API client | `/frontend/utils/goalsService.ts` |
| Goal dropdown component | `/frontend/components/Shared/GoalDropdown.tsx` |
| Area detail page (primary UI) | `/frontend/components/Area/AreaDetails.tsx` |
| Project modal (goal picker) | `/frontend/components/Project/ProjectModal.tsx` |

---

## Related Documentation

- [Areas](07-areas.md) - Goals live inside areas; the Area detail page is the main goals UI
- [Projects](06-projects.md) - Projects carry `goal_id` and `is_maintenance` fields
- [Database & Migrations](database.md) - Migration workflow
- [Backend Patterns](backend-patterns.md) - Module structure followed by the goals module

---

**Document Version:** 1.0.0
**Last Updated:** 2026-06-24
**Audience:** Developers and AI assistants
