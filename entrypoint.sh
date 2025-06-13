#!/bin/bash
set -e

# Get current UID and GID
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)

echo "Running as UID: $CURRENT_UID, GID: $CURRENT_GID"

# Verify write access to required directories
echo "Verifying directory permissions..."
for dir in tududi_db certs tmp log db; do
    if [ -w "/usr/src/app/$dir" ]; then
        echo "✓ Can write to $dir"
    else
        echo "✗ Cannot write to $dir - attempting to fix..."
        # Try to make it writable (this might fail, but worth trying)
        chmod 777 "/usr/src/app/$dir" 2>/dev/null || echo "  Warning: Could not fix permissions for $dir"
    fi
done

# Generate SSL certificates if needed and not already present
if [ "$TUDUDI_INTERNAL_SSL_ENABLED" = "true" ] && [ ! -f certs/server.crt ]; then
  echo "Generating SSL certificates..."
  openssl req -x509 -newkey rsa:4096 \
    -keyout certs/server.key -out certs/server.crt \
    -days 365 -nodes \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
  
  echo "✓ SSL certificates generated"
fi

# Run database migrations
echo "Running database migrations..."
bundle exec rake db:migrate

# Create user if it does not exist
if [ -n "$TUDUDI_USER_EMAIL" ] && [ -n "$TUDUDI_USER_PASSWORD" ]; then
  echo "Creating user if it does not exist..."
  echo "user = User.find_by(email: \"$TUDUDI_USER_EMAIL\") || User.create(email: \"$TUDUDI_USER_EMAIL\", password: ********); puts \"User: #{user.email}\"" | bundle exec rake console
fi

# Final verification
echo "=== Environment Check ==="
echo "UID: $CURRENT_UID, GID: $CURRENT_GID"
echo "Working directory: $(pwd)"
echo "Database directory writable: $([ -w tududi_db ] && echo 'YES' || echo 'NO')"

# Start backend with both API and static file serving
echo "Starting tududi application..."
exec bundle exec puma -C app/config/puma.rb
