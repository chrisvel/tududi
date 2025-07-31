#!/bin/sh
# Start script for production and Docker
set -eu

backup_db() {
  db_dir=$(dirname "$DB_FILE")
    backup_count=$(find "$db_dir" -maxdepth 1 -name "db-backup-*.sqlite3" -type f | wc -l)

  if [ "$backup_count" -ge 4 ]; then
    # Delete the oldest backup file in the DB directory
    oldest_backup=$(ls -t "$db_dir"/db-backup-*.sqlite3 2>/dev/null | tail -n 1)
    if [ -n "$oldest_backup" ]; then
      rm "$oldest_backup"
      echo "Deleted oldest backup: $oldest_backup"
    fi
  fi

  timestamp=$(date +"%Y%m%d%H%M%S")
  backup_file="$db_dir/db-backup-${timestamp}.sqlite3"

  if [ -f "$DB_FILE" ]; then
    cp "$DB_FILE" "$backup_file"
    echo "Database backed up to $backup_file"
  else
    echo "Database file $DB_FILE not found, skipping backup"
  fi
}

# Check if database exists and create/authenticate
if [ ! -f "$DB_FILE" ]; then
  echo "Creating new database..."
  node scripts/db-init.js
else
  backup_db
  echo "Checking database connection..."
  node scripts/db-status.js
fi

# Run database migrations automatically
echo "Running database migrations..."
if npx sequelize-cli db:migrate --config config/database.js; then
  echo "Migrations completed successfully"
else
  echo "Migration failed, but continuing startup (may be expected for new installations)"
fi

if [ -n "${TUDUDI_USER_EMAIL:-}" ] && [ -n "${TUDUDI_USER_PASSWORD:-}" ]; then
  node scripts/user-create.js "$TUDUDI_USER_EMAIL" "$TUDUDI_USER_PASSWORD" || exit 1
fi

exec node app.js
