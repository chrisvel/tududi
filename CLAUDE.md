# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tududi - Developer Guide

This documentation is designed for AI assistants and developers working with the tududi codebase. For user-facing documentation, see [README.md](README.md). For contribution guidelines, see [CONTRIBUTING.md](.github/CONTRIBUTING.md).

---

## Quick Start

Tududi is a self-hosted task management system with hierarchical organization (Areas > Goals > Projects > Tasks), smart recurring tasks, and multi-channel integration.

**Tech Stack:** React 18 + TypeScript, Express + Sequelize, SQLite (default) or PostgreSQL

**Get Started:**
```bash
git clone https://github.com/chrisvel/tududi.git
cd tududi
npm install
npm run db:init
npm start  # Frontend on :8080, Backend on :3002
```

---

## Common Commands

**Development** (two servers, run together via `npm start` or separately):
```bash
npm run backend:dev    # nodemon, backend on :3002
npm run frontend:dev   # webpack-dev-server, frontend on :8080, proxies /api to :3002
```

**Build:**
```bash
npm run build           # tsc --noEmit + webpack production build -> /dist
```

**Lint & format** (run both frontend and backend unless scoped):
```bash
npm run lint             # eslint: frontend + backend
npm run lint:fix
npm run format:fix       # prettier --write: frontend + backend
```

**Tests:**
```bash
npm test                              # backend Jest suite (alias: npm run backend:test)
npm run backend:test:unit             # backend/tests/unit only
npm run backend:test:integration      # backend/tests/integration only
cd backend && npx jest tests/unit/models/task.test.js   # single backend test file
npm run frontend:test                 # frontend Jest + React Testing Library
npm run frontend:test -- TaskItem     # single frontend test by name pattern
npm run test:ui                       # Playwright E2E (headless)
npm run test:ui:headed                # Playwright E2E, visible browser
npm run test:coverage                 # coverage for both frontend and backend
```

**Before opening a PR:**
```bash
npm run pre-push   # lint-staged (runs on the staged diff)
```
(`pre-release` runs the full lint:fix + format:fix + test + test:ui suite.)

**Database** (all operate on `backend/`):
```bash
npm run db:init             # first-time setup
npm run db:migrate          # run pending migrations (dev)
npm run db:reset            # wipe and reinit
npm run db:seed             # seed dev data
npm run migration:create    # scaffold a new migration
npm run migration:status    # check applied/pending migrations
```

---

## Architecture at a Glance

See [docs/architecture.md](docs/architecture.md) for full diagrams; the essentials:

