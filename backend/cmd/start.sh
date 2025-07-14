#!/bin/sh
set -eu

# Check and create directories with proper permissions
if [ ! -d "db" ]; then
  mkdir -p db
fi

if [ ! -w "db" ]; then
  if [ "$(id -u)" = "0" ]; then
    echo "⚠️  Attempting to fix permissions for /app/backend/db as root..."
    chown -R "$APP_UID":"$APP_GID" db || true
    chmod -R 770 db || true
    if [ ! -w "db" ]; then
      echo "❌ ERROR: Database directory /app/backend/db is not writable by user $APP_UID:$APP_GID after chown/chmod"
      exit 1
    fi
  else
    echo "❌ ERROR: Database directory /app/backend/db is not writable by user $(id -u):$(id -g)"
    echo "ℹ️  If using Docker volumes, ensure the host directory has proper ownership or run the container as root for automatic fix."
    exit 1
  fi
fi

mkdir -p certs

DB_FILE="db/production.sqlite3"
[ "$NODE_ENV" = "development" ] && DB_FILE="db/development.sqlite3"

# Check if database exists and create/authenticate
if [ ! -f "$DB_FILE" ]; then
  echo "🔧 Creating new database..."
  node -e "require(\"./models\").sequelize.sync({force:true}).then(()=>{console.log(\"✅ DB ready\");process.exit(0)}).catch(e=>{console.error(\"❌\",e.message);process.exit(1)})"
else
  echo "🔍 Checking database connection..."
  node -e "require(\"./models\").sequelize.authenticate().then(()=>{console.log(\"✅ DB OK\");process.exit(0)}).catch(e=>{console.error(\"❌\",e.message);process.exit(1)})"
fi

# Run database migrations automatically
echo "🔄 Running database migrations..."
if npx sequelize-cli db:migrate --config config/database.js; then
  echo "✅ Migrations completed successfully"
else
  echo "⚠️  Migration failed, but continuing startup (may be expected for new installations)"
fi

if [ -n "${TUDUDI_USER_EMAIL:-}" ] && [ -n "${TUDUDI_USER_PASSWORD:-}" ]; then
  node -e "const{User}=require(\"./models\");const bcrypt=require(\"bcrypt\");(async()=>{try{const[u,c]=await User.findOrCreate({where:{email:process.env.TUDUDI_USER_EMAIL},defaults:{email:process.env.TUDUDI_USER_EMAIL,password_digest:await bcrypt.hash(process.env.TUDUDI_USER_PASSWORD,10)}});console.log(c?\"✅ User created\":\"ℹ️ User exists\");process.exit(0)}catch(e){console.error(\"❌\",e.message);process.exit(1)}})();" || exit 1
fi

[ "${TUDUDI_INTERNAL_SSL_ENABLED:-}" = "true" ] && [ ! -f "certs/server.crt" ] && openssl req -x509 -newkey rsa:2048 -keyout certs/server.key -out certs/server.crt -days 365 -nodes -subj "/CN=localhost" 2>/dev/null || true

exec node app.js
