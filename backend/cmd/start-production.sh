#!/bin/sh
# Production start script with .env file support
set -eu

# Function to load environment variables from .env file
load_env_file() {
    if [ -f ".env" ]; then
        echo "Loading environment variables from .env file..."
        # Export all variables from .env file
        # This handles comments, empty lines, and quoted values
        while IFS= read -r line || [ -n "$line" ]; do
            # Skip comments and empty lines
            case "$line" in
                \#*|"") continue ;;
            esac
            
            # Export the variable (handles both KEY=value and export KEY=value formats)
            case "$line" in
                export\ *) eval "$line" ;;
                *=*) export "$line" ;;
            esac
        done < ".env"
        echo "Environment variables loaded successfully"
    else
        echo "Warning: .env file not found. Using system environment variables only."
    fi
}

# Function to validate required environment variables
validate_env_vars() {
    local missing_vars=()
    
    # Check for required variables
    if [ -z "${NODE_ENV:-}" ]; then
        export NODE_ENV=production
        echo "NODE_ENV not set, defaulting to production"
    fi
    
    if [ -z "${TUDUDI_SESSION_SECRET:-}" ]; then
        echo "Warning: TUDUDI_SESSION_SECRET not set. Using random secret."
    fi
    
    if [ -z "${TUDUDI_USER_EMAIL:-}" ]; then
        echo "Warning: TUDUDI_USER_EMAIL not set. No default user will be created."
    fi
    
    if [ -z "${TUDUDI_USER_PASSWORD:-}" ]; then
        echo "Warning: TUDUDI_USER_PASSWORD not set. No default user will be created."
    fi
    
    # Set defaults for optional variables
    export DB_FILE="${DB_FILE:-db/production.sqlite3}"
    export PORT="${PORT:-3002}"
    export HOST="${HOST:-0.0.0.0}"
    export FRONTEND_URL="${FRONTEND_URL:-http://localhost:8080}"
    export TUDUDI_UPLOAD_PATH="${TUDUDI_UPLOAD_PATH:-uploads}"
    export DISABLE_SCHEDULER="${DISABLE_SCHEDULER:-false}"
    export DISABLE_TELEGRAM="${DISABLE_TELEGRAM:-false}"
    
    # Set default allowed origins if not specified
    if [ -z "${TUDUDI_ALLOWED_ORIGINS:-}" ]; then
        export TUDUDI_ALLOWED_ORIGINS="http://localhost:8080,http://localhost:3002,http://127.0.0.1:8080,http://127.0.0.1:3002"
    fi
    
    echo "Environment configuration:"
    echo "  NODE_ENV: ${NODE_ENV}"
    echo "  DB_FILE: ${DB_FILE}"
    echo "  PORT: ${PORT}"
    echo "  HOST: ${HOST}"
    echo "  FRONTEND_URL: ${FRONTEND_URL}"
    echo "  TUDUDI_UPLOAD_PATH: ${TUDUDI_UPLOAD_PATH}"
    echo "  DISABLE_SCHEDULER: ${DISABLE_SCHEDULER}"
    echo "  DISABLE_TELEGRAM: ${DISABLE_TELEGRAM}"
    echo "  TUDUDI_ALLOWED_ORIGINS: ${TUDUDI_ALLOWED_ORIGINS}"
}

# Function to backup database (same as start.sh)
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

# Main execution
echo "Starting tududi in production mode..."

# Load environment variables from .env file
load_env_file

# Validate and set default environment variables
validate_env_vars

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

# Create user if credentials are provided
if [ -n "${TUDUDI_USER_EMAIL:-}" ] && [ -n "${TUDUDI_USER_PASSWORD:-}" ]; then
    echo "Creating/updating user account..."
    node scripts/user-create.js "$TUDUDI_USER_EMAIL" "$TUDUDI_USER_PASSWORD" || exit 1
fi

# Start the application
echo "Starting tududi application..."
exec node app.js
