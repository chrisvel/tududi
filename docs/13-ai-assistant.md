# AI Assistant

[← Back to Index](../CLAUDE.md)

---

## Overview

The AI Assistant adds three context-aware intelligence features to Tududi:

1. **Daily Brief**: a morning summary with a focus task, top priority actions, and risk flags
2. **Task Insights**: domain-level analysis, next steps, and useful links for a specific task
3. **Project Insights**: health assessment, next action, and risk flags for a specific project

All three features call an OpenAI-compatible API and cache results in the database. Results persist until the user explicitly regenerates them.

---

## Setup

### Required

Set an API key before starting the server. Use the generic `LLM_API_KEY` for any provider, or `OPENAI_API_KEY` if you're using OpenAI directly (both are supported; `LLM_API_KEY` takes precedence):

```bash
# Generic: works with any provider
LLM_API_KEY=sk-...

# OpenAI legacy name: still works as a fallback
OPENAI_API_KEY=sk-...
```

Without a key, the generation endpoints return HTTP `503` with `{ "error": "AI assistant is not configured...", "code": "AI_NOT_CONFIGURED" }`. `GET /api/ai-assistant/config` still responds with `api_key_set: false`, and the frontend uses it to skip auto-generation and show a calm "AI is not configured" state instead of an error.

### Optional: custom provider or model

The service uses the [OpenAI Node.js SDK](https://github.com/openai/openai-node), which is compatible with any provider that implements the OpenAI chat completions API (Ollama, LM Studio, Groq, Azure OpenAI, etc.).

```bash
# Base URL of the provider (defaults to OpenAI)
LLM_BASE_URL=http://localhost:11434/v1  # e.g. local Ollama
# OPENAI_BASE_URL is still accepted as a fallback

# Model name the provider expects (defaults to gpt-4o-mini)
LLM_MODEL=llama3.2
# TUDUDI_AI_MODEL is still accepted as a fallback
```

> **Note on reasoning models:** reasoning models (e.g. DeepSeek-R1, o1-mini) consume hidden tokens before producing output. The daily brief allows up to 1500 completion tokens to accommodate this; task and project insights allow 1000 and 600 respectively. If a reasoning model still exhausts its budget before writing the final answer (cached result comes back with empty fields and `usage.completion_tokens` pinned at the cap), raise the relevant limit below rather than switching models.

### Optional: per-feature token limits

Each feature's `max_tokens` cap can be overridden independently. Unset falls back to the defaults noted above:

```bash
LLM_MAX_TOKENS_DAILY_BRIEF=1500       # default 1500
LLM_MAX_TOKENS_TASK_INSIGHTS=1000     # default 1000
LLM_MAX_TOKENS_PROJECT_INSIGHTS=600   # default 600
```

Non-numeric or non-positive values are ignored and fall back to the default.

### Optional: skip the thinking phase

Some reasoning models keep spending tokens on hidden reasoning no matter how high `max_tokens` is raised. If your provider supports it (e.g. Qwen3 served via vLLM), set:

```bash
LLM_DISABLE_THINKING=true
```

This sends `chat_template_kwargs: { enable_thinking: false }` on every request. It's opt-in and off by default — some OpenAI-compatible servers reject unrecognized body fields, so only enable this if your provider documents support for it.

### Reasoning-field fallback

A small number of reasoning-parser configurations put the model's answer — not just its chain-of-thought — into `message.reasoning` or `message.reasoning_content` instead of `message.content`. tududi reads `content` first and falls back to `reasoning_content`, then `reasoning`, so these configurations still work without `LLM_DISABLE_THINKING`. If none of the three fields contain anything, the feature returns its empty-state defaults rather than erroring.

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
  service.js     # API client, prompt building, caching logic
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
  "model": "model name echoed from API response",
  "usage": { "prompt_tokens": 0, "completion_tokens": 0 }
}
```

**Context sent to the model:** active goals, active projects, today's task breakdown (overdue, in-progress, planned, suggested), weekly completion trend, and the user's "About You" profile text (if set).

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

| Setting | Primary variable | Fallback variable | Default |
|---------|-----------------|-------------------|---------|
| API key | `LLM_API_KEY` | `OPENAI_API_KEY` | (required) |
| Base URL | `LLM_BASE_URL` | `OPENAI_BASE_URL` | OpenAI (`https://api.openai.com/v1`) |
| Model | `LLM_MODEL` | `TUDUDI_AI_MODEL` | `gpt-4o-mini` |
| Daily Brief max tokens | `LLM_MAX_TOKENS_DAILY_BRIEF` | — | `1500` |
| Task Insights max tokens | `LLM_MAX_TOKENS_TASK_INSIGHTS` | — | `1000` |
| Project Insights max tokens | `LLM_MAX_TOKENS_PROJECT_INSIGHTS` | — | `600` |

The client is initialized in `service.js:getOpenAIClient()`. Any provider that speaks the OpenAI chat completions protocol works: set `LLM_BASE_URL` to the provider's endpoint and `LLM_MODEL` to the model name that provider expects.

All three LLM calls request `response_format: { type: 'json_object' }` for structured output. If your backend does not support this parameter, the response parser will still attempt to extract JSON from raw text (including code-fenced output).

---

## User Profile Context

Users can set an "About You" text in **Profile → Features → Intelligence → About You**. This text is injected into the daily brief prompt as an `## About This User` section, allowing the AI to tailor its language and framing to the user's actual domain (e.g. academic research, healthcare, design) rather than defaulting to software development metaphors.

The field is stored in `users.ai_profile` (TEXT, max 500 chars in the UI).

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

1. Add a new function in `service.js` that builds a prompt and calls `client.chat.completions.create()`, using `getAIModel()` for the model name and `response_format: { type: 'json_object' }` for structured output
2. Add a controller method in `controller.js` with auth check and error delegation via `next(error)`
3. Register the route in `routes.js`
4. Add the typed API client function to `frontend/utils/aiAssistantService.ts`
5. Create or update a React component under `frontend/components/AI/`
