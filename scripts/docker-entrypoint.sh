#!/bin/sh
set -eu

# Runtime UID/GID Configuration
# This script allows setting the user ID and group ID at runtime using PUID and PGID environment variables
# This solves the issue where hardcoded UID/GID (1001:1001) conflicts with host system users

# Get runtime UID/GID from environment variables, fallback to build-time defaults
PUID=${PUID:-${APP_UID:-1001}}
PGID=${PGID:-${APP_GID:-1001}}

# Get current app user/group info
CURRENT_UID=$(id -u app)
CURRENT_GID=$(id -g app)

echo "Runtime UID/GID Configuration"
echo "Current: $CURRENT_UID:$CURRENT_GID"
echo "Target:  $PUID:$PGID"

# Only modify user/group if different from current
if [ "$CURRENT_UID" != "$PUID" ] || [ "$CURRENT_GID" != "$PGID" ]; then
    echo "Configuring user permissions..."

    deluser app 2>/dev/null || true
    delgroup app 2>/dev/null || true

    if getent group "$PGID" >/dev/null 2>&1; then
        TARGET_GROUP=$(getent group "$PGID" | cut -d: -f1)
        echo "Using existing group: $TARGET_GROUP ($PGID)"
    else
        addgroup -g "$PGID" -S app
        TARGET_GROUP="app"
        echo "Created app group with GID: $PGID"
    fi

    if getent passwd "$PUID" >/dev/null 2>&1; then
        echo "Using existing user with UID $PUID"
    else
        adduser -S app -u "$PUID" -G "$TARGET_GROUP"
        echo "Created user with UID: $PUID, GID: $PGID"
    fi

    echo "Fixing ownership of application directories..."
    chown -R app:$TARGET_GROUP /app
    mkdir -p /app/backend/db /app/backend/certs
    chown -R app:$TARGET_GROUP /app/backend/db /app/backend/certs
    chmod 770 /app/backend/db /app/backend/certs

    echo "User configuration completed"
else
    echo "No user configuration needed"
fi

# Drop privileges and execute the original start script
echo "🚀 Starting application as user $(id -u app):$(id -g app)"
exec su-exec app dumb-init -- /app/backend/cmd/start.sh
