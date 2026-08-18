# MCP Integration

This guide explains how to configure and use the Model Context Protocol (MCP) integration in Tududi to enable AI assistants to interact with your tasks, projects, notes, and inbox.

**Related:** [API Keys](08-user-management.md), [Architecture Overview](architecture.md)

---

## Table of Contents

- [Overview](#overview)
- [What is MCP?](#what-is-mcp)
- [Supported Clients](#supported-clients)
- [Configuration](#configuration)
    - [Prerequisites](#prerequisites)
    - [Quick Setup](#quick-setup)
- [Two Transport Modes](#two-transport-modes)
    - [Stdio Mode (Local)](#stdio-mode-local)
    - [HTTP Mode (Remote)](#http-mode-remote)
- [Available Tools](#available-tools)
    - [Tasks Tools (8)](#tasks-tools-8)
    - [Projects Tools (5)](#projects-tools-5)
    - [Inbox Tools (6)](#inbox-tools-6)
    - [Views Tools (5)](#views-tools-5)
    - [Goals Tools (5)](#goals-tools-5)
    - [Areas Tools (5)](#areas-tools-5)
    - [Notes Tools (5)](#notes-tools-5)
    - [Tags Tools (5)](#tags-tools-5)
    - [Habits Tools (9)](#habits-tools-9)
    - [People Tools (5)](#people-tools-5)
    - [Misc Tools (1)](#misc-tools-1)
- [Claude Desktop Setup](#claude-desktop-setup)
- [Cursor Setup](#cursor-setup)
- [VS Code + Continue Setup](#vs-code--continue-setup)
- [Other MCP Clients](#other-mcp-clients)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

---

## Overview

Tududi's MCP integration allows AI assistants (Claude, Cursor, VS Code extensions, etc.) to interact with your Tududi data using the [Model Context Protocol](https://modelcontextprotocol.io). This provides a standardized way for AI tools to read and modify your tasks, projects, inbox, and more.

**Key Features:**

- **59 Tools:** Complete CRUD operations for tasks, projects, inbox, views, goals, areas, notes, tags, habits, and people
- **Secure Authentication:** API token-based authentication with user isolation
- **Local or Remote:** Two transport modes for different use cases
- **Feature Flag:** Opt-in via `FF_ENABLE_MCP` to control availability
- **Frontend Configuration:** Web UI for generating client configurations

---

## History

MCP was introduced in Tududi [v1.0.0](https://github.com/chrisvel/tududi/pull/953) as a way to expose Tududi's data to AI assistants through the Model Context Protocol.

---

## What is MCP?

MCP (Model Context Protocol) is an open protocol developed by Anthropic that standardizes how AI applications connect to external data sources and tools. Think of it as a "USB-C port" for AI assistants — a universal connector that lets any MCP-compatible AI application interact with Tududi without custom integrations.

Tududi implements MCP as an MCP **Server**, exposing tools that AI clients can discover and call. This means:

- **AI sees Tududi as a set of tools** — like `list_tasks`, `create_task`, `search`, etc.
- **AI uses natural language** — "Show me my overdue tasks" triggers the `list_tasks` tool
- **AI can take action** — "Create a task for X" triggers `create_task`
- **All interactions are authenticated** — Your API token secures every connection

---

## Supported Clients

Tududi's MCP server works with any MCP-compatible client:

| Client                      | Transport     | Setup Complexity |
| --------------------------- | ------------- | ---------------- |
| **Claude Desktop**          | Stdio or HTTP | Easy             |
| **Cursor**                  | Stdio         | Easy             |
| **VS Code + Continue**      | Stdio         | Medium           |
| **Windsurf (Codeium)**      | Stdio         | Easy             |
| **Zed**                     | Stdio         | Medium           |
| **Any HTTP-capable client** | HTTP          | Medium           |

---

## Configuration

### Prerequisites

1. **Tududi installed and running** — v1.0.0 or later
2. **An API token** — Generate one at `Profile → API Keys`
3. **Feature flag enabled** — Set `FF_ENABLE_MCP=true` in your `.env`
4. **An MCP-compatible client** — Claude Desktop, Cursor, etc.

### Quick Setup

1. **Enable MCP:**

    ```bash
    # In your .env file
    FF_ENABLE_MCP=true
    ```

    Restart server/container if necessary

2. **Generate an API token:**
    - Navigate to `Profile → API Keys` in Tududi
    - Create a new token (keep it secure)

3. **Choose your transport mode:**
    - **Stdio:** For local Desktop/CLI client integration
    - **HTTP:** For remote access or Docker deployments

4. **Configure your client** — Use the configuration below

---

## Two Transport Modes

Tududi supports two transport modes for different deployment scenarios:

### Stdio Mode (Local)

**Use case:** Claude Desktop or Cursor running on the same machine as Tududi.

- **Authentication:** Via `TUDUDI_API_TOKEN` environment variable
- **Communication:** Direct process communication (stdio)
- **Performance:** Lowest latency
- **Setup:** Configure in your client's JSON config

**Best for:**

- Local development
- Single-machine Claude Desktop setup
- Direct CLI access

### HTTP Mode (Remote)

**Use case:** Remote Tududi server (Docker, cloud) accessed via HTTP.

- **Authentication:** Bearer token in Authorization header
- **Communication:** HTTP POST to `/api/mcp`
- **Protocol:** Streamable HTTP (stateless mode)
- **Setup:** Requires `mcp-remote` npm package

**Best for:**

- Docker deployments
- Cloud-hosted Tududi
- Remote Claude Desktop access
- Team environments

**HTTP Configuration Example:**

```json
{
    "mcpServers": {
        "tududi": {
            "command": "npx",
            "args": [
                "-y",
                "mcp-remote",
                "https://${TUDUDI_HOST}/api/mcp",
                "--header",
                "Authorization:Bearer ${TUDUDI_API_TOKEN}"
            ],
            "env": {
                "TUDUDI_API_TOKEN": "your-token-here",
                "TUDUDI_HOST": "tududi.yourdomain.tld"
            }
        }
    }
}
```

---

## Available Tools

Tududi exposes 59 MCP tools organized into 11 categories. All tools are scoped to the authenticated user — you can never access another user's data.

### Tasks Tools (8)

#### `list_tasks`

List tasks with optional filtering by type, status, or project.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `type` | string | No | — | Filter: `today`, `upcoming`, `completed`, `archived`, `all` |
| `status` | string | No | — | Filter: `pending`, `in_progress`, `completed`, `archived` |
| `project_id` | number | No | — | Filter by project ID |
| `limit` | number | No | 50 | Maximum tasks to return |

**Example:**

```json
{
    "type": "today",
    "limit": 20
}
```

**Returns:** Task objects with full details including project, tags, subtasks, and priority.

---

#### `get_task`

Get a single task by ID (number) or UID (string).

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number/string | Yes | Task ID or UID |

**Example:**

```json
{
    "id": "abc123"
}
```

---

#### `create_task`

Create a new task.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Task name |
| `description` | string | No | Task description/note |
| `priority` | string | No | `low`, `medium`, or `high` (default: `medium`) |
| `due_date` | string | No | ISO 8601 date |
| `defer_until` | string | No | ISO 8601 date/time; task is hidden from view until this point |
| `project_id` | number | No | Assign to a project |
| `tags` | string[] | No | Array of tag names to apply |
| `recurrence_type` | string | No | `none`, `daily`, `weekly`, `monthly`, `monthly_weekday`, or `monthly_last_day` |
| `recurrence_interval` | number | No | Repeat every N days/weeks/months (default: 1) |
| `recurrence_weekday` | number | No | Weekday for `weekly`/`monthly_weekday` recurrence (0=Sunday..6=Saturday) |
| `recurrence_weekdays` | number[] | No | Multiple weekdays for `weekly` recurrence, alternative to `recurrence_weekday` |
| `recurrence_month_day` | number | No | Day of month for `monthly` recurrence (1-31, or -1 for last day) |
| `recurrence_week_of_month` | number | No | Week of month for `monthly_weekday` recurrence (1-5, or -1 for last) |
| `recurrence_end_date` | string | No | Optional end date for the recurrence (ISO 8601); omit for indefinite recurrence |
| `completion_based` | boolean | No | If true, the next occurrence is scheduled from the completion date instead of the fixed schedule |

**Example:**

```json
{
    "name": "Review pull request #42",
    "description": "Check the MCP integration changes",
    "priority": "high",
    "due_date": "2026-04-27T17:00:00Z",
    "tags": ["code-review", "urgent"]
}
```

**Recurring task example:**

```json
{
    "name": "Take out the trash",
    "recurrence_type": "weekly",
    "recurrence_weekday": 2,
    "recurrence_interval": 1
}
```

---

#### `update_task`

Update an existing task.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number/string | Yes | Task ID or UID |
| `name` | string | No | New task name |
| `description` | string | No | New description |
| `priority` | string | No | `low`, `medium`, `high` |
| `status` | string | No | `pending`, `in_progress`, `completed`, `archived` |
| `due_date` | string | No | New due date (ISO 8601) |
| `defer_until` | string | No | New defer until date/time (ISO 8601); pass `null` or `""` to clear it |
| `project_id` | number | No | Reassign to a project (`null` to remove) |
| `today` | boolean | No | Add to Today list |
| `tags` | string[] | No | Array of tag names (replaces existing tags) |
| `recurrence_type` | string | No | `none`, `daily`, `weekly`, `monthly`, `monthly_weekday`, or `monthly_last_day` |
| `recurrence_interval` | number | No | Repeat every N days/weeks/months |
| `recurrence_weekday` | number | No | Weekday for `weekly`/`monthly_weekday` recurrence (0=Sunday..6=Saturday) |
| `recurrence_weekdays` | number[] | No | Multiple weekdays for `weekly` recurrence, alternative to `recurrence_weekday` |
| `recurrence_month_day` | number | No | Day of month for `monthly` recurrence (1-31, or -1 for last day) |
| `recurrence_week_of_month` | number | No | Week of month for `monthly_weekday` recurrence (1-5, or -1 for last) |
| `recurrence_end_date` | string | No | Optional end date for the recurrence (ISO 8601) |
| `completion_based` | boolean | No | If true, the next occurrence is scheduled from the completion date instead of the fixed schedule |

Any parameter not in the table above is rejected with an error rather than silently ignored.

**Example:**

```json
{
    "id": "abc123",
    "priority": "high",
    "status": "in_progress"
}
```

Changing recurrence fields on a task that already has future recurring instances regenerates those instances, the same way `PATCH /api/task/:uid` does.

---

#### `complete_task`

Toggle a task between completed and pending.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number/string | Yes | Task ID or UID |

**Example:**

```json
{
    "id": "abc123"
}
```

---

#### `delete_task`

Permanently delete a task.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number/string | Yes | Task ID or UID |

---

#### `add_subtask`

Add a subtask to a parent task.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `parent_id` | number/string | Yes | Parent task ID or UID |
| `name` | string | Yes | Subtask name |
| `priority` | string | No | `low`, `medium`, `high` |
| `due_date` | string | No | ISO 8601 date |

**Example:**

```json
{
    "parent_id": "xyz789",
    "name": "Write unit tests",
    "priority": "medium"
}
```

---

#### `get_task_metrics`

Get productivity metrics and task statistics.

**Parameters:** None

**Returns:**

```json
{
    "open_tasks": 12,
    "completed_tasks": 48,
    "overdue_tasks": 3,
    "in_progress_tasks": 5,
    "completed_today": 2,
    "completed_this_week": 11
}
```

---

### Projects Tools (5)

#### `list_projects`

List projects with optional filtering.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | — | Filter: `not_started`, `planned`, `in_progress`, `waiting`, `done`, `cancelled`, `all` |
| `area_id` | number | No | — | Filter by area ID |
| `limit` | number | No | 30 | Maximum projects to return |

---

#### `get_project`

Get a single project by UID.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Project UID |

---

#### `create_project`

Create a new project.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Project name |
| `description` | string | No | Project description |
| `priority` | number | No | 0=low, 1=medium, 2=high |
| `status` | string | No | `not_started`, `planned`, `in_progress`, `waiting`, `done`, `cancelled` |
| `area_id` | number | No | Parent area ID |
| `due_date_at` | string | No | Due date (ISO 8601) |
| `tags` | string[] | No | Array of tag names |

---

#### `update_project`

Update an existing project.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Project UID |
| `name` | string | No | New name |
| `description` | string | No | New description |
| `priority` | number | No | New priority |
| `status` | string | No | New status |
| `area_id` | number | No | New area ID |
| `pinned` | boolean | No | Pin to sidebar |

---

#### `delete_project`

Permanently delete a project and all its tasks (notes are orphaned).

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Project UID |

---

### Inbox Tools (6)

#### `list_inbox`

List inbox items. Only active items (not deleted, trashed, or processed) are returned by default.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | 20 | Maximum items |
| `offset` | number | No | 0 | Items to skip |
| `status` | string | No | — | Filter by a specific status (e.g. `added`, `processed`, `deleted`, `trashed`). Omit to return only active items. |

---

#### `add_to_inbox`

Add an item to the inbox.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `content` | string | Yes | — | Inbox content |
| `source` | string | No | `mcp` | Source identifier |

---

#### `get_inbox_item`

Get a single inbox item by ID.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Inbox item ID |

---

#### `update_inbox_item`

Update an existing inbox item.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Inbox item ID |
| `content` | string | No | New content |

---

#### `process_inbox_item`

Convert an inbox item into a task, note, or project.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Inbox item ID |
| `type` | string | Yes | `task`, `note`, or `project` |

---

#### `delete_inbox_item`

Delete an inbox item.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Inbox item ID |

---

### Views Tools (5)

#### `list_views`

List saved smart views (saved searches).

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `pinned_only` | boolean | No | `false` | Return only pinned views |

**Returns:** View objects with name, search query, filter config, and pin state.

---

#### `get_view`

Get a specific smart view by UID.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | View UID |

---

#### `create_view`

Create a new smart view (saved search).

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | View name |
| `search_query` | string | No | Text search query |
| `is_pinned` | boolean | No | Pin to sidebar (default: false) |
| `priority` | string | No | Priority filter: `low`, `medium`, `high` |
| `due` | string | No | Due date filter (e.g. `today`, `this_week`) |
| `tags` | string[] | No | Tag filters |

**Example:**

```json
{
    "name": "High priority this week",
    "priority": "high",
    "due": "this_week",
    "is_pinned": true
}
```

---

#### `update_view`

Update an existing smart view.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | View UID |
| `name` | string | No | New name |
| `search_query` | string | No | New search query |
| `is_pinned` | boolean | No | Pin or unpin from sidebar |
| `priority` | string | No | New priority filter |
| `due` | string | No | New due date filter |
| `tags` | string[] | No | New tag filters |

---

#### `delete_view`

Delete a smart view.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | View UID |

---

### Goals Tools (5)

#### `list_goals`

List goals with optional filtering by area or status.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `area_id` | number | No | — | Filter by area ID |
| `status` | string | No | `all` | Filter: `active`, `achieved`, `paused`, `dropped`, `all` |

**Returns:** Goal objects with title, why, horizon, status, target date, and linked area.

---

#### `get_goal`

Get a single goal by UID.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Goal UID |

---

#### `create_goal`

Create a new goal within an area.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Goal title |
| `area_id` | number | Yes | Parent area ID |
| `why` | string | No | Motivation behind the goal |
| `horizon` | string | No | `season` or `year` (default: `season`) |
| `target_date` | string | No | Target date (YYYY-MM-DD) |
| `status` | string | No | `active`, `achieved`, `paused`, `dropped` (default: `active`) |

**Example:**

```json
{
    "title": "Ship the mobile app",
    "area_id": 3,
    "why": "Expand reach to users who prefer mobile",
    "horizon": "season",
    "target_date": "2026-09-30"
}
```

---

#### `update_goal`

Update an existing goal.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Goal UID |
| `title` | string | No | New title |
| `why` | string | No | New motivation text |
| `horizon` | string | No | `season` or `year` |
| `target_date` | string | No | New target date or empty string to clear |
| `status` | string | No | `active`, `achieved`, `paused`, `dropped` |

---

#### `delete_goal`

Delete a goal. Linked projects become unlinked (their `goal_id` is set to null).

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Goal UID |

---

### Areas Tools (5)

#### `list_areas`

List all organizational areas. No parameters.

---

#### `get_area`

Get a specific area by UID.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Area UID |

---

#### `create_area`

Create a new organizational area.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Area name |
| `description` | string | No | Optional description |
| `color` | string | No | Hex color (e.g. `#ff6b6b`) |

---

#### `update_area`

Update an existing area.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Area UID |
| `name` | string | No | New name |
| `description` | string | No | New description |
| `color` | string | No | New hex color or empty string to remove |

---

#### `delete_area`

Delete an area. Projects are orphaned, not deleted.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Area UID |

---

### Notes Tools (5)

#### `list_notes`

List notes with optional filtering. No required parameters.

---

#### `get_note`

Get a specific note by UID.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Note UID |

---

#### `create_note`

Create a new note.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Note title |
| `content` | string | No | Note body (Markdown supported) |
| `project_id` | number | No | Link to a project |
| `tags` | string[] | No | Array of tag names |

---

#### `update_note`

Update an existing note.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Note UID |
| `title` | string | No | New title |
| `content` | string | No | New content |

---

#### `delete_note`

Delete a note permanently.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Note UID |

---

### Tags Tools (5)

#### `list_tags`

List all tags. No parameters.

---

#### `get_tag`

Get a specific tag by ID.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Tag ID |

---

#### `create_tag`

Create a new tag.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Tag name |

---

#### `update_tag`

Rename a tag.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Tag ID |
| `name` | string | Yes | New tag name |

---

#### `delete_tag`

Delete a tag. Removes it from all entities.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Tag ID |

---

### Habits Tools (9)

#### `list_habits`

List all habits. No required parameters.

---

#### `get_habit`

Get a specific habit by UID.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Habit UID |

---

#### `create_habit`

Create a new habit.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Habit name |
| `frequency` | string | No | Recurrence pattern |

---

#### `update_habit`

Update an existing habit.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Habit UID |
| `name` | string | No | New name |

---

#### `delete_habit`

Delete a habit and all its completions.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Habit UID |

---

#### `log_habit_completion`

Record a completion entry for a habit.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Habit UID |
| `completed_at` | string | No | ISO 8601 datetime (defaults to now) |

---

#### `get_habit_completions`

Get completion history for a habit.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Habit UID |

---

#### `delete_habit_completion`

Remove a specific completion entry.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Completion ID |

---

#### `get_habit_stats`

Get aggregated statistics for a habit.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Habit UID |

---

### People Tools (5)

#### `list_people`

List people (contacts) with optional filtering.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `archived` | boolean | No | `false` | Include archived contacts |
| `relationship_type` | string | No | — | Filter by type: `colleague`, `friend`, `family`, `other` |
| `sort` | string | No | `name` | Sort order: `name` or `created_at` |

**Returns:** Contact objects with name, email, phone, relationship type, notes, and color.

---

#### `get_person`

Get a specific person by UID, including their assigned task count.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Person UID |

---

#### `create_person`

Create a new person/contact.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Full name |
| `email` | string | No | Email address |
| `phone` | string | No | Phone number |
| `relationship_type` | string | No | `colleague`, `friend`, `family`, `other` (default: `other`) |
| `notes` | string | No | Free-text notes |
| `color` | string | No | Hex color (e.g. `#4f9ef8`) |

**Example:**

```json
{
    "name": "Alice Smith",
    "email": "alice@example.com",
    "relationship_type": "colleague",
    "color": "#4f9ef8"
}
```

---

#### `update_person`

Update an existing person/contact.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Person UID |
| `name` | string | No | New name |
| `email` | string | No | New email |
| `phone` | string | No | New phone |
| `relationship_type` | string | No | New relationship type |
| `notes` | string | No | New notes |
| `color` | string | No | New hex color or empty string to remove |
| `archived` | boolean | No | Archive or unarchive |

---

#### `delete_person`

Permanently delete a person/contact.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Person UID |

---

### Misc Tools (1)

#### `search`

Universal search across tasks, projects, and notes.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search query |
| `type` | string | No | `all` | `task`, `project`, `note`, `all` |
| `limit` | number | No | 10 | Max results per type |

---

## Claude Desktop Setup

### Step 1: Generate an API Token

1. Log into Tududi
2. Navigate to `Profile → API Keys`
3. Click "Generate New Token"
4. Copy and securely store the token

### Step 2: Configure Claude Desktop

#### For Stdio (Local Tududi):

1. Set your environment variable:

    ```bash
    export TUDUDI_API_TOKEN="your-token-here"
    ```

2. Edit your Claude Desktop config file:
    - **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
    - **Linux:** `~/.config/claude/claude_desktop_config.json`

3. Add the Tududi server:
    ```json
    {
        "mcpServers": {
            "tududi": {
                "command": "node",
                "args": ["/path/to/tududi/backend/modules/mcp/server.js"],
                "env": {
                    "TUDUDI_API_TOKEN": "your-token-here"
                }
            }
        }
    }
    ```

4. Restart Claude Desktop. Tududi tools will appear in the tool list.

#### For HTTP (Remote Tududi):

Use `mcp-remote` to proxy HTTP requests — see the [HTTP Mode config above](#http-mode-remote).

---

## Cursor Setup

1. **Generate an API token** — see [Step 1 above](#step-1-generate-an-api-token).

2. Create or edit `~/.cursor/mcp.json`:

    ```json
    {
        "mcpServers": {
            "tududi": {
                "command": "node",
                "args": ["/path/to/tududi/backend/modules/mcp/server.js"],
                "env": {
                    "TUDUDI_API_TOKEN": "your-token-here"
                }
            }
        }
    }
    ```

3. Restart Cursor and open a new chat. Tududi tools will appear in the tool list.

For remote Tududi, use the HTTP transport config from [HTTP Mode](#http-mode-remote) instead.

---

## VS Code + Continue Setup

The [Continue](https://www.continue.dev/) extension adds MCP support to VS Code.

1. Install the Continue extension from the VS Code marketplace.

2. Open `~/.continue/config.json` and add:

    ```json
    {
        "mcpServers": [
            {
                "name": "tududi",
                "command": "node",
                "args": ["/path/to/tududi/backend/modules/mcp/server.js"],
                "env": {
                    "TUDUDI_API_TOKEN": "your-token-here"
                }
            }
        ]
    }
    ```

3. Reload the Continue extension. Tududi tools will be available in the Continue chat panel.

---

## Other MCP Clients

Tududi's MCP server is compatible with any MCP SDK implementation. For custom integrations:

### Direct HTTP API

You can interact with Tududi's MCP server directly via HTTP:

**List available tools:**

```bash
curl -X GET http://tududi.yourdomain.com/api/mcp/tools \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Get MCP config:**

```bash
curl -X GET http://tududi.yourdomain.com/api/mcp/config \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Call a tool:**

```bash
curl -X POST http://tududi.yourdomain.com/api/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "list_tasks",
      "arguments": { "type": "today", "limit": 10 }
    }
  }'
```

### SDK Usage

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({ name: 'my-app', version: '1.0.0' });

// Connect to HTTP transport
await client.connect({
    url: 'http://tududi.yourdomain.com/api/mcp',
    headers: {
        Authorization: 'Bearer YOUR_TOKEN',
    },
});

// List available tools
const tools = await client.listTools();

// Call a tool
const result = await client.callTool({
    name: 'create_task',
    arguments: {
        name: 'New task from SDK',
        priority: 'high',
    },
});
```

---

## Security

### Authentication

- All MCP tools authenticate via API tokens
- Tokens are scoped to a single user — no cross-user data access
- Tokens can be revoked at any time from `Profile → API Keys`
- HTTP mode uses Bearer token in the `Authorization` header

### Feature Flag

MCP is behind a feature flag (`FF_ENABLE_MCP`). This means:

- **Opt-in only:** Administrators must explicitly enable MCP by setting `FF_ENABLE_MCP=true`.
- **Token required:** Each user must generate their own API token to use the MCP tools.

### Data Isolation

Every MCP tool query includes `user_id` filtering:

- Task queries: Only the authenticated user's tasks
- Project queries: Only the authenticated user's projects
- Search queries: Only the authenticated user's data across entities

---

## Troubleshooting

### "Invalid or expired API token"

**Cause:** The token has expired or been revoked.

**Fix:**

1. Go to `Profile → API Keys`
2. Generate a new token
3. Update your MCP client configuration

### "MCP feature is not enabled"

**Cause:** The feature flag is not set.

**Fix:**

```bash
# In your .env file
FF_ENABLE_MCP=true
# Restart Tududi
```

### HTTP Connection Refused

**Cause:** Tududi server is not accessible.

**Checklist:**

1. Verify Tududi is running and accessible at the configured URL
2. Check firewall settings for remote deployments
3. Verify SSL certificates for HTTPS connections
4. Check CORS settings if using browser-based MCP clients

### Tool Returns Empty Results

**Cause:** No data matches the query parameters.

**Fix:**

1. Verify the task/project/inbox has data
2. Check the filter parameters (e.g., `type`, `status`)
3. Try with broader parameters first, then narrow down

### Claude Doesn't Show Tududi Tools

**Cause:** Claude Desktop may not have refreshed its tool list.

**Fix:**

1. Restart Claude Desktop completely
2. In Claude settings, verify the MCP server shows as "Connected"
3. Ask Claude: "What tools do you have available?"

### Docker Deployment Issues

**Problem:** MCP doesn't work in Docker.

**Solutions:**

- **Stdio mode:** Not recommended for Docker — use HTTP mode instead
- **HTTP mode:** Ensure Tududi is accessible from outside the container:
    ```yaml
    # docker-compose.yml example
    services:
        tududi:
            ports:
                - '3002:3002'
            environment:
                - FF_ENABLE_MCP=true
                - BACKEND_URL=http://tududi.yourdomain.com:3002
    ```

---

## Architecture Notes

### How It Works

```
┌─────────────┐     MCP Protocol     ┌──────────────┐
│   AI Client  │ ◄──────────────────► │  Tududi MCP  │
│ (Claude,     │   Tool Calls         │   Server     │
│  Cursor, etc) │                    │              │
└─────────────┘                      └──────┬───────┘
                                            │
                                    ┌───────┴───────┐
                                    │  Authentication │
                                    │  (API Token)    │
                                    └───────┬───────┘
                                            │
                                    ┌───────┴───────┐
                                    │   Tududi DB    │
                                    │  (SQLite)      │
                                    └───────────────┘
```

### File Structure

| File                                          | Purpose                       |
| --------------------------------------------- | ----------------------------- |
| `backend/modules/mcp/server.js`               | Stdio MCP server entry point  |
| `backend/modules/mcp/httpTransport.js`        | HTTP transport handler        |
| `backend/modules/mcp/toolRegistry.js`         | Registers all tool categories |
| `backend/modules/mcp/tools/taskTools.js`      | Task tools (8)                |
| `backend/modules/mcp/tools/projectTools.js`   | Project tools (5)             |
| `backend/modules/mcp/tools/inboxTools.js`     | Inbox tools (6)               |
| `backend/modules/mcp/tools/viewTools.js`      | Smart view tools (5)          |
| `backend/modules/mcp/tools/goalTools.js`      | Goal tools (5)                |
| `backend/modules/mcp/tools/areaTools.js`      | Area tools (5)                |
| `backend/modules/mcp/tools/noteTools.js`      | Note tools (5)                |
| `backend/modules/mcp/tools/tagTools.js`       | Tag tools (5)                 |
| `backend/modules/mcp/tools/habitTools.js`     | Habit tools (9)               |
| `backend/modules/mcp/tools/peopleTools.js`    | People/contact tools (5)      |
| `backend/modules/mcp/tools/miscTools.js`      | Search tool (1)               |
| `backend/modules/mcp/middleware.js`           | API token authentication      |
| `backend/modules/mcp/controller.js`           | REST API endpoints            |
| `backend/modules/mcp/routes.js`               | Express route definitions     |
| `frontend/components/Profile/tabs/McpTab.tsx` | Web UI for config             |

---

- **Document Version:** 1.1.0
- **Last Updated:** 2026-07-27
- **Minimum Tududi Version:** v1.0.0 (released 2026-03-27)
