# MCP module

Exposes the Tududi REST API as MCP tools at `/mcp` (Streamable HTTP). Authentication uses the same API key (Bearer) as the REST API.

## Tool registry and overlay

- **Source of “what exists”:** Tools are derived from the Swagger spec ([backend/config/swagger.js](../../config/swagger.js) and [backend/docs/swagger/](../../docs/swagger/)). Every authenticated path + method gets a default tool name and description.
- **Overlay:** [tools.overlay.js](./tools.overlay.js) provides declarative overrides keyed by `path` and `method`. Use it to:
  - Fix tool names (e.g. `inboxs_list` → `inbox_list`)
  - Set LLM-oriented descriptions (when to use, what to pass)
  - Optionally replace the derived `inputSchema` for a tool

New API operations get a default MCP tool automatically. To refine name or description, add an entry to `tools.overlay.js`; no need to duplicate path/method or parameters.
