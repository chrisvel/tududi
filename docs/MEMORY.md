# Claude Memory & Preferences

This document contains preferences, patterns, and memory items specific to working with Claude Code on the tududi project.

---

## Pull Request Preferences

### PR Descriptions
- **Do NOT add** the "🤖 Generated with [Claude Code](https://claude.com/claude-code)" footer to pull requests
- Keep PR descriptions focused on the changes and test plan
- Follow the standard format:
  - Summary section with bullet points
  - Changes section with detailed breakdown
  - Test plan section with checkboxes

### PR Creation Workflow
- Always create PRs against the `main` branch
- Use descriptive branch names following the pattern: `fix/`, `feature/`, `refactor/`, etc.
- Include comprehensive test coverage in PRs

---

## Commit Message Preferences

### General Rules
- **Do NOT add** `Co-authored-by` trailers to commit messages (set globally in `~/.claude/CLAUDE.md`)
- Use conventional commit style when appropriate: `fix:`, `feat:`, `refactor:`, etc.
- Keep commit messages concise and descriptive

### Fixup Commits
- Use `fixup!` prefix for commits that should be squashed into previous commits
- These are typically used with `git rebase --autosquash`

---

## Testing Preferences

### Test Coverage Requirements
- All new features must include comprehensive unit tests
- Follow the Arrange-Act-Assert pattern (see [testing.md](testing.md))
- Test files should be colocated in `backend/tests/unit/` matching the module structure

### Running Tests
- Always run tests before pushing with `npm test`
- Pre-push hooks will automatically run linting, formatting, and tests

---

## Codebase Patterns to Remember

### Backend Patterns
- Follow the module architecture pattern described in [backend-patterns.md](backend-patterns.md)
- Use repository pattern for data access
- Keep business logic in service files

### Frontend Patterns
- TypeScript for new components
- Follow component organization in [directory-structure.md](directory-structure.md)
- Use Zustand for global state, SWR for server state

---

## Common Issues & Solutions

### Date Formatting
- Be consistent with date format handling across the application
- Pay attention to timezone handling in defer/scheduling features

### URL Detection
- The inbox processing service has URL detection logic
- URLs are detected even without projects for bookmark tag display

---

**Last Updated:** 2026-03-14
**Maintained by:** Claude Code sessions - update as new patterns emerge