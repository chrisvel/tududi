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
  - [Environment Variables](#environment-variables)
- [Two Transport Modes](#two-transport-modes)
  - [Stdio Mode (Local)](#stdio-mode-local)
  - [HTTP Mode (Remote)](#http-mode-remote)
- [Available Tools](#available-tools)
  - [Tasks Tools (8)](#tasks-tools-8)
  - [Projects Tools (3)](#projects-tools-3)
  - [Inbox Tools (2)](#inbox-tools-2)
  - [Misc Tools (3)](#misc-tools-3)
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
- **16 Tools:** Complete CRUD operations for tasks, projects, and inbox
- **Secure Authentication:** API token-based authentication with user isolation
- **Local or Remote:** Two transport modes for different use cases
- **Feature Flag:** Opt-in via `FF_ENABLE_MCP` to control availability
- **Frontend Configuration:** Web UI for generating client configurations

---

## History

MCP was introduced in Tududi v1.0.0 (March 27, 2026) as a way to expose Tududi's data to AI assistants through the Model Context Protocol. Since then, it has evolved through several improvements:

- **v1.0.0** (2026-03-20): Initial MCP integration with basic task, project, and inbox tools
- **v1.0.0+** (2026-04-12): Fixed inbox tool model name issues
- **v1.1.0-dev.15+** (2026-04-18): Added subtask inclusion in `get_task` responses

The feature has remained stable since its initial release and is considered production-ready.

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

| Client | Transport | Setup Complexity |
|--------|-----------|-----------------|
| **Claude Desktop** | Stdio or HTTP | Easy |
| **Cursor** | Stdio | Easy |
| **VS Code + Continue** | Stdio | Medium |
| **Windsurf (Codeium)** | Stdio | Easy |
| **Zed** | Stdio | Medium |
| **Any HTTP-capable client** | HTTP | Medium |

---

## Configuration

### Prerequisites

1. **Tududi installed and running** — v1.0.0 or later (MCP shipped in v1.0.0)
2. **An API token** — Generate one at `Profile → API Keys`
3. **Feature flag enabled** — Set `FF_ENABLE_MCP=true` in your `.env`
4. **An MCP-compatible client** — Claude Desktop, Cursor, etc.

### Quick Setup

1. **Enable MCP:**
   ```bash
   # In your .env file
   FF_ENABLE_MCP=true
   ```

2. **Generate an API token:**
   - Navigate to `Profile → API Keys` in Tududi
   - Create a new token (keep it secure)

3. **Choose your transport mode:**
   - **Stdio:** For local Claude Desktop/Cursor integration
   - **HTTP:** For remote access or Docker deployments

4. **Configure your client** — Use the configuration below

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FF_ENABLE_MCP` | Yes | `false` | Feature flag to enable MCP |
| `TUDUDI_API_TOKEN` | Stdio only | — | API token for stdio authentication |
| `MCP_SERVER_NAME` | No | `tududi` | Display name for the MCP server |
| `MCP_SERVER_VERSION` | No | `1.0.0` | Version string for the MCP server |

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

**HTTP Configuration Example (Claude Desktop):**
```json
{
  "mcpServers": {
    "tududi": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://tududi.yourdomain.com/api/mcp",
        "--header",
        "Authorization:Bearer ${TUDUDI_API_TOKEN}"
      ],
      "env": {
        "TUDUDI_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

---

## Available Tools

Tududi exposes 16 MCP tools organized into 4 categories. All tools are scoped to the authenticated user — you can never access another user's data.

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
| `project_id` | number | No | Assign to a project |
| `tags` | string[] | No | Array of tag names to apply |

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
| `today` | boolean | No | Add to Today list |

**Example:**
```json
{
  "id": "abc123",
  "priority": "high",
  "status": "in_progress"
}
```

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

### Projects Tools (3)

#### `list_projects`

List projects with optional filtering.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | — | Filter: `not_started`, `planned`, `in_progress`, `waiting`, `done`, `cancelled`, `all` |
| `area_id` | number | No | — | Filter by area ID |
| `limit` | number | No | 30 | Maximum projects to return |

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

### Inbox Tools (2)

#### `list_inbox`

List inbox items.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | 20 | Maximum items |
| `offset` | number | No | 0 | Items to skip |

---

#### `add_to_inbox`

Add an item to the inbox.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `content` | string | Yes | — | Inbox content |
| `source` | string | No | `mcp` | Source identifier |

---

### Misc Tools (3)

#### `list_areas`

List all organizational areas. No parameters.

#### `list_tags`

List all tags. No parameters.

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
         "args": ["/path/to/tududi/backend/modules/mcp/server.js"]
       }
     }
   }
   ```

#### For HTTP (Remote Tududi):

1. Install mcp-remote:
   ```bash
   npm install -g mcp-remote
   ```

2. Configure Claude Desktop:
   ```json
   {
     "mcpServers": {
       "tududi": {
         "command": "npx",
         "args": [
           "-y",
           "mcp-remote",
           "https://tududi.yourdomain.com/api/mcp",
           "--header",
           "Authorization:Bearer ${TUDUDI_API_TOKEN}"
         ],
         "env": {
           "TUDUDI_API_TOKEN": "your-token-here"
         }
       }
     }
   }
   ```

### Step 3: Verify Connection

1. Restart Claude Desktop
2. In a chat, ask: "What tasks do I have today?"
3. Claude should use the `list_tasks` tool and return your tasks

---

## Cursor Setup

1. Open Cursor settings (`Ctrl+,` or `Cmd+,`)
2. Navigate to **Features** → **MCP**
3. Click **Add New MCP Server**
4. Configure:

   **For Stdio:**
   ```json
   {
     "command": "node",
     "args": ["/path/to/tududi/backend/modules/mcp/server.js"],
     "env": {
       "TUDUDI_API_TOKEN": "your-token-here"
     }
   }
   ```

   **For HTTP:**
   ```json
   {
     "command": "npx",
     "args": [
       "-y",
       "mcp-remote",
       "https://tududi.yourdomain.com/api/mcp",
       "--header",
       "Authorization:Bearer ${TUDUDI_API_TOKEN}"
     ],
     "env": {
       "TUDUDI_API_TOKEN": "your-token-here"
     }
   }
   ```

---

## VS Code + Continue Setup

1. Install the [Continue VS Code extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue)
2. Open `.continue/config.json` (or create it)
3. Add the MCP server:

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

4. Reload VS Code

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
    Authorization: 'Bearer YOUR_TOKEN'
  }
});

// List available tools
const tools = await client.listTools();

// Call a tool
const result = await client.callTool({
  name: 'create_task',
  arguments: {
    name: 'New task from SDK',
    priority: 'high'
  }
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

- **Opt-in only:** Administrators must explicitly enable MCP
- **Backend routes protected:** `/api/mcp/*` endpoints return 403 when disabled
- **Frontend tab hidden:** The MCP settings tab only shows when enabled

### Data Isolation

Every MCP tool query includes `user_id` filtering:
- Task queries: Only the authenticated user's tasks
- Project queries: Only the authenticated user's projects
- Search queries: Only the authenticated user's data across entities

### Best Practices

1. **Use strong, unique tokens** — Generate tokens with high entropy
2. **Rotate tokens regularly** — Use the API Key management UI
3. **Restrict token scope** — If possible, use tokens with limited permissions
4. **Use HTTPS for HTTP mode** — Always use `https://` for remote connections
5. **Keep `TUDUDI_API_TOKEN` secure** — Never commit tokens to version control

---

## Troubleshooting

### MCP Server Won't Start (Stdio)

**Problem:** Claude Desktop shows "Server failed to start"

**Checklist:**
1. Verify `FF_ENABLE_MCP=true` in `.env`
2. Verify `TUDUDI_API_TOKEN` is set and valid
3. Check the Tududi server is running
4. Verify the path to `server.js` is correct
5. Check Tududi logs for errors

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
        - "3002:3002"
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

| File | Purpose |
|------|---------|
| `backend/modules/mcp/server.js` | Stdio MCP server entry point |
| `backend/modules/mcp/httpTransport.js` | HTTP transport handler |
| `backend/modules/mcp/toolRegistry.js` | Registers all tool categories |
| `backend/modules/mcp/tools/taskTools.js` | Task-related tools (8) |
| `backend/modules/mcp/tools/projectTools.js` | Project tools (3) |
| `backend/modules/mcp/tools/inboxTools.js` | Inbox tools (2) |
| `backend/modules/mcp/tools/miscTools.js` | Area, tag, search tools (3) |
| `backend/modules/mcp/middleware.js` | API token authentication |
| `backend/modules/mcp/controller.js` | REST API endpoints |
| `backend/modules/mcp/routes.js` | Express route definitions |
| `frontend/components/Profile/tabs/McpTab.tsx` | Web UI for config |

---

- **Document Version:** 1.0.0
- **Last Updated:** 2026-04-26
- **MCP SDK Version:** @modelcontextprotocol/sdk
- **Minimum Tududi Version:** v1.0.0 (released 2026-03-27)
- **Latest MCP Fix:** v1.1.0-dev.15+ (PR #1040 — subtasks in get_task, 2026-04-18)