- **Dev mode is two servers.** Webpack dev server (`:8080`) serves the React app with HMR and proxies `/api/*` and `/locales/*` to the Express API (`:3002`). In production, Express serves the compiled `/dist` bundle directly alongside the API — one process, one port.
- **Backend is organized into self-contained modules** under `/backend/modules/[feature]/`, each typically with `routes.js` (Express router, thin) → `repository.js` (Sequelize data access) → optional `operations/` (business logic too complex for the repository) and `core/` (`serializers.js`, `builders.js`, `parsers.js`). Routes never touch Sequelize models directly — they call the repository. See [docs/backend-patterns.md](docs/backend-patterns.md).
- **Data hierarchy:** `User → Area → Project → Task → Subtask`, with `Tag` many-to-many across Tasks/Notes/Projects, and `Task` self-referencing for both subtasks (`parent_task_id`) and recurring instances (`recurring_parent_id`). Areas and Goals are optional containers — Projects can exist without either.
- **Three auth methods**, all resolving to `req.currentUser`: session cookies (web UI, `express-session` + Sequelize store), Bearer API tokens (`tt_...`, for automation/MCP), and OAuth2 JWT bearer tokens (when OIDC is enabled, validated against the provider's JWKS). Authorization is enforced per-request via `hasAccess(level, resourceType, getResourceUid)` in `/backend/middleware/authorize.js`; ownership grants RW automatically, sharing grants RO/RW/ADMIN via the `Permission` model, and Tasks/Notes inherit access from their parent Project.
- **Frontend state** is split three ways: Zustand (`/frontend/store/useStore.ts`) for global UI/cache state, SWR for server data fetching/revalidation, and local `useState` for component-only state. API calls go through `/frontend/utils/[resource]Service.ts` wrappers, not ad-hoc `fetch`.
- **Recurring tasks** are the most complex subsystem — a recurring task is a pattern record; completed/generated instances are separate Task rows linked via `recurring_parent_id`, with `taskScheduler.js` (node-cron) and `recurringTaskService.js` driving generation. See [docs/01-recurring-tasks-behavior.md](docs/01-recurring-tasks-behavior.md) before touching this code.

---

## Documentation Index

### Core Documentation

1. **[Architecture Overview](docs/architecture.md)**
   - Tech stack details
   - Request flow diagram
   - Data model hierarchy
   - Authentication methods

2. **[Directory Structure](docs/directory-structure.md)**
   - Complete file tree with absolute paths
   - Critical paths reference
   - Backend and frontend organization

3. **[Backend Patterns](docs/backend-patterns.md)**
   - Module architecture pattern
   - How to add new modules
   - Module communication
   - Repository and service patterns

4. **[Database & Migrations](docs/database.md)**
   - Key models and relationships
   - Migration workflow
   - Migration best practices
   - Common migration operations

5. **[Backups & Restoration](docs/backups.md)**
   - Automatic SQLite file backups before migrations (PostgreSQL: pg_dump)
   - Backup retention policies (4 per day, 1 per day for 7 days)
   - Restoration procedures for development, Docker, and production
   - Emergency restore after failed migrations
   - Best practices for data safety

6. **[Development Workflow](docs/development-workflow.md)**
   - Initial setup
   - Daily development (two-server process)
   - Environment variables
   - Adding new features (complete walkthrough)
   - Database management commands

7. **[Code Conventions](docs/code-conventions.md)**
   - Language usage (TypeScript/JavaScript)
   - Backend patterns (async/await, repository)
   - Frontend patterns (components, state)
   - Naming conventions
   - API route conventions

8. **[Testing](docs/testing.md)**
   - Test organization
   - Running tests
   - Testing requirements
   - Test patterns (Arrange-Act-Assert)

9. **[Common Tasks](docs/common-tasks.md)**
   - Add field to model
   - Create new backend module
   - Add React component
   - Update database schema
   - Fix a bug (TDD workflow)
   - Add translations

10. **[Tasks Behavior](docs/00-tasks-behavior.md)**
    - Task creation and basic fields
    - Status lifecycle and priority levels
    - Due dates and Defer Until
    - Subtasks and hierarchy
    - File attachments
    - Project assignment and tags
    - Task completion and history
    - Habit mode and tracking
    - Task deletion and permissions

11. **[Recurring Tasks Behavior](docs/01-recurring-tasks-behavior.md)**
    - How recurring tasks work (non-technical rules)
    - Completion behavior and patterns
    - Virtual instances and display rules
    - Parent-child relationships
    - Editing and deletion behavior

12. **[Today Page Sections](docs/02-today-page-sections.md)**
    - How Overdue, Planned, Suggested, and Completed sections work
    - Task filtering and display rules
    - Section priority and deduplication logic
    - User settings and customization
    - Defer Until and timezone handling

13. **[Upcoming View](docs/03-upcoming-view.md)**
    - How the 7-day Upcoming view works
    - Day-based grouping and organization
    - Recurring task virtual occurrences
    - Defer Until and status filtering
    - Differences from Today view

14. **[Inbox Page](docs/04-inbox-page.md)**
    - Quick capture system for unorganized thoughts
    - Smart parsing of hashtags, projects, and URLs
    - Intelligent suggestions (Task vs Note vs Project)
    - Converting inbox items to structured content
    - Telegram integration and auto-refresh
    - Keyboard shortcuts and workflows

15. **[Notes System](docs/05-notes-system.md)**
    - Flexible information and reference storage
    - Markdown support and rich text rendering
    - Auto-save functionality (1-second debounce)
    - Project linking and tag-based organization
    - Focus mode for distraction-free writing
    - Color customization for visual organization
    - Integration with inbox and project workflows

16. **[Projects](docs/06-projects.md)**
    - Project hierarchy and organization (Areas > Projects > Tasks)
    - Status lifecycle and stalled detection
    - Completion tracking and progress metrics
    - Project sharing and collaboration permissions
    - Due dates, notifications, and priorities
    - Deletion behavior (orphaning vs cascading)
    - Filtering, grouping, and sidebar pinning

17. **[Areas](docs/07-areas.md)**
    - Top-level organizational categories for life domains
    - Contain Goals and Projects
    - Area detail page: goals spine, project cards, tasks column
    - Optional containers (projects can exist without areas)
    - Cascade behavior when deleting (orphans projects)
    - Grid view with alphabetical sorting and optional color

18. **[Views System](docs/08-views-system.md)**
    - Smart saved searches for tasks, notes, and projects
    - Creating views from Universal Search
    - Pinning and reordering views in sidebar
    - Filtering, sorting, and grouping within views
    - View management (rename, delete, pin/unpin)
    - URL parameters and deep linking
    - Pagination and performance

19. **[User Management](docs/08-user-management.md)**
    - Registration flow and email verification
    - Authentication (session-based and API tokens)
    - User roles and admin system
    - Resource permissions and sharing
    - Profile management and preferences
    - Password and avatar management
    - API token management
    - Admin user CRUD operations

20. **[Tags System](docs/09-tags-system.md)**
    - Cross-entity labeling and categorization (tasks, notes, projects)
    - Auto-creation and validation rules
    - Tag management (create, edit, delete, rename)
    - Tag detail pages with filtering and search
    - Alphabetical grouping and organization
    - Hashtag parsing from inbox items
    - Tag input component with autocomplete

21. **[Goals System](docs/12-goals-system.md)**
    - Outcome-level intentions between Areas and Projects
    - Season/year horizons and status lifecycle
    - Linking projects to goals or marking as maintenance
    - Area detail page layout and scarcity rule
    - API endpoints and database schema

22. **[AI Assistant](docs/13-ai-assistant.md)**
    - Daily Brief, Task Insights, and Project Insights features
    - Provider-agnostic LLM integration (LLM_API_KEY, LLM_BASE_URL, LLM_MODEL)
    - OpenAI, Ollama, Groq, and any OpenAI-compatible provider supported
    - User "About You" profile context for personalised briefs
    - Caching strategy and API endpoints
    - Adding new AI features

23. **[MCP Integration](docs/14-mcp-integration.md)**
    - Model Context Protocol server for AI tool integration
    - 16 tools: tasks, projects, inbox, and search operations
    - Stdio and HTTP transport modes
    - Claude Desktop, Cursor, VS Code configuration
    - API token authentication and security

24. **[PWA & Offline Support](docs/15-pwa.md)**
    - Installable as a Progressive Web App (home screen on mobile and desktop)
    - Service worker cache strategy (static assets, API reads, offline mutation queue)
    - Background Sync for replaying queued mutations on reconnect
    - Session-scoped cache security (cleared on logout / 401)
    - Known limitations (sub-path deployments, iOS background sync, offline task creation)

25. **[Claude Memory & Preferences](docs/MEMORY.md)**
    - PR and commit message preferences
    - Testing preferences
    - Common patterns to remember
    - Known issues and solutions

---

## Project Overview

### What This Project Does

Tududi is a self-hosted task management system designed around hierarchical organization and smart automation. It prioritizes user flow over rigid structures - a productivity tool that doesn't "fight back."

**Core Philosophy:**
- [Designing a Life Management System That Doesn't Fight Back](https://medium.com/@chrisveleris/designing-a-life-management-system-that-doesnt-fight-back-2fd58773e857)
- [From Task to Table: How I Finally Got to the Korean Burger](https://medium.com/@chrisveleris/from-task-to-table-how-i-finally-got-to-the-korean-burger-01245a14d491)

**Key Capabilities:**
- **Hierarchical Organization:** Areas > Goals > Projects > Tasks > Subtasks
- **Smart Recurring Tasks:** Multiple patterns with parent-child tracking
- **Multi-Language Support:** 24 languages via i18next
- **Collaboration:** Project sharing with granular permissions
- **REST API:** Swagger docs + personal API tokens
- **Telegram Integration:** Create tasks via messages, daily digests
- **Tag System:** Flexible tagging across tasks, notes, projects
- **MCP Integration:** AI tool connectivity via Model Context Protocol (16 tools)

**Target Users:** Self-hosting individuals and teams managing personal or collaborative productivity

---

## Technology Stack

**Frontend:**
- React 18 + TypeScript 5.6
- Webpack 5 (build) + webpack-dev-server (development)
- Tailwind CSS 3.4 + Heroicons
- Zustand (global state) + SWR (server state)
- React Router 6, i18next (24 languages)

**Backend:**
- Express 4.21 + Sequelize 6.37 (ORM)
- SQLite (default, WAL mode, optimized) or PostgreSQL via `DATABASE_URL`
- bcrypt + express-session (auth)
- Swagger (API docs), Multer (uploads)
- node-cron (scheduling), Nodemailer (email)

**Testing:**
- Jest (backend + frontend)
- Playwright (E2E)
- Supertest (API integration tests)

---

## Critical Paths Quick Reference

| Task | Location |
|------|----------|
| Add backend feature | `/backend/modules/[feature]/` |
| Create model | `/backend/models/[model].js` |
| Database migration | `/backend/migrations/` |
| React component | `/frontend/components/[Feature]/` |
| API routes | `/backend/modules/[module]/routes.js` |
| Global state | `/frontend/store/useStore.ts` |
| API client | `/frontend/utils/[resource]Service.ts` |

---

## Related Documentation

| Document | Audience | Purpose |
|----------|----------|---------|
| [README.md](README.md) | Users | Features, Docker setup, quick start |
| [CONTRIBUTING.md](.github/CONTRIBUTING.md) | Contributors | PR workflow, code of conduct |
| [docs.tududi.com](https://docs.tududi.com) | End users | Full user documentation |
| [Swagger API docs](http://localhost:3002/api-docs) | API consumers | API endpoints (after auth) |
| **CLAUDE.md** | Developers, AI | Codebase architecture, patterns |

---

## External Resources

- **Roadmap:** [GitHub Project](https://github.com/users/chrisvel/projects/2)
- **Community:**
  - [Discord](https://discord.gg/fkbeJ9CmcH)
  - [Reddit](https://www.reddit.com/r/tududi/)
  - [Issues](https://github.com/chrisvel/tududi/issues)
  - [Discussions](https://github.com/chrisvel/tududi/discussions)

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-14
**Maintainer:** Update when architecture changes or patterns evolve
