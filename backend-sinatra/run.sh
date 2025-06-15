#! /bin/bash 

export TUDUDI_SESSION_SECRET=7e9ca5868791e1e2da76b46deb760e7536967de380984ae30836433d212a94d362b500507e07f9c9f6e7e99cba0befd02925e378546565783de3c1648503aaf9

# Ensure database directory exists
mkdir -p db

# Check if database exists, if not create it
if [ ! -f "db/development.sqlite3" ]; then
  echo "Creating development database..."
  bundle exec rake db:setup
fi

# Check database connection and retry if needed
MAX_RETRIES=3
RETRY_COUNT=0
DB_CONNECTED=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$DB_CONNECTED" = false ]; do
  echo "Testing database connection (attempt $(($RETRY_COUNT + 1))/${MAX_RETRIES})..."
  if bundle exec ruby -e "require 'sqlite3'; begin; SQLite3::Database.new('db/development.sqlite3'); puts 'Database connection successful'; exit 0; rescue => e; puts \"Database error: #{e.message}\"; exit 1; end"; then
    DB_CONNECTED=true
  else
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
      echo "Connection failed, waiting 3 seconds before retry..."
      sleep 3
    fi
  fi
done

if [ "$DB_CONNECTED" = false ]; then
  echo "Failed to connect to database after ${MAX_RETRIES} attempts. Exiting."
  exit 1
fi

# Run puma server
echo "Starting puma server..."
puma -C app/config/puma.rb