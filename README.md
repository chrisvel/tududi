# Life-to-Day

From long-term vision to today. A personal, self-hosted system for connecting areas of life, goals and projects with the work of today.

Life-to-Day is derived from [tududi](https://github.com/chrisvel/tududi), licensed under MIT; the original [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md) are retained.

<!-- LTD-PATCH(T-301): User documentation follows the independent product; upstream attribution remains above. -->

## What is available

- Areas, goals, projects, tasks and subtasks.
- Today with daily planning, the Now card, and upcoming work.
- Quick capture, notes, tags, saved views and habits.
- Optional Telegram, calendar feeds, CalDAV, AI assistant and MCP integrations.
- Light and dark appearances and an installable web app.

The [product blueprint](docs/ltd/PRODUCT_BLUEPRINT.md) describes the direction of the product. It includes future work, so it is not a list of shipped features.

## Run it yourself

For Docker setup, persistent storage, backups and moving between hosts, follow [the deployment guide](docs/deploy.md). The release image is `ghcr.io/danialmasghati/life-to-day`. Run it from the repo root: `docker compose --profile local up -d --build`.

For local development:

```bash
npm install
npm start
```

The frontend runs on `http://localhost:8080` and the API on `http://localhost:3002`. Configure the existing environment variables before starting. The inherited `TUDUDI_*` variable names remain supported; existing installations do not need a naming migration. Startup applies pending database migrations, so keep a backup before upgrades.

## Learn the existing flows

- [Today and daily planning](docs/20-daily-plan.md)
- [Tasks](docs/00-tasks-behavior.md), [projects](docs/06-projects.md), [areas](docs/07-areas.md), [goals](docs/12-goals-system.md)
- [Inbox](docs/04-inbox-page.md), [notes](docs/05-notes-system.md), [habits](docs/21-habits.md)
- [Accounts and profile](docs/08-user-management.md)
- [API and MCP](docs/14-mcp-integration.md)
- [PWA and notifications](docs/15-pwa.md)

For architecture and maintenance, see [CLAUDE.md](CLAUDE.md) and [fork provenance](docs/ltd/UPSTREAM.md).

## Checks

```bash
npm run build
npm run lint
npm test
npm run frontend:test
```
