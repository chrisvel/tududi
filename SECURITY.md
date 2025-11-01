# Security Policy

## Supported Versions

We release security updates for the following versions of tududi:

| Version | Supported          |
| ------- | ------------------ |
| 0.85.x  | :white_check_mark: |
| < 0.85  | :x:                |

We recommend always running the latest version to ensure you have the latest security patches.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in tududi, please report it privately to help us fix it before public disclosure.

### How to Report

1. **Email:** Send details to the repository owner via GitHub or open a [Security Advisory](https://github.com/chrisvel/tududi/security/advisories/new)

2. **Include in your report:**
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Suggested fix (if you have one)
   - Your contact information

### What to Expect

- **Acknowledgment:** We'll acknowledge receipt of your report within 48 hours
- **Updates:** We'll keep you informed about the progress of fixing the issue
- **Timeline:** We aim to release a fix within 30 days for critical vulnerabilities
- **Credit:** We'll credit you in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices

When deploying tududi, we recommend:

### Production Deployment

- **Use strong passwords:** Set secure `TUDUDI_USER_PASSWORD` and `TUDUDI_SESSION_SECRET`
- **HTTPS only:** Always use HTTPS in production (reverse proxy with Let's Encrypt)
- **Keep updated:** Regularly update to the latest version
- **Secure database:** Protect database files with proper permissions
- **Environment variables:** Never commit `.env` files or secrets to version control
- **Backup regularly:** Keep secure backups of your database

### Docker Security

```bash
# Generate strong session secret
TUDUDI_SESSION_SECRET=$(openssl rand -hex 64)

# Use secure volumes with proper permissions
chmod 700 ~/tududi_db
chmod 700 ~/tududi_uploads
```

### Self-Hosting Checklist

- [ ] Strong, unique passwords for all accounts
- [ ] HTTPS enabled with valid certificate
- [ ] Database files protected (not publicly accessible)
- [ ] Regular security updates applied
- [ ] Firewall configured to restrict access
- [ ] Regular backups scheduled

## Known Security Considerations

### Authentication & Sessions

- Sessions use `express-session` with secure settings
- Passwords are hashed with bcrypt
- Session secrets should be cryptographically random (64+ characters)

### Data Storage

- SQLite database stores all user data
- Uploads are stored in the filesystem
- Ensure proper file permissions on production servers

### Telegram Integration

- Bot tokens are sensitive credentials
- Store `TELEGRAM_BOT_TOKEN` securely
- Never expose tokens in logs or error messages

## Security Updates

Security updates are released as patch versions (e.g., 0.85.1 → 0.85.2). Critical vulnerabilities may warrant immediate releases.

Subscribe to [GitHub Releases](https://github.com/chrisvel/tududi/releases) or watch the repository to be notified of security updates.

---

Thank you for helping keep tududi and its users secure!
