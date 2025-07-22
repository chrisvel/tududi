#!/bin/sh
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
  node -e "require(\"./models\").sequelize.sync({force:true}).then(()=>{console.log(\"DB ready\");process.exit(0)}).catch(e=>{console.error(\"❌\",e.message);process.exit(1)})"
else
  backup_db
  echo "Checking database connection..."
  node -e "require(\"./models\").sequelize.authenticate().then(()=>{console.log(\"DB OK\");process.exit(0)}).catch(e=>{console.error(\"❌\",e.message);process.exit(1)})"
fi

# Run database migrations automatically
echo "Running database migrations..."
if npx sequelize-cli db:migrate --config config/database.js; then
  echo "Migrations completed successfully"
else
  echo "Migration failed, but continuing startup (may be expected for new installations)"
fi

if [ -n "${TUDUDI_USER_EMAIL:-}" ] && [ -n "${TUDUDI_USER_PASSWORD:-}" ]; then
  node -e "const{User}=require(\"./models\");const bcrypt=require(\"bcrypt\");(async()=>{try{const[u,c]=await User.findOrCreate({where:{email:process.env.TUDUDI_USER_EMAIL},defaults:{email:process.env.TUDUDI_USER_EMAIL,password_digest:await bcrypt.hash(process.env.TUDUDI_USER_PASSWORD,10)}});console.log(c?\"✅ User created\":\"ℹ️ User exists\");process.exit(0)}catch(e){console.error(\"❌\",e.message);process.exit(1)}})();" || exit 1
fi

exec node app.js
