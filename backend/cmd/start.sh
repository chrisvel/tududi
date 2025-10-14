#!/bin/sh
# Start script for production and Docker
set -eu

backup_db() {
  db_dir=$(dirname "$DB_FILE")
  today=$(date +"%Y%m%d")
  # Calculate 7 days ago using epoch time (POSIX-compliant, works with BusyBox)
  current_epoch=$(date +%s)
  week_ago_epoch=$((current_epoch - 604800))  # 7 days = 604800 seconds
  # Use -r for macOS/BSD date, -d for Linux/BusyBox
  if date -r "$week_ago_epoch" +"%Y%m%d" >/dev/null 2>&1; then
    # macOS/BSD style
    week_ago=$(date -r "$week_ago_epoch" +"%Y%m%d")
  else
    # Linux/BusyBox style
    week_ago=$(date -d "@$week_ago_epoch" +"%Y%m%d")
  fi
  
  # Clean up old backups
  for backup in "$db_dir"/db-backup-*.sqlite3; do
    [ -f "$backup" ] || continue
    
    # Extract date from filename (db-backup-YYYYMMDDHHMMSS.sqlite3)
    backup_date=$(basename "$backup" | sed 's/db-backup-\([0-9]\{8\}\).*/\1/')
    
    # Skip if we can't extract a valid date
    [ -n "$backup_date" ] || continue
    
    # Delete backups older than one week
    if [ "$backup_date" -lt "$week_ago" ]; then
      rm "$backup"
      echo "Deleted old backup (>1 week): $(basename "$backup")"
      continue
    fi
    
    # For dates before today (but within the week), keep only the most recent backup
    if [ "$backup_date" != "$today" ]; then
      # For this date, find all backups and keep only the newest
      day_backups=$(ls -t "$db_dir"/db-backup-${backup_date}*.sqlite3 2>/dev/null)
      first=true
      for old_backup in $day_backups; do
        if [ "$first" = true ]; then
          first=false
          continue  # Skip the newest one
        fi
        rm "$old_backup"
        echo "Deleted duplicate backup: $(basename "$old_backup")"
      done
    fi
  done
  
  # Count today's backups
  today_backup_count=$(find "$db_dir" -maxdepth 1 -name "db-backup-${today}*.sqlite3" -type f | wc -l)
  
  # If we have 4 or more backups from today, delete the oldest one from today
  if [ "$today_backup_count" -ge 4 ]; then
    oldest_today_backup=$(ls -t "$db_dir"/db-backup-${today}*.sqlite3 2>/dev/null | tail -n 1)
    if [ -n "$oldest_today_backup" ]; then
      rm "$oldest_today_backup"
      echo "Deleted oldest backup from today: $(basename "$oldest_today_backup")"
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
  node scripts/user-create.js "$TUDUDI_USER_EMAIL" "$TUDUDI_USER_PASSWORD" true || exit 1
fi

exec node app.js
