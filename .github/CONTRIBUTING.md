# Contributing to tududi

Thank you for your interest in contributing to tududi! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Feature Contributions](#feature-contributions)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Database Changes](#database-changes)
- [Translations](#translations)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

Please be respectful and constructive in all interactions. We want to foster an inclusive and welcoming community.

## Getting Started

### Prerequisites

- Node.js (v22 or higher recommended)
- npm
- Git

### Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/chrisvel/tududi.git
   cd tududi
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize the database**
   ```bash
   npm run db:init
   ```

4. **Start the development server**
   ```bash
   npm start
   ```
   This starts both frontend (http://localhost:8080) and backend (http://localhost:5000)

5. **Create a test user** (optional)
   ```bash
   npm run user:create
   ```

## Feature Contributions

> **⚠️ IMPORTANT: Please read this before contributing features**

### Feature PRs Require Prior Discussion

**Feature pull requests will not be merged** unless there is:
- An existing GitHub issue
- A feature request discussed in [Discussions](https://github.com/chrisvel/tududi/discussions)
- Prior communication with the maintainer or community

### Why This Requirement?

This requirement exists to:
1. **Ensure alignment** with the project's vision and roadmap
2. **Avoid wasted effort** on features that may not fit the project direction
3. **Enable collaborative design** before implementation begins
4. **Maintain consistency** with existing architecture and patterns
5. **Prevent duplicate work** on features already planned or in progress

### How to Contribute a Feature

Before writing any code:

1. **Start a discussion** in [Feature Requests](https://github.com/chrisvel/tududi/discussions/categories/feature-requests)
   - Describe the feature and the problem it solves
   - Explain why it would benefit tududi users
   - Outline your proposed approach

2. **Send a direct message** to [@chrisvel](https://github.com/chrisvel) via:
   - [Discord](https://discord.gg/fkbeJ9CmcH)
   - GitHub Discussions
   - Email (found in repository)

3. **Wait for feedback** before investing significant time in implementation

4. **Create or get assigned a GitHub issue** once the feature is approved

5. **Then proceed** with development following the guidelines below

### Bug Fixes and Documentation

This requirement applies primarily to **new features**. Bug fixes, documentation improvements, and minor enhancements can proceed with just a linked issue.

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation changes
- `test/description` - Test additions or fixes

### Before You Start

1. **For new features**: Read the [Feature Contributions](#feature-contributions) section above - **prior discussion is required**
2. **Check existing issues and discussions** to avoid duplicate work
3. **Create or comment on an issue** describing what you plan to work on
4. **Create a new branch** from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Development Commands

```bash
# Start development server (frontend + backend)
npm start

# Run frontend only
npm run frontend:dev

# Run backend only
npm run backend:dev

# Run tests
npm test                    # Backend tests
npm run test:ui            # E2E tests
npm run test:coverage      # Coverage report

# Linting and formatting
npm run lint               # Check all code
npm run lint:fix           # Auto-fix linting issues
npm run format:fix         # Auto-format code

# Database commands
npm run db:migrate         # Run migrations
npm run db:seed            # Seed dev data
npm run db:reset           # Reset database
```

## Code Standards

### General Rules

- **TypeScript** for all new code
- **ESLint** and **Prettier** are configured - run before committing:
  ```bash
  npm run lint:fix && npm run format:fix
  ```
- Follow existing code style and patterns
- Write meaningful variable and function names
- Add comments for complex logic

### Frontend (React + TypeScript)

- Use functional components with hooks
- Keep components small and focused
- Use TypeScript interfaces for props
- Place new components in `frontend/components/`
- Follow existing folder structure

### Backend (Node.js + Express)

- Use async/await (no callbacks)
- Validate input using middleware
- Use Sequelize models for database access
- Follow RESTful API conventions
- Place routes in `backend/routes/`
- Place business logic in `backend/services/`

### Security

- **Never** commit secrets, API keys, or credentials
- Validate and sanitize all user input
- Use parameterized queries (Sequelize handles this)
- Follow OWASP best practices

## Testing

### Requirements

- **Bug fixes** must include a test that would have caught the bug
- **New features** should include relevant tests
- All tests must pass before submitting PR

### Running Tests

```bash
# Backend unit tests
npm run backend:test

# Frontend tests
npm run frontend:test

# E2E tests
npm run test:ui

# Watch mode (useful during development)
npm run test:watch
```

### Writing Tests

- Place backend tests in `backend/tests/`
- Place frontend tests alongside components as `*.test.tsx`
- Use descriptive test names
- Follow the Arrange-Act-Assert pattern

## Database Changes

### Creating Migrations

If your changes require database schema changes:

1. **Create a migration**
   ```bash
   npm run migration:create -- --name your-migration-name
   ```

2. **Edit the migration file** in `backend/migrations/`

3. **Test the migration**
   ```bash
   npm run migration:run      # Apply
   npm run migration:undo     # Rollback to test
   ```

4. **Update Sequelize models** in `backend/models/`

5. **Include migrations in your PR**

### Migration Best Practices

- Make migrations reversible (implement `down` method)
- Test both `up` and `down` migrations
- Don't modify existing migrations that have been released
- Use transactions for data migrations

## Translations

tududi supports multiple languages via i18next.

### Adding/Updating Translations

1. **Add keys to English** (source of truth):
   `frontend/locales/en/translation.json`

2. **Sync translations**
   ```bash
   npm run translations:sync
   ```

3. **Check for missing translations**
   ```bash
   npm run translations:check
   ```

### Translation Guidelines

- Use descriptive key names: `task.create.button` not `btn1`
- Keep translations concise for UI elements
- Don't translate in code - always use translation keys
- Include context in comments if meaning is ambiguous

## Pull Request Process

### Before Submitting

1. **Update your branch** with latest `main`
   ```bash
   git checkout main
   git pull origin main
   git checkout your-branch
   git rebase main
   ```

2. **Run the pre-push checks**
   ```bash
   npm run pre-push
   ```
   This runs linting, formatting, and tests.

3. **Test your changes thoroughly**
   - Manual testing in the browser
   - Run automated tests
   - Test on different screen sizes (mobile/desktop)

### Creating the PR

1. **Push your branch**
   ```bash
   git push origin your-branch
   ```

2. **Create Pull Request** on GitHub

3. **Fill out the PR template** with:
   - Clear description of changes
   - Related issue numbers (use `Fixes #123`)
   - Testing steps
   - Screenshots (if UI changes)

4. **Wait for review** - maintainers will review and may request changes

### PR Requirements

- ✅ **Feature PRs**: Linked to an approved issue or prior discussion (see [Feature Contributions](#feature-contributions))
- ✅ All tests passing
- ✅ Code follows style guidelines
- ✅ No linting errors
- ✅ Meaningful commit messages
- ✅ Documentation updated (if needed)
- ✅ Migrations included (if database changes)

## Questions?

- **Feature ideas**: Start a [discussion](https://github.com/chrisvel/tududi/discussions/categories/feature-requests) or message [@chrisvel](https://github.com/chrisvel)
- **General questions**: Use [GitHub Discussions](https://github.com/chrisvel/tududi/discussions)
- **Bug reports**: Create an [issue](https://github.com/chrisvel/tududi/issues)
- **Direct contact**: Join our [Discord](https://discord.gg/fkbeJ9CmcH) or find maintainer contact info in the repository

---

**Remember**: For feature contributions, please discuss first before submitting a PR. We're excited to collaborate with you! 🎉
