# Tududi - Developer Guide

This documentation is designed for AI assistants and developers working with the tududi codebase. For user-facing documentation, see [README.md](README.md). For contribution guidelines, see [CONTRIBUTING.md](.github/CONTRIBUTING.md).

---

## Quick Start

Tududi is a self-hosted task management system with hierarchical organization (Areas > Projects > Tasks), smart recurring tasks, and multi-channel integration.

**Tech Stack:** React 18 + TypeScript, Express + Sequelize, SQLite

**Get Started:**
```bash
git clone https://github.com/chrisvel/tududi.git
cd tududi
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

5. **[Development Workflow](docs/development-workflow.md)**
   - Initial setup
   - Daily development (two-server process)
   - Environment variables
   - Adding new features (complete walkthrough)
   - Database management commands

6. **[Code Conventions](docs/code-conventions.md)**
   - Language usage (TypeScript/JavaScript)
   - Backend patterns (async/await, repository)
   - Frontend patterns (components, state)
   - Naming conventions
   - API route conventions

7. **[Testing](docs/testing.md)**
   - Test organization
   - Running tests
   - Testing requirements
   - Test patterns (Arrange-Act-Assert)

8. **[Common Tasks](docs/common-tasks.md)**
   - Add field to model
   - Create new backend module
   - Add React component
   - Update database schema
   - Fix a bug (TDD workflow)
   - Add translations

9. **[Claude Memory & Preferences](docs/MEMORY.md)**
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
**Last Updated:** 2026-03-13
**Maintainer:** Update when architecture changes or patterns evolve
