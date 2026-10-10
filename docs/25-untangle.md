# Untangle

[← Back to Index](../CLAUDE.md)

---

## Overview

Untangle is the public page at `/untangle`. Anyone, signed in or not, pastes a messy list (or a screenshot of one, or talks it in) and about ten seconds later sees it organized the tududi way:

- **Areas**, each with an optional inferred **goal**
- **Projects** with 2 to 5 tasks, for anything that needs several steps
- Standalone items of four kinds: **task**, **waiting** (someone owes the person something, with the person named), **habit** (with period and times) and **someday**
- **Today**: the single best thing to do today and why
- **Drop for now**: one to three things that can wait
- **Your week**: seven days of load in minutes
- **Questions**, up to three, asked once; answering them all reshuffles the plan and nothing more is asked

**Keep it** writes the plan into an account. A signed-in person gets it immediately. A stranger has the plan parked in their browser, is sent to sign up, and the plan is applied on their first signed-in load, which also counts as the welcome page being seen so they land on Today.

Nothing is stored server-side until Keep it. The parsed result travels in a signed token (HMAC over the JSON, keyed by the session secret, valid for 7 days). The server only accepts back what it signed.

---

## Availability

| Setting | Default | Meaning |
|---|---|---|
| `TUDUDI_UNTANGLE_ENABLED` | on in hosted mode, off otherwise | Explicit override either way |
| `LLM_API_KEY` (+ `LLM_BASE_URL`, `LLM_MODEL`) | required | The `.env` provider; per-user keys are never used for anonymous calls |
| `LLM_VISION_MODEL` | falls back to `LLM_MODEL` | Model used when a screenshot is attached |
| `LLM_MAX_TOKENS_UNTANGLE` | 8000 | Completion budget; reasoning models think before answering |
| `TUDUDI_UNTANGLE_DAILY_CAP` | 500 | Parses per UTC day for the whole instance (in memory) |
| `RATE_LIMIT_UNTANGLE_WINDOW_MS` / `_MAX` | 1 hour / 8 | Parses per IP |

When it is off, or no provider is configured, `GET /api/untangle/status` and `POST /api/untangle/parse` answer 404 and the page shows "not available".

---

## API

### `GET /api/untangle/status` (public)

`{ "available": true }` or 404.

### `POST /api/untangle/parse` (public, rate limited)

```json
{
  "text": "call landlord re deposit!!\ncrete??\ngym x3",
  "image": "data:image/jpeg;base64,...",
  "timezone": "Europe/Athens",
  "language": "en",
  "answers": [{ "question": "Is Crete this month or someday?", "answer": "Someday" }]
}
```

`text` (up to 6000 chars) or `image` (PNG, JPEG or WebP data URL, up to 6 MB) is required. `answers` carries the person's replies to the questions, so answering re-runs the same parse with that context. A reply with answers never carries questions: one round only.

Response: `{ result, token }` where `result` is:

```json
{
  "today": { "title": "...", "reason": "..." },
  "drop": [{ "title": "...", "reason": "..." }],
  "questions": [{ "text": "...", "options": ["...", "..."] }],
  "areas": [{
    "name": "Home",
    "goal": { "title": "...", "why": "..." },
    "projects": [{ "name": "Taxes", "tasks": [{ "title": "...", "due": "2026-10-30", "minutes": 60 }] }],
    "items": [{ "title": "...", "kind": "waiting", "due": null, "person": "Maria", "minutes": 15, "habit_period": null, "habit_times": null }]
  }],
  "week": [{ "date": "2026-10-10", "weekday": "Sat", "minutes": 90, "titles": ["..."] }]
}
```

Errors: 400 for bad input, 429 over the per-IP limit, 503 at the daily cap, 502 `AI_NO_ANSWER` when the model returned nothing usable, 502 `AI_UNAVAILABLE` when the provider call failed (the provider's own message is logged, never returned).

### `POST /api/untangle/keep` (signed in)

`{ "token": "..." }` → `{ onboarding_starter, onboarded_at, created: { areas, goals, projects, tasks, habits, people } }`.

---

## What Keep it writes

All in one transaction, after the plan's project and task counts pass `entitlements.assertCanCreate`:

- Areas and projects are reused by name (case-insensitive); goals are reused only when the area's existing goal has the same title.
- Project tasks and plain tasks become `Task` rows with `due_date` (resolved in the user's timezone) and `estimated_minutes`.
- `waiting` items become tasks with `status: WAITING`, assigned to a `Person` found or created by name (`relationship_type: other`).
- `habit` items become habit tasks (`habit_mode`, `habit_target_count`, `habit_frequency_period`); an existing habit with the same name is skipped.
- `someday` items become tasks tagged `someday` with no date.
- `users.onboarding_starter` is set to `untangle` and `onboarded_at` filled when empty, so the welcome page is skipped.

Tasks carry no `example_of` mark: they are the person's real items.

---

## Frontend

- `frontend/components/Untangle/UntanglePage.tsx`: the page, outside the app layout, rendered for both signed-in and signed-out visitors (route in `App.tsx` next to `/public/notes` and `/blog`).
- `frontend/utils/untangleService.ts`: `isUntangleAvailable`, `untangle`, `keepUntangled`, and the pending-token helpers (`localStorage` key `untangle_pending`).
- `App.tsx`: `finishUntangle` (updates the current user and opens Today) and the effect that applies a pending token after login, holding the welcome redirect while it runs.
- `Register.tsx` shows a one-line notice when a plan is waiting in the browser.

Five sample lists (family week, side project, moving flat, exam season, job hunt) sit above the box for people who would rather not paste their own list on a phone they are being shown; a tap fills the box and the rest is the same.

Screenshots are downscaled to 1600px and sent as JPEG. Speech uses the browser's `SpeechRecognition` where available (Chrome, Safari); the button is hidden elsewhere.

---

## Backend

- `backend/modules/untangle/service.js`: the prompt, the strict JSON schema, input checks, sanitizing, week placement, the signed token and the daily cap.
- `backend/modules/untangle/seed.js`: Keep it.
- `backend/modules/untangle/routes.js`: `publicRoutes` (mounted before `requireAuth`) and `routes` (after).
- Tests: `backend/tests/integration/untangle.test.js` (provider mocked).

The model call goes through the AI assistant service's `getOpenAIClient(null)`, `callWithFallback` and `buildResponseFormat`, so provider quirks (`max_completion_tokens`, providers that reject `response_format`) are handled the same way as the briefs.
