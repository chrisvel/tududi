# TaskNoteTaker - Developer Guide

This documentation is designed for AI assistants and developers working with the tasknotetaker codebase. For user-facing documentation, see [README.md](README.md). For contribution guidelines, see [CONTRIBUTING.md](.github/CONTRIBUTING.md).

---

## Quick Start

TaskNoteTaker is a self-hosted task management system with hierarchical organization (Areas > Projects > Tasks), smart recurring tasks, and multi-channel integration.

**Tech Stack:** React 18 + TypeScript, Express + Sequelize, SQLite

**Get Started:**
```bash
git clone https://github.com/chrisvel/tasknotetaker.git
cd tasknotetaker
npm install
npm run db:init
npm start  # Frontend on :8080, Backend on :3002
```

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
   - Automatic SQLite file backups before migrations
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
    - Simple structure with name and description
    - Optional containers for grouping projects
    - Cascade behavior when deleting (orphans projects)
    - Grid view with alphabetical sorting
    - Integration with Projects page filtering and grouping

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

21. **[Claude Memory & Preferences](docs/MEMORY.md)**
    - PR and commit message preferences
    - Testing preferences
    - Common patterns to remember
    - Known issues and solutions

22. **[Google Cloud Deployment](docs/deployment-google-cloud.md)**
    - Building and pushing Docker images to Artifact Registry
    - Deploying to Cloud Run with persistence

---

## Project Overview

### What This Project Does

TaskNoteTaker is a self-hosted task management system designed around hierarchical organization and smart automation. It prioritizes user flow over rigid structures - a productivity tool that doesn't "fight back."

**Core Philosophy:**
- [Designing a Life Management System That Doesn't Fight Back](https://medium.com/@chrisveleris/designing-a-life-management-system-that-doesnt-fight-back-2fd58773e857)
- [From Task to Table: How I Finally Got to the Korean Burger](https://medium.com/@chrisveleris/from-task-to-table-how-i-finally-got-to-the-korean-burger-01245a14d491)

**Key Capabilities:**
- **Hierarchical Organization:** Areas > Projects > Tasks > Subtasks
- **Smart Recurring Tasks:** Multiple patterns with parent-child tracking
- **Multi-Language Support:** 24 languages via i18next
- **Collaboration:** Project sharing with granular permissions
- **REST API:** Swagger docs + personal API tokens
- **Telegram Integration:** Create tasks via messages, daily digests
- **Tag System:** Flexible tagging across tasks, notes, projects

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
- SQLite 5.1 (WAL mode, optimized)
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
| [docs.tasknotetaker.com](https://docs.tasknotetaker.com) | End users | Full user documentation |
| [Swagger API docs](http://localhost:3002/api-docs) | API consumers | API endpoints (after auth) |
| **CLAUDE.md** | Developers, AI | Codebase architecture, patterns |

---

## External Resources

- **Roadmap:** [GitHub Project](https://github.com/users/chrisvel/projects/2)
- **Community:**
  - [Discord](https://discord.gg/fkbeJ9CmcH)
  - [Reddit](https://www.reddit.com/r/tasknotetaker/)
  - [Issues](https://github.com/chrisvel/tasknotetaker/issues)
  - [Discussions](https://github.com/chrisvel/tasknotetaker/discussions)

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-14
**Maintainer:** Update when architecture changes or patterns evolve
