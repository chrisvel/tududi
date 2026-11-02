# Archived 1.x migrations

These are the migrations tududi 1.x ran. They are kept for reference and never run: sequelize-cli only reads the files directly in `backend/migrations/`.

tududi 2.0 creates a fresh database from the models and records every migration as applied. An existing database must have been started once on the final 1.x release so that the newest file here is in its `SequelizeMeta` table; `scripts/db-prepare.js` refuses to continue otherwise.

New migrations go in `backend/migrations/` (use `npm run migration:create`).
