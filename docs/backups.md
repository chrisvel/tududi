# Backups & Restoration

[← Back to Index](../CLAUDE.md)

---

## Overview

Tududi automatically creates SQLite database file backups before migrations and on startup to protect your data. These backups ensure you have a recovery point if a migration fails or if you need to restore to a previous state.

---

## Automatic SQLite File Backups

### When Backups Are Created

SQLite database file backups are **automatically created** in these scenarios:

1. **Before migrations** - Every time the app starts and finds an existing database
2. **On startup** - Before running any database operations (Docker/production)
3. **Manual trigger** - Via the backup script

**Location:** `/backend/cmd/start.sh` (lines 9-78)

### Backup File Location

- **Development:** `/backend/db/db-backup-YYYYMMDDHHMMSS.sqlite3`
- **Docker/Production:** `/app/backend/db/db-backup-YYYYMMDDHHMMSS.sqlite3` (mounted volume)

### Backup Retention Policy

The system automatically manages backup retention with these rules:

| Timeframe | Retention Policy |
|-----------|------------------|
| **Today** | Keep up to 4 most recent backups |
| **Past 7 days** | Keep 1 backup per day (most recent) |
| **Older than 7 days** | Automatically deleted |

**Example:**
```
db-backup-20260315083000.sqlite3  ← Today (backup #1)
db-backup-20260315070000.sqlite3  ← Today (backup #2)
db-backup-20260314193000.sqlite3  ← Yesterday (only 1 kept)
db-backup-20260313100000.sqlite3  ← 2 days ago (only 1 kept)
db-backup-20260308120000.sqlite3  ← Automatically deleted (>7 days)
```

### How Automatic Backups Work

When the app starts (via `npm start` or Docker):

1. Check if `DB_FILE` exists
2. If exists, call `backup_db()` function
3. Clean old backups based on retention policy
4. Create timestamped copy: `cp $DB_FILE $backup_file`
5. Run migrations: `npx sequelize-cli db:migrate`
6. Start application

**Critical:** Backups are created **before** migrations run, ensuring you have a recovery point if a migration fails.

---

## Restoring from SQLite File Backup

### Quick Restore (Development)

```bash
# 1. Stop the application
npm stop  # or Ctrl+C

# 2. List available backups
ls -lh backend/db/db-backup-*.sqlite3

# 3. Identify the backup to restore (e.g., db-backup-20260314193000.sqlite3)

# 4. Backup current state (optional but recommended)
cp backend/db/development.sqlite3 backend/db/development.sqlite3.before-restore

# 5. Restore the backup
cp backend/db/db-backup-20260314193000.sqlite3 backend/db/development.sqlite3

# 6. Restart the application
npm start
```

### Restore in Docker

```bash
# 1. Stop the container
docker-compose down

# 2. Access the host volume (find your volume location)
docker volume inspect tududi_db_data

# 3. Navigate to the mount point and list backups
cd /var/lib/docker/volumes/tududi_db_data/_data
ls -lh db-backup-*.sqlite3

# 4. Backup current state
cp production.sqlite3 production.sqlite3.before-restore

# 5. Restore from backup
cp db-backup-20260314193000.sqlite3 production.sqlite3

# 6. Restart the container
docker-compose up -d
```

### Emergency Restore (Production)

If a migration fails and the app won't start:

```bash
# The start script creates a backup BEFORE migrations
# So the most recent backup is from before the failed migration

cd backend/db

# Find the most recent backup (will be from just before failure)
ls -lt db-backup-*.sqlite3 | head -1

# Restore it
cp db-backup-20260315083000.sqlite3 production.sqlite3

# Try starting again
npm start
```

---

## Best Practices

### 1. Before Major Changes

Create a manual backup before:
- Upgrading Tududi to a new version
- Running manual migrations
- Bulk data operations
- Testing new features

```bash
# Quick manual backup (development)
cp backend/db/development.sqlite3 backend/db/manual-backup-$(date +%Y%m%d%H%M%S).sqlite3
```

### 2. External Backups

For production:
- Copy `/backend/db/*.sqlite3` to external storage weekly
- Test restore procedures periodically

### 3. Docker Volume Backups

Backup the entire Docker volume:

```bash
# Backup Docker volume
docker run --rm \
  -v tududi_db_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/tududi-db-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restore Docker volume
docker run --rm \
  -v tududi_db_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/tududi-db-backup-20260314.tar.gz -C /data
```

### 4. Migration Rollback Strategy

If a migration fails:

1. **Don't panic** - automatic backup was created
2. Stop the application
3. Restore the most recent automatic backup (created before migration)
4. Investigate the migration issue
5. Fix the migration or rollback: `npm run migration:undo`

### 5. Test Restore Procedures

Periodically test that backups can be restored:

```bash
# Test restore in a safe environment
cp backend/db/db-backup-20260314193000.sqlite3 backend/db/test-restore.sqlite3

# Verify the backup file is readable
sqlite3 backend/db/test-restore.sqlite3 "SELECT COUNT(*) FROM Tasks;"
```

---

## Backup Commands Reference

```bash
# Manual backup (development)
cp backend/db/development.sqlite3 backend/db/manual-backup-$(date +%Y%m%d%H%M%S).sqlite3

# Manual backup (production)
cp backend/db/production.sqlite3 backend/db/manual-backup-$(date +%Y%m%d%H%M%S).sqlite3

# List all backups
ls -lh backend/db/db-backup-*.sqlite3

# Restore specific backup
cp backend/db/db-backup-20260314193000.sqlite3 backend/db/development.sqlite3

# Verify backup file integrity
sqlite3 backend/db/db-backup-20260314193000.sqlite3 "PRAGMA integrity_check;"
```

---

## Troubleshooting

### Backup File Not Found

**Problem:** Can't find automatic backup after startup failure

**Solution:** Check if database existed before startup. Backups are only created for existing databases.

```bash
# New installations won't have backups yet
# First run creates database, second run creates first backup
```

### Restore Fails with "Database is locked"

**Problem:** SQLite database is locked during restore

**Solution:** Ensure the application is fully stopped

```bash
# Kill all node processes
pkill -f "node.*tududi"

# Verify no processes are using the database
lsof backend/db/development.sqlite3

# Then attempt restore
```

### Large Backup Files

**Problem:** Backup files consuming too much space

**Solution:** Automatic cleanup runs on every startup. For manual cleanup:

```bash
# Delete backups older than 7 days manually
find backend/db -name "db-backup-*.sqlite3" -mtime +7 -delete

# Or keep only last 10 backups
ls -t backend/db/db-backup-*.sqlite3 | tail -n +11 | xargs rm
```

---

## Implementation Details

### Backup Script Location

The automatic backup script is located at `/backend/cmd/start.sh` (lines 9-78).

**Key functions:**
- `backup_db()` - Creates timestamped SQLite file copy
- Automatic cleanup based on retention policy
- Runs before every migration

---

## Related Documentation

- [Database & Migrations](database.md) - Schema changes and migrations
- [Development Workflow](development-workflow.md) - Database management commands
- [Architecture](architecture.md) - Data model relationships

---

[← Back to Index](../CLAUDE.md)