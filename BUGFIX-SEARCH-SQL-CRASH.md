# Bugfix: MCP `search` Tool Crashes with `type: "all"`

## 1. Problem

The MCP `search` tool crashes with a SQL error when called with `type: "all"` (the default) or `type: "note"`:

```
SQLITE_ERROR: no such column: Note.name
```

**Impact:** AI agents calling the MCP search tool via the default `type: "all"` parameter will always crash. This blocks any workflow that depends on searching across tasks, projects, and notes.

---

## 2. Identification

### Session Context
- **Date:** 2026-04-29
- **Session:** tududi MCP integration testing
- **Trigger:** AI agent called `search` with default parameters (`type: "all"`)

### Error Details
```
Error: SQLITE_ERROR: no such column: Note.name
```

### Root Cause Analysis

The search tool in `backend/modules/mcp/tools/miscTools.js` queries the `Note` model with a `name` field:

```javascript
// miscTools.js — BEFORE (buggy)
{ name: { [Op.like]: `%${query}%` } },  // ❌ Note model has no 'name' column
```

However, the **Note model** (`backend/models/note.js`) defines `title`, not `name`:

```javascript
// Note model definition
title: { type: DataTypes.STRING, allowNull: true },
content: { type: DataTypes.TEXT, allowNull: true },
```

The `notes` table in the database has columns: `id`, `uid`, `title`, `content`, `user_id`, `project_id`, `color`, `created_at`, `updated_at` — **no `name` column**.

---

## 3. Testing

### Manual Testing Setup

1. **Clone:** Checked out `jax0m/tududi` fork → branch `bug/mcp-search-sql-crash`
2. **Install:** `npm install`
3. **Database:** `npm run db:init` → `npm run user:create admin@example.com password123 true`
4. **Config:** Created `.env` with `DB_FILE=db/development.sqlite3`, `FF_ENABLE_MCP=true`, `DISABLE_SCHEDULER=true`, `DISABLE_TELEGRAM=true`, `CALDAV_ENABLED=false`
5. **Start:** `node app.js` → backend running on `localhost:3002`

### MCP Authentication

Created an API token directly in the database (dev environment) for testing the MCP endpoint:

```sql
INSERT INTO api_tokens (name, token_hash, token_prefix, abilities, user_id)
VALUES ('mcp-test', '<bcrypt-hash>', 'tt_test12345', '["read","write"]', 1);
```

### Test Requests

**Before fix** — crash:
```bash
curl -X POST http://localhost:3002/api/v1/mcp \
  -H "Authorization: Bearer <token>" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":1,"params":{"name":"search","arguments":{"query":"test","type":"all"}}}'
```
**Result:** `SQLITE_ERROR: no such column: Note.name`

**After fix** — success:
```bash
curl -X POST http://localhost:3002/api/v1/mcp \
  -H "Authorization: Bearer <token>" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":1,"params":{"name":"search","arguments":{"query":"test","type":"all"}}}'
```
**Result:** `{"result":{"content":[{"type":"text","text":"{\"query\":\"test\",\"results\":{\"tasks\":[],\"projects\":[],\"notes\":[]}}"}]}}`

---

## 4. Updates Needed

### File: `backend/modules/mcp/tools/miscTools.js`

**Two changes required:**

1. **WHERE clause** — Change `name` → `title` in the Note search filter:
```javascript
// BEFORE
{ name: { [Op.like]: `%${query}%` } }
// AFTER
{ title: { [Op.like]: `%${query}%` } }
```

2. **Output mapping** — Change `name: n.name` → `title: n.title` in the results:
```javascript
// BEFORE
results.notes = notes.map((n) => ({
    id: n.id,
    uid: n.uid,
    name: n.name,  // ❌ n.name doesn't exist
}));
// AFTER
results.notes = notes.map((n) => ({
    id: n.id,
    uid: n.uid,
    title: n.title,  // ✅ n.title exists
}));
```

**Diff:**
```diff
diff --git a/backend/modules/mcp/tools/miscTools.js b/backend/modules/mcp/tools/miscTools.js
index dab11ca4..af5f32f 100644
--- a/backend/modules/mcp/tools/miscTools.js
+++ b/backend/modules/mcp/tools/miscTools.js
@@ -175,7 +175,7 @@ function registerMiscTools(server, context, tools) {
                     where: {
                         user_id: context.userId,
                         [Op.or]: [
-                            { name: { [Op.like]: `%${query}%` } },
+                            { title: { [Op.like]: `%${query}%` } },
                             { content: { [Op.like]: `%${query}%` } },
                         ],
                     },
@@ -186,7 +186,7 @@ function registerMiscTools(server, context, tools) {
                 results.notes = notes.map((n) => ({
                     id: n.id,
                     uid: n.uid,
-                    name: n.name,
+                    title: n.title,
                 }));
             }
```

---

## 5. Validation

### Fix Applied & Verified

1. **Code change committed** on branch `bug/mcp-search-sql-crash`
2. **Backend restarted** with the fix
3. **MCP search tested** with `type: "all"` — no crash
4. **Note created** in database and verified search returns it with `title` field

### Validation Results

| Test | Before Fix | After Fix |
|------|-----------|-----------|
| `search` with `type: "all"` | ❌ SQL crash | ✅ Returns results |
| `search` with `type: "note"` | ❌ SQL crash | ✅ Returns results |
| `search` with `type: "task"` | ✅ Works | ✅ Works |
| `search` with `type: "project"` | ✅ Works | ✅ Works |
| Note results contain `title` field | ❌ N/A (crash) | ✅ Present |

### Related Findings

During investigation, the following closed MCP issues were found in the upstream repo (`chrisvel/tududi`):
- **#1050:** `[BUG] list_inbox MCP tool crashes` — fixed (orphaned model file)
- **#985:** `[BUG] add_to_inbox tool fails` — fixed (import naming mismatch)
- **#1029:** `Include Subtasks in MCP get_task API Response` — fixed

This `search` bug (**#1**) was **not previously reported** and is a fresh finding.

---

## 6. Next Steps

1. Push branch to `jax0m/tududi`
2. Open Pull Request to `chrisvel/tududi`
3. Reference related closed MCP issues for context
4. Request review from maintainer(s)

---

*Document created: 2026-04-29*  
*Branch: `bug/mcp-search-sql-crash`*  
*Author: tududi MCP integration testing session*
