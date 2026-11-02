#!/bin/sh
# Start script for production and Docker
set -eu

: "${NODE_ENV:=production}"
export NODE_ENV

# Verify the connection and create the schema when the database is empty
echo "Preparing database..."
# Both steps run under a PostgreSQL advisory lock so that several app
# containers booting together cannot create the schema or migrate twice.
if ! node scripts/with-db-lock.js node scripts/db-prepare.js; then
  echo "❌ Database preparation failed. Check the connection settings above."
  echo "   tududi needs PostgreSQL (DATABASE_URL). For local development:"
  echo "   docker compose -f docker-compose.dev.yml up -d db"
  exit 1
fi

# Run database migrations automatically
echo "Running database migrations..."
if ! node scripts/with-db-lock.js npx sequelize-cli db:migrate --config config/database.js; then
  echo "❌ Migration failed. Container cannot start with an incomplete schema."
  echo "   Check the migration error above and restore from a pg_dump backup if needed."
  exit 1
fi
echo "Migrations completed successfully"

if [ -n "${TUDUDI_USER_EMAIL:-}" ] && [ -n "${TUDUDI_USER_PASSWORD:-}" ]; then
  # Trim whitespace/carriage returns that may come from docker-compose env vars
  TUDUDI_USER_EMAIL=$(printf '%s' "$TUDUDI_USER_EMAIL" | tr -d '[:space:]')
  if ! node scripts/user-create.js "$TUDUDI_USER_EMAIL" "$TUDUDI_USER_PASSWORD" true; then
    echo "❌ Failed to create/update user. Check migration errors above."
    exit 1
  fi
fi

exec node app.js
