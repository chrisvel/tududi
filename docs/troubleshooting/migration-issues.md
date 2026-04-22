# Migration Issues Troubleshooting

This guide helps diagnose and resolve common issues when upgrading from v1.0.0 or experiencing migration-related problems.

## Table of Contents

- [Password Migration Issues](#password-migration-issues)
- [Trust Proxy Configuration](#trust-proxy-configuration)
- [Common Docker Environment Issues](#common-docker-environment-issues)

---

## Password Migration Issues

### Symptoms

- Users cannot login with their old passwords after upgrading from v1.0.0
- Error messages like "Invalid credentials" even with correct password
- Login works for newly created users but not for existing users

### Root Cause

Version v1.0.0 used a `password` column to store bcrypt password hashes. Later versions renamed this to `password_digest` to support OIDC/SSO authentication. If the migration didn't run correctly, existing password hashes may not have been transferred to the new column.

### Diagnostic Steps

1. **Run the diagnostic script:**
   ```bash
   node backend/scripts/diagnose-password-migration.js
   ```

   This will check:
   - Which password-related columns exist in your database
   - How many users have password_digest values
   - Which users are affected (NULL password_digest)

2. **Review the output:**
   - If all users have password_digest values: ✅ No issues
   - If some users have NULL password_digest: ⚠️ Action needed

### Resolution

1. **Backup your database:**
   ```bash
   cp database.sqlite database.sqlite.backup
   ```
   Or for Docker:
   ```bash
   docker cp tududi-container:/app/database.sqlite ./database.sqlite.backup
   ```

2. **Verify the migration file is correct:**
   Check `backend/migrations/20260420000004-make-password-optional.js` at line 67.

   It should contain:
   ```javascript
   COALESCE(password_digest, password) as password_digest,
   ```

   NOT just:
   ```javascript
   password as password_digest,
   ```

3. **Re-run migrations:**
   ```bash
   npm run db:migrate
   ```

   For Docker:
   ```bash
   docker exec tududi-container npm run db:migrate
   ```

4. **Verify the fix:**
   ```bash
   node backend/scripts/diagnose-password-migration.js
   ```
   All users should now have password_digest values.

5. **Test login:**
   Try logging in with an affected user account.

### If Issues Persist

If users still cannot login after following these steps:

1. **Check database backups:**
   Tududi automatically creates backups before migrations in `database_backups/`.

2. **Restore from backup if needed:**
   ```bash
   cp database_backups/database.sqlite.<timestamp> database.sqlite
   ```

3. **Report the issue:**
   [Create a GitHub issue](https://github.com/chrisvel/tududi/issues) with:
   - Output from diagnostic script
   - Migration file content (line 67)
   - Database file (if possible to share safely)

---

## Trust Proxy Configuration

### Symptoms

- Error in logs: `ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false`
- Setting `TUDUDI_TRUST_PROXY=true` doesn't fix the error
- Rate limiting errors when accessing the application

### Root Cause

When Tududi runs behind a reverse proxy (Nginx, Caddy, Traefik, etc.), the proxy adds `X-Forwarded-For` headers to identify the original client IP. Express needs to be told to trust these headers via the `trust proxy` setting.

### Diagnostic Steps

1. **Check startup logs:**
   Look for the trust proxy configuration message when the server starts:
   ```
   [Config] TUDUDI_TRUST_PROXY=true parsed as boolean true
   [Trust Proxy] Enabled with value: true
   ```

2. **Check health endpoint:**
   ```bash
   curl http://localhost:3002/api/health
   ```
   The response should include:
   ```json
   {
     "status": "ok",
     "trustProxy": true
   }
   ```

3. **If the logs show `false` or the health endpoint shows `false`:**
   The environment variable is not being read correctly.

### Resolution

#### For Docker/Podman Users

1. **Set environment variable in docker-compose.yml:**
   ```yaml
   environment:
     - TUDUDI_TRUST_PROXY=true
     - TUDUDI_ALLOWED_ORIGINS=https://your-domain.com
   ```

2. **Or use docker run:**
   ```bash
   docker run \
     -e TUDUDI_TRUST_PROXY=true \
     -e TUDUDI_ALLOWED_ORIGINS=https://your-domain.com \
     ...
   ```

3. **Restart container:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

4. **Verify in logs:**
   ```bash
   docker logs tududi-container | grep "Trust Proxy"
   ```
   Should show: `[Trust Proxy] Enabled with value: true`

#### For Non-Docker Users

1. **Set in .env file:**
   ```bash
   TUDUDI_TRUST_PROXY=true
   ```

2. **Ensure .env file is in project root**

3. **Restart server:**
   ```bash
   npm start
   ```

4. **Check startup logs:**
   Should show: `[Trust Proxy] Enabled with value: true`

### Valid Values

| Value | Meaning |
|-------|---------|
| `true` | Trust all proxies (simplest option for single-proxy setups) |
| `false` | Don't trust any proxies (default) |
| `1` | Trust the first hop only |
| `loopback` | Trust loopback addresses (127.0.0.1/::1) |
| `172.16.0.0/12` | Trust a specific subnet |

### Common Mistakes

1. **❌ Spaces around equals sign:**
   ```bash
   TUDUDI_TRUST_PROXY = true  # Wrong!
   ```
   Should be:
   ```bash
   TUDUDI_TRUST_PROXY=true    # Correct
   ```

2. **❌ Not restarting container:**
   Environment variables are only read at startup. Always restart after changes.

3. **❌ Setting in wrong .env file:**
   For Docker, the .env file in the host system might not be mounted. Use `-e` flag or docker-compose environment section.

4. **❌ Conflicting environment variables:**
   System-wide environment variables override .env file. Check with:
   ```bash
   printenv | grep TUDUDI_TRUST_PROXY
   ```

---

## Common Docker Environment Issues

### Environment Variables Not Being Read

**Symptoms:**
- Setting an environment variable doesn't affect the application
- Logs show "not set" even though you set it

**Resolution:**

1. **Verify the variable is in the container:**
   ```bash
   docker exec tududi-container printenv | grep TUDUDI
   ```

2. **For docker-compose, use environment section:**
   ```yaml
   services:
     tududi:
       environment:
         - TUDUDI_TRUST_PROXY=true
       # OR
       env_file:
         - .env
   ```

3. **Rebuild and restart:**
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

### Database Locked Errors

**Symptoms:**
- `SQLITE_BUSY: database is locked`
- Migration fails with locking errors

**Resolution:**

1. **Stop all containers accessing the database:**
   ```bash
   docker-compose down
   ```

2. **Ensure no processes are using the database:**
   ```bash
   lsof database.sqlite
   ```

3. **Restart:**
   ```bash
   docker-compose up -d
   ```

---

## Getting Help

If you're still experiencing issues after following this guide:

1. **Discord Community:** [Join Discord](https://discord.gg/fkbeJ9CmcH)
2. **GitHub Issues:** [Report a bug](https://github.com/chrisvel/tududi/issues)
3. **Discussions:** [Ask in Discussions](https://github.com/chrisvel/tududi/discussions)

When asking for help, please include:
- Output from diagnostic script (if password-related)
- Startup logs showing trust proxy configuration
- Docker compose file (remove sensitive values)
- Steps you've already tried
