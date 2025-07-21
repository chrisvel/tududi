#!/bin/sh
set -eu

# Runtime UID/GID Configuration
# This script allows setting the user ID and group ID at runtime using PUID and PGID environment variables

# Get runtime UID/GID from environment variables, fallback to build-time defaults
PUID=${PUID:-${APP_UID:-1001}}
PGID=${PGID:-${APP_GID:-1001}}

# Get current app user/group info.
# Assuming the current user/group is app:app
# as created in our Dockerfile.
CURRENT_UID=$(id -u app)
CURRENT_GID=$(id -g app)

echo "Runtime UID/GID Configuration"
echo "Current: $CURRENT_UID:$CURRENT_GID"
echo "Target:  $PUID:$PGID"

# Function to set database file permissions if it exists
set_db_file_permissions() {
    if [ -f "$DB_FILE" ]; then
        chmod 660 "$DB_FILE"
        echo "Set database file permissions: $DB_FILE"
    else
        echo "Database file not found (first-time installation): $DB_FILE"
    fi
}

# Only modify user/group if different from current user's
if [ "$CURRENT_UID" != "$PUID" ] || [ "$CURRENT_GID" != "$PGID" ]; then
    echo "Configuring user permissions..."

    deluser app 2>/dev/null || true
    delgroup app 2>/dev/null || true

    if getent group "$PGID" >/dev/null 2>&1; then
        TARGET_GROUP=$(getent group "$PGID" | cut -d: -f1)
        echo "Using existing group '$TARGET_GROUP' with GUID $PGID"
    else
        # Create group "app" with our target group id
        addgroup -g "$PGID" -S app
        TARGET_GROUP="app"
        echo "Created 'app' group with GID: $PGID"
    fi

    TARGET_USER=$(getent passwd "$PUID" | cut -d: -f1)
    if [ -n "$TARGET_USER" ]; then
        echo "Using existing user '$TARGET_USER' with UID $PUID"
    else
        # Create user "app" with our target user id
        adduser -S app -u "$PUID" -G "$TARGET_GROUP"
        echo "Created 'app' user with UID: $PUID"
        TARGET_USER=app
    fi

    echo "User configuration completed"
else
    TARGET_USER=$(getent passwd "$PUID" | cut -d: -f1)
    TARGET_GROUP=$(getent group "$PGID" | cut -d: -f1)
fi

echo "Setting ownership of application directories to $TARGET_USER:$TARGET_GROUP"
mkdir -p /app/backend/db /app/backend/certs
chown -R "$TARGET_USER":"$TARGET_GROUP" /app/backend /app/scripts
chmod 770 /app/backend/db /app/backend/certs
set_db_file_permissions

# Drop privileges and execute the original start script
echo "Starting application as user $TARGET_USER"
exec su-exec "$TARGET_USER" dumb-init -- /app/backend/cmd/start.sh
