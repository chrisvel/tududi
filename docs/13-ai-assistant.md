# AI Assistant

[← Back to Index](../CLAUDE.md)

---

## Overview

The AI Assistant adds three context-aware intelligence features to Tududi:

1. **Daily Brief** — a morning summary with a focus task, top priority actions, and risk flags
2. **Task Insights** — domain-level analysis, next steps, and useful links for a specific task
3. **Project Insights** — health assessment, next action, and risk flags for a specific project

All three features call the OpenAI API (`gpt-4o-mini`) and cache results in the database. Results persist until the user explicitly regenerates them.

---

## Setup

Set the `OPENAI_API_KEY` environment variable before starting the server:

```bash
# .env or Docker environment
OPENAI_API_KEY=sk-...
```

Without this key, all AI Assistant endpoints return HTTP 500.

---

## Architecture

```
frontend/
  components/AI/
    DailyAssistant.tsx         # Daily brief widget on Today page
    TaskAIInsights.tsx         # Insights panel on task detail view
    ProjectAIInsights.tsx      # Insights panel on project detail view
  utils/aiAssistantService.ts  # Typed API client for all AI endpoints

backend/modules/ai-assistant/
  routes.js      # Express route definitions
  controller.js  # Request handlers, auth checks
  service.js     # OpenAI client, prompt building, caching logic
```

---

## Features

### Daily Brief

Appears on the Today page inside the `DailyAssistant` component. Generates once and caches the result for that day.

**What it returns:**

```json
{
  "focus": "Short phrase naming the single most important task today",
  "priority_actions": [
    {
      "action": "Exact task name",
      "project": "Project name or null",
      "reason": "Why this matters now (≤6 words)",
      "suggestion": "Specific motivating next step (≤12 words)"
    }
  ],
  "watch_out": ["At-risk task or project name"],
  "generated_at": "ISO timestamp",
  "model": "gpt-4o-mini",
  "usage": { "prompt_tokens": 0, "completion_tokens": 0 }
}
```

**Context sent to the model:** active goals, active projects, today's task breakdown (overdue, in-progress, planned, suggested), weekly completion trend.

**Caching:** stored in `users.ai_daily_brief` and `users.ai_daily_brief_date`. `GET /api/ai-assistant/daily-brief` returns the cache; `POST` regenerates it.

---

### Task Insights

Appears in the task detail panel. Generated on demand and cached per task.

**What it returns:**

```json
{
  "insight": "Domain-level explanation of what the task involves",
  "next_step": "Concrete first action with a real example",
  "breakdown": ["Step 1", "Step 2", "Step 3"],
  "links": [{ "label": "Display name", "url": "https://..." }],
  "watch_out": "Specific risk or dependency, or null",
  "generated_at": "ISO timestamp",
  "dismissed": false
}
```

**Context sent to the model:** task name, status, priority, due date, tags, subtask count, notes (truncated to 300 chars), project name, project status, area, goal, and project description (truncated to 200 chars).

**Caching:** stored in `tasks.ai_insights`. `GET /api/ai-assistant/task-insights/:taskUid` returns the cache; `POST /api/ai-assistant/task-insights` regenerates it.

**Dismissing:** `PATCH /api/ai-assistant/task-insights/:taskUid/dismissed` with `{ "dismissed": true }` hides the panel without deleting the cached data.

---

### Project Insights

Appears in the project detail panel. Generated on demand and cached per project.

**What it returns:**

```json
{
  "insight": "Domain-level explanation of what the project is about",
  "next_action": "Most concrete next step to advance the project",
  "health": "Honest assessment referencing actual task numbers",
  "watch_out": "Specific risk or null",
  "generated_at": "ISO timestamp",
  "dismissed": false
}
```

**Context sent to the model:** project name, status, priority, due date, area, goal, description (truncated to 300 chars), total/open/completed/in-progress task counts, overdue task count.

**Caching:** stored in `projects.ai_insights`. `GET /api/ai-assistant/project-insights/:projectUid` returns the cache; `POST /api/ai-assistant/project-insights` regenerates it.

**Dismissing:** `PATCH /api/ai-assistant/project-insights/:projectUid/dismissed` with `{ "dismissed": true }` hides the panel.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ai-assistant/daily-brief` | Return cached daily brief (or null) |
| `POST` | `/api/ai-assistant/daily-brief` | Generate and cache a new daily brief |
| `GET` | `/api/ai-assistant/task-insights/:taskUid` | Return cached task insights (or null) |
| `POST` | `/api/ai-assistant/task-insights` | Generate task insights (body: `TaskInsightsRequest`) |
| `PATCH` | `/api/ai-assistant/task-insights/:taskUid/dismissed` | Set `dismissed` flag on task insights |
| `GET` | `/api/ai-assistant/project-insights/:projectUid` | Return cached project insights (or null) |
| `POST` | `/api/ai-assistant/project-insights` | Generate project insights (body: `ProjectInsightsRequest`) |
| `PATCH` | `/api/ai-assistant/project-insights/:projectUid/dismissed` | Set `dismissed` flag on project insights |

All endpoints require an authenticated session. Unauthenticated requests return `401`.

---

## Model and Provider

| Setting | Value |
|---------|-------|
| Provider | OpenAI |
| Model | `gpt-4o-mini` |
| Environment variable | `OPENAI_API_KEY` |

The client is initialized in `service.js:getOpenAIClient()`. Switching models or providers requires updating that function and the three `chat.completions.create` calls in the same file.

---

## Caching Strategy

| Feature | Storage column | Cache key |
|---------|----------------|-----------|
| Daily Brief | `users.ai_daily_brief`, `users.ai_daily_brief_date` | User ID (one brief per user per day) |
| Task Insights | `tasks.ai_insights` | Task UID |
| Project Insights | `projects.ai_insights` | Project UID |

Cached values are JSON objects stored as TEXT. The `generated_at` timestamp is included in each cached object.

---

## Adding a New AI Feature

1. Add a new function in `service.js` that builds a prompt and calls `client.chat.completions.create()`
2. Add a controller method in `controller.js` with auth check and error delegation via `next(error)`
3. Register the route in `routes.js`
4. Add the typed API client function to `frontend/utils/aiAssistantService.ts`
5. Create or update a React component under `frontend/components/AI/`
