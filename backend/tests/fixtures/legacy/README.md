# Legacy SQLite fixtures

Databases exactly as older tududi releases leave them, used by the upgrade
suite (`npm run backend:test:upgrade`, see `backend/tests/upgrade`) to prove
that the current migrations run cleanly on real pre-existing data.

| File             | Produced by           | Migrations applied |
| ---------------- | --------------------- | ------------------ |
| `v1.2.4.sqlite3` | v1.2.4 `cmd/start.sh` | 94                 |
| `v1.3.0.sqlite3` | v1.3.0 `cmd/start.sh` | 98                 |
| `v1.3.1.sqlite3` | v1.3.1 `cmd/start.sh` | 102                |
| `v1.4.0.sqlite3` | v1.4.0 `cmd/start.sh` | 107                |
| `v1.4.2.sqlite3` | v1.4.2 `cmd/start.sh` | 107                |

`manifest.json` records the commit, sha256, row counts and generation date of
each file. v1.2.4 stands in for the whole 1.2 line: v1.2.0 has the same schema
but its own fresh install fails on a non-idempotent migration (fixed in
v1.2.1), so it cannot bootstrap itself.

## What is inside

Every fixture holds the same deterministic dataset, seeded by
`seed-legacy.js` through that release's own models (columns that did not exist
yet are dropped automatically):

- users `Alice.Legacy@Example.COM` (admin, password `password123`, stored with
  a mixed-case email like accounts created before February 2026) and
  `bob@example.com`; the v1.4.0 fixture also has `carol@example.com` and
  `Carol@Example.com`, which differ only by case
- 3 areas, 2 goals, one project per status plus a project without area, due
  date or priority
- user tags and pinned system tags, tasks in every status and priority
  (including null priority and null due date), an overdue task, a weekly
  recurring task with two instances, a parent with three subtasks, a habit
- task events, a recurring completion, an attachment row, notes with tags,
  inbox items, people, a shared project permission, a view, an API token,
  notifications, a calendar token and CalDAV calendar, sync state and
  occurrence override rows

## Regenerating

```bash
npm run fixtures:legacy                # all tags in the table above
npm run fixtures:legacy -- v1.4.2      # one tag
```

The script checks each tag out into a temporary git worktree, runs
`npm install` there, boots that release's `backend/cmd/start.sh` against an
empty `DB_FILE`, seeds it, checkpoints the WAL, vacuums and copies the file
here. It needs the `sqlite3` and `curl` CLIs and a few minutes per tag. Use
`LEGACY_SCRATCH=/some/dir KEEP_WORKTREES=1` to reuse the worktrees across
runs.

Regenerate a fixture only when its release changes (it should not) or when
the seeded dataset needs new rows; commit the new `.sqlite3` together with the
updated `manifest.json`.
