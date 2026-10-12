# Connecting MCP clients to Life-to-Day

Life-to-Day serves MCP over Streamable HTTP at `/api/mcp`. Clients authenticate in one of two ways:

| Way | For | Status |
| --- | --- | --- |
| Personal API token (`tt_...`) as a Bearer header | Claude Code, scripts, any client on a machine you control | Works today, local or remote |
| OAuth 2.1 (embedded authorization server) | Claude Code with sign-in, claude.ai, Claude Desktop and mobile, ChatGPT | Works locally; claude.ai and ChatGPT need a public HTTPS address (BLOCKED here, see below) |

Both can be used at the same time. Turning OAuth on does not change API tokens.

## What a client can do

Each Life-to-Day tool has a scope and a risk tier (blueprint 16.3):

| Scope | Risk | Tools | What happens |
| --- | --- | --- | --- |
| `ltd.read` | R0 | `list_goals`, `get_goal`, `get_goal_progress`, `get_life_vision`, `explain_contribution`, `get_weekly_plan`, `get_calendar_events` | Read only. Calendar event titles are left out unless the call passes `allow_titles: true` |
| `ltd.write` | R1 | `capture`, `checkin_metric` | Written at once, recorded in the Journal, undoable there |
| `ltd.propose` | R2 | `plan_tomorrow`, `create_goal`, `reschedule_tasks` | Creates a Proposal. Nothing changes until you apply it in **Proposals** (`/proposals`); applied Proposals can be undone |

Rules for every write: an optional `idempotency_key` replays the first result instead of writing again; at most 30 writes a minute per client; after three violations within ten minutes the client's writes are turned off until you turn them back on. No tool deletes anything.

An API token holds all three scopes and also sees the older tududi tools (tasks, projects, notes and so on). An OAuth client holds the scopes you allowed, and of the older tools it sees only the read ones, because those writes do not go through the Journal.

**Settings → MCP → Connected clients** lists the OAuth clients and the tokens that used MCP. From there you can revoke one client, turn writes back on for a client, switch MCP to read-only, or end all MCP access. Ending all access removes every OAuth grant and stops every API token issued until then from working on `/api/mcp`; those tokens keep working for the REST API.

## Claude Code with an API token

1. In Life-to-Day: **Settings → API keys**, create a token and copy it (`tt_...`).
2. Add the server:

```bash
claude mcp add --transport http life-to-day https://plan.example.com/api/mcp \
  --header "Authorization: Bearer tt_your_token"
```

For a local instance use `http://localhost:3002/api/mcp`. Add `--scope project` to share it in `.mcp.json`, or `--scope user` for all projects. `claude mcp add` does not check the token; a wrong one shows as failed (401) in `/mcp`.

## Server setup for OAuth

Set these in the backend environment and restart:

```bash
LTD_OAUTH_ENABLED=true
BASE_URL=https://plan.example.com      # the public address clients use, no trailing slash
# LTD_OAUTH_JWKS_FILE=/app/backend/db/ltd-oauth-jwks.json   # default: next to the SQLite file
```

- The protected resource is exactly `${BASE_URL}/api/mcp`. Clients must be given that URL.
- The token signing key is created on first start in `LTD_OAUTH_JWKS_FILE`. Keep it on the persistent volume with the database and never commit it. Deleting it signs every client out.
- Behind a reverse proxy, set `TUDUDI_TRUST_PROXY` as for the rest of the app so the server sees HTTPS.
- These paths must reach the backend: `/api/mcp`, `/oauth2/*`, `/.well-known/oauth-protected-resource`, `/.well-known/oauth-protected-resource/api/mcp`, `/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration`.
- Optional network limit (blueprint 17.3): `/api/mcp`, `/oauth2/token` and `/oauth2/reg` may be limited to the IP ranges of Anthropic (`160.79.104.0/21`) and OpenAI. Never limit `/oauth2/auth` or `/oauth2/interaction/*`; your own browser opens them.
- Registration accepts only these redirect URIs: `https://claude.ai/api/mcp/auth_callback`, `https://claude.com/api/mcp/auth_callback`, loopback (`http://localhost:<port>/...`, `http://127.0.0.1:<port>/...`), `https://chatgpt.com/connector_platform_oauth_redirect` and `https://chatgpt.com/connector/oauth/<id>`. Registration is rate limited (30 an hour per IP).

The consent screen uses your Life-to-Day session: sign in to Life-to-Day in the same browser first. It names the client, shows the host it will send you back to, and lists what the client asks for. Access tokens last one hour; refresh tokens rotate and last 30 days. Reusing an old refresh token ends that client's access.

In local development the webpack dev server (`:8080`) does not proxy `/oauth2`, so use `BASE_URL=http://localhost:3002` and the backend port for the MCP URL. Sign in on `localhost` (not `127.0.0.1`) so the session cookie is sent to the backend port.

## Claude Code with OAuth (local, loopback)

With OAuth on, add the server without a header:

```bash
claude mcp add --transport http life-to-day http://localhost:3002/api/mcp
```

Then run `/mcp` in Claude Code, select `life-to-day` and choose **Authenticate** (or run `claude mcp login life-to-day`). Claude Code registers itself, opens the consent page, and receives the code on a loopback port. **Clear authentication** in `/mcp` signs it out; revoking it in Settings does the same from the server side.

This path is tested offline in CI: a loopback client registers, consents, receives a token for `ltd.read` and calls `get_life_vision` (`backend/tests/helpers/ltdOauthContract.js`, check 34).

## claude.ai (custom connector) — BLOCKED

Status: **BLOCKED.** Anthropic's servers make the connection, so the instance must be reachable from the public internet over HTTPS. This deployment has no public domain yet, and no public tunnel was opened.

Steps once a public HTTPS address exists:

1. Set `LTD_OAUTH_ENABLED=true` and `BASE_URL=https://<your-domain>`; restart; open `https://<your-domain>/.well-known/oauth-protected-resource/api/mcp` and check that `resource` is `https://<your-domain>/api/mcp`.
2. Sign in to Life-to-Day in the browser you use for claude.ai.
3. In claude.ai: **Settings → Connectors → Add custom connector**. Name it, enter `https://<your-domain>/api/mcp`, then **Connect**. On Team or Enterprise plans an owner or admin adds it first.
4. On the Life-to-Day consent page, check that the host shown is `claude.ai`, then **Allow**.
5. Enable the connector in a conversation. Try "What are my season goals and how are they progressing?" and "Plan tomorrow", then open **Proposals** in Life-to-Day, apply the plan, and undo it.

If the firewall limits `/api/mcp`, allow Anthropic's range `160.79.104.0/21`.

## ChatGPT (developer mode connector) — BLOCKED

Status: **BLOCKED**, for the same reason as claude.ai (no public HTTPS address), and because full MCP with write tools needs a plan with developer mode that has not been confirmed (assumption A-06).

Steps once both are in place:

1. Same server setup as for claude.ai.
2. In ChatGPT, turn on developer mode and create a connector with the MCP URL `https://<your-domain>/api/mcp` and OAuth authentication. Menu names change; follow [OpenAI's developer mode article](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt).
3. Allow access on the Life-to-Day consent page (the host shown should be `chatgpt.com`).

Not built yet for ChatGPT: per-tool `securitySchemes` and `_meta["mcp/www_authenticate"]` on auth errors. ChatGPT may need them to ask for sign-in again from inside a conversation.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `401` with no `WWW-Authenticate` header | `LTD_OAUTH_ENABLED` is not `true`, or the request path is not exactly `/api/mcp` |
| Consent page says to sign in | Sign in to Life-to-Day in the same browser, then reload |
| `invalid_redirect_uri` on registration | The client's redirect is not on the allowlist above |
| `invalid_target` | The client sent a `resource` other than `${BASE_URL}/api/mcp`; check `BASE_URL` |
| `403 insufficient_scope` | The token lacks `ltd.read`; reconnect and allow access |
| A tool returns `read_only` or `writes_disabled` | Settings → MCP → Connected clients |
| Everyone was signed out after a deploy | The signing key file was not on a persistent volume |
