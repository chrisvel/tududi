# OIDC/SSO Authentication

This guide explains how to configure and use OpenID Connect (OIDC) Single Sign-On (SSO) authentication in Tududi.

**Related:** [User Management](08-user-management.md), [Architecture Overview](architecture.md)

---

## Table of Contents

- [Overview](#overview)
- [Why Use OIDC/SSO](#why-use-oidcsso)
- [Supported Providers](#supported-providers)
- [Configuration](#configuration)
  - [Single Provider Setup](#single-provider-setup)
  - [Multiple Providers Setup](#multiple-providers-setup)
  - [Environment Variables Reference](#environment-variables-reference)
- [Provider Setup Guides](#provider-setup-guides)
  - [Google](#google)
  - [Okta](#okta)
  - [Keycloak](#keycloak)
  - [Authentik](#authentik)
  - [PocketID](#pocketid)
  - [Azure AD](#azure-ad)
  - [Kanidm](#kanidm)
- [User Features](#user-features)
  - [Logging In with SSO](#logging-in-with-sso)
  - [Account Linking](#account-linking)
  - [Managing Connected Accounts](#managing-connected-accounts)
- [Advanced Topics](#advanced-topics)
  - [Auto-Provisioning](#auto-provisioning)
  - [Admin Role Assignment](#admin-role-assignment)
  - [Hybrid Authentication](#hybrid-authentication)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

---

## Overview

OIDC (OpenID Connect) is a modern authentication protocol that allows users to sign in to Tududi using external identity providers like Google, Okta, Keycloak, or any OIDC-compliant service.

**Key Features:**
- **Single Sign-On:** Use your existing corporate or personal accounts
- **Just-In-Time Provisioning:** New users are automatically created on first login
- **Account Linking:** Connect multiple authentication methods to one account
- **Hybrid Authentication:** Choose between email/password or SSO login
- **Multiple Providers:** Support for multiple OIDC providers simultaneously

---

## Why Use OIDC/SSO

**For Enterprise Users:**
- Centralized identity management
- Enforce corporate security policies
- Simplified user onboarding/offboarding
- Compliance with security standards

**For Self-Hosters:**
- Use existing authentication infrastructure (Keycloak, Authentik)
- Reduce password fatigue
- Leverage provider security features (2FA, security keys)
- Simplify family/team access management

**For Individual Users:**
- One-click login with Google, Microsoft, etc.
- No need to remember another password
- Automatic profile updates from provider

---

## Supported Providers

Tududi supports any OIDC-compliant identity provider, including:

| Provider | Type | Typical Use Case |
|----------|------|------------------|
| **Google** | Public | Personal accounts, G Suite |
| **Okta** | Enterprise | Corporate SSO |
| **Keycloak** | Self-hosted | Open-source identity management |
| **Authentik** | Self-hosted | Homelab, small business |
| **PocketID** | Public | Decentralized identity |
| **Azure AD** | Enterprise | Microsoft 365 organizations |
| **Kanidm** | Self-hosted / Enterprise | Homelab, corporate SSO |
| **Generic OIDC** | Any | Custom providers with `.well-known/openid-configuration` |

---

## Configuration

OIDC providers are configured via environment variables in your `.env` file. After making changes, **restart the Tududi server** for them to take effect.

### Single Provider Setup

For most users, a single provider is sufficient:

```bash
# Enable OIDC
OIDC_ENABLED=true

# Provider Configuration
OIDC_PROVIDER_NAME=Google
OIDC_PROVIDER_SLUG=google
OIDC_ISSUER_URL=https://accounts.google.com
OIDC_CLIENT_ID=your-client-id.apps.googleusercontent.com
OIDC_CLIENT_SECRET=your-client-secret
OIDC_SCOPE=openid profile email

# Auto-provisioning (recommended)
OIDC_AUTO_PROVISION=true

# Optional: Auto-assign admin role to specific email domains
OIDC_ADMIN_EMAIL_DOMAINS=example.com,mycompany.com
```

**Required Variables:**
- `OIDC_PROVIDER_NAME`: Display name shown to users (e.g., "Google", "Company SSO")
- `OIDC_PROVIDER_SLUG`: URL-safe identifier (e.g., "google", "okta")
- `OIDC_ISSUER_URL`: Provider's OIDC discovery URL
- `OIDC_CLIENT_ID`: OAuth 2.0 client ID from provider
- `OIDC_CLIENT_SECRET`: OAuth 2.0 client secret from provider

### Multiple Providers Setup

To support multiple providers, use numbered environment variables:

```bash
# Enable OIDC
OIDC_ENABLED=true

# Provider 1: Google
OIDC_PROVIDER_1_NAME=Google
OIDC_PROVIDER_1_SLUG=google
OIDC_PROVIDER_1_ISSUER=https://accounts.google.com
OIDC_PROVIDER_1_CLIENT_ID=xxx.apps.googleusercontent.com
OIDC_PROVIDER_1_CLIENT_SECRET=xxx
OIDC_PROVIDER_1_SCOPE=openid profile email
OIDC_PROVIDER_1_AUTO_PROVISION=true

# Provider 2: Company Okta
OIDC_PROVIDER_2_NAME=Company SSO
OIDC_PROVIDER_2_SLUG=okta
OIDC_PROVIDER_2_ISSUER=https://company.okta.com
OIDC_PROVIDER_2_CLIENT_ID=yyy
OIDC_PROVIDER_2_CLIENT_SECRET=yyy
OIDC_PROVIDER_2_AUTO_PROVISION=true
OIDC_PROVIDER_2_ADMIN_EMAIL_DOMAINS=company.com

# Provider 3: Self-hosted Authentik
OIDC_PROVIDER_3_NAME=Authentik
OIDC_PROVIDER_3_SLUG=authentik
OIDC_PROVIDER_3_ISSUER=https://auth.example.com/application/o/tududi/
OIDC_PROVIDER_3_CLIENT_ID=zzz
OIDC_PROVIDER_3_CLIENT_SECRET=zzz
OIDC_PROVIDER_3_AUTO_PROVISION=true
```

**Numbering Rules:**
- Start at `OIDC_PROVIDER_1_*`, increment sequentially
- No gaps allowed (1, 2, 3... not 1, 3, 5)
- Maximum: Practical limit ~5 providers (no hard limit)

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OIDC_ENABLED` | Yes | `false` | Enable/disable OIDC feature |
| `OIDC_PROVIDER_NAME` | Yes | - | Provider display name |
| `OIDC_PROVIDER_SLUG` | Yes | - | URL-safe identifier |
| `OIDC_ISSUER_URL` | Yes | - | OIDC discovery endpoint |
| `OIDC_CLIENT_ID` | Yes | - | OAuth client ID |
| `OIDC_CLIENT_SECRET` | Yes | - | OAuth client secret |
| `OIDC_SCOPE` | No | `openid profile email` | OAuth scopes (space-separated) |
| `OIDC_AUTO_PROVISION` | No | `true` | Auto-create users on first login |
| `OIDC_ADMIN_EMAIL_DOMAINS` | No | - | Comma-separated domains for auto-admin |
| `BASE_URL` | Yes | - | Tududi base URL (for OAuth callbacks) |

**Scope Formatting:**

The `OIDC_SCOPE` parameter accepts space-separated OAuth scopes. Tududi automatically normalizes the scope value by:
- Trimming leading/trailing whitespace
- Collapsing multiple spaces into single spaces
- Ensuring `openid` is always included (adding it if missing)
- Properly URL-encoding the scope in authorization requests

Examples of valid scope formats:
```bash
OIDC_SCOPE=openid profile email
OIDC_SCOPE="openid profile email groups"
OIDC_SCOPE=openid  profile  email    # Extra spaces are automatically normalized
```

**Note:** Do not manually URL-encode the scope value (e.g., using `%20` or `+`). Use regular spaces - Tududi handles the encoding automatically.

**Important:** The `BASE_URL` variable must be set for OAuth redirects to work:
```bash
BASE_URL=http://localhost:3002  # Development
BASE_URL=https://tududi.example.com  # Production
```

**Trust Proxy Configuration (Required for Production):**

If Tududi is deployed behind a reverse proxy (nginx, Traefik, Apache, etc.), you **must** configure Express to trust the proxy:

```bash
TUDUDI_TRUST_PROXY=true
```

This is required for:
- Proper session handling after OIDC login
- Rate limiting based on actual client IP addresses
- Correct IP logging in audit trails

Without this setting, you may experience:
- Session loss after SSO login (401 errors)
- Rate limiter errors: `ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false`

---

## Provider Setup Guides

### Google

**1. Create OAuth 2.0 Credentials**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. Select **Web application**
6. Add authorized redirect URIs:
   - Development: `http://localhost:3002/api/oidc/callback/google`
   - Production: `https://your-domain.com/api/oidc/callback/google`
7. Copy **Client ID** and **Client Secret**

**2. Configure Tududi**

```bash
OIDC_ENABLED=true
OIDC_PROVIDER_NAME=Google
OIDC_PROVIDER_SLUG=google
OIDC_ISSUER_URL=https://accounts.google.com
OIDC_CLIENT_ID=123456789.apps.googleusercontent.com
OIDC_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
OIDC_SCOPE=openid profile email
OIDC_AUTO_PROVISION=true
```

**3. Test**

- Restart Tududi
- Navigate to login page
- Click "Sign in with Google"
- Approve permissions
- You should be logged in!

---

### Okta

**1. Create OIDC Application**

1. Log in to your Okta admin console
2. Go to **Applications** > **Applications**
3. Click **Create App Integration**
4. Select **OIDC - OpenID Connect**
5. Select **Web Application**
6. Configure:
   - **Sign-in redirect URIs:** `https://your-domain.com/api/oidc/callback/okta`
   - **Sign-out redirect URIs:** `https://your-domain.com/login`
   - **Controlled access:** Choose your access policy
7. Save and note the **Client ID** and **Client Secret**

**2. Find Your Issuer URL**

Format: `https://{your-domain}.okta.com`

Example: `https://company.okta.com`

**3. Configure Tududi**

```bash
OIDC_ENABLED=true
OIDC_PROVIDER_NAME=Company SSO
OIDC_PROVIDER_SLUG=okta
OIDC_ISSUER_URL=https://company.okta.com
OIDC_CLIENT_ID=0oa123456789abcde
OIDC_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
OIDC_SCOPE=openid profile email
OIDC_AUTO_PROVISION=true
OIDC_ADMIN_EMAIL_DOMAINS=company.com
```

---

### Keycloak

**1. Create OIDC Client**

1. Log in to Keycloak admin console
2. Select your realm
3. Go to **Clients** > **Create client**
4. Configure:
   - **Client type:** OpenID Connect
   - **Client ID:** `tududi`
   - **Client authentication:** ON (confidential)
   - **Valid redirect URIs:** `https://your-domain.com/api/oidc/callback/keycloak`
5. Go to **Credentials** tab and copy **Client secret**

**2. Find Your Issuer URL**

Format: `https://{keycloak-domain}/realms/{realm-name}`

Example: `https://auth.example.com/realms/myrealm`

**3. Configure Tududi**

```bash
OIDC_ENABLED=true
OIDC_PROVIDER_NAME=Keycloak
OIDC_PROVIDER_SLUG=keycloak
OIDC_ISSUER_URL=https://auth.example.com/realms/myrealm
OIDC_CLIENT_ID=tududi
OIDC_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
OIDC_SCOPE=openid profile email
OIDC_AUTO_PROVISION=true
```

---

### Authentik

**1. Create OAuth2/OIDC Provider**

1. Log in to Authentik admin interface
2. Go to **Applications** > **Providers**
3. Click **Create** and select **OAuth2/OpenID Provider**
4. Configure:
   - **Name:** Tududi
   - **Authorization flow:** Choose your flow
   - **Redirect URIs:** `https://your-domain.com/api/oidc/callback/authentik`
   - **Signing Key:** Select a certificate
5. Note the **Client ID** and **Client Secret**

**2. Create Application**

1. Go to **Applications** > **Applications**
2. Click **Create**
3. Link the provider you just created
4. Configure slug and other settings

**3. Find Your Issuer URL**

Format: `https://{authentik-domain}/application/o/{application-slug}/`

Example: `https://auth.example.com/application/o/tududi/`

**4. Configure Tududi**

```bash
OIDC_ENABLED=true
OIDC_PROVIDER_NAME=Authentik
OIDC_PROVIDER_SLUG=authentik
OIDC_ISSUER_URL=https://auth.example.com/application/o/tududi/
OIDC_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
OIDC_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
OIDC_SCOPE=openid profile email
OIDC_AUTO_PROVISION=true
```

---

### PocketID

**1. Register Application**

1. Go to [PocketID Developer Console](https://pocketid.app/developer)
2. Create a new application
3. Configure:
   - **Name:** Tududi
   - **Redirect URI:** `https://your-domain.com/api/oidc/callback/pocketid`
4. Note the **Client ID** and **Client Secret**

**2. Configure Tududi**

```bash
OIDC_ENABLED=true
OIDC_PROVIDER_NAME=PocketID
OIDC_PROVIDER_SLUG=pocketid
OIDC_ISSUER_URL=https://pocketid.app
OIDC_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
OIDC_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
OIDC_SCOPE=openid profile email
OIDC_AUTO_PROVISION=true
```

---

### Azure AD

**1. Register Application**

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Configure:
   - **Name:** Tududi
   - **Supported account types:** Choose your option
   - **Redirect URI:** Web - `https://your-domain.com/api/oidc/callback/azure`
5. After creation, go to **Certificates & secrets**
6. Create a new **Client secret** and copy it
7. Note the **Application (client) ID**

**2. Find Your Tenant ID**

Go to **Azure Active Directory** > **Overview** and copy the **Tenant ID**

**3. Configure Tududi**

```bash
OIDC_ENABLED=true
OIDC_PROVIDER_NAME=Microsoft
OIDC_PROVIDER_SLUG=azure
OIDC_ISSUER_URL=https://login.microsoftonline.com/{tenant-id}/v2.0
OIDC_CLIENT_ID=12345678-1234-1234-1234-123456789012
OIDC_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
OIDC_SCOPE=openid profile email
OIDC_AUTO_PROVISION=true
```

Replace `{tenant-id}` with your actual tenant ID.

---

### Kanidm

**1. Register Application**

1. In your terminal (using [kanidm cli](https://kanidm.github.io/kanidm/stable/client_tools.html)), create a new oauth2 application with `kanidm system oauth2 create [appname] [displayname] [url]` (e.g: `kanidm system oauth2 create tududi_app Tududi https://your-tududi-domain.tld`)
2. Get a client secret with `kanidm system oauth2 show-basic-secret [appname]`
3. Make sure to change the PKCE and cipher settings:
   - Since tududi doesn't support PKCE, run: `kanidm system oauth2 warning-insecure-client-disable-pkce [appname]`
   - Since tududi only supports RS256, not ES256, run: `kanidm system oauth2 warning-enable-legacy-crypto [appname]`
4. Add a redirect URI with `kanidm system oauth2 add-redirect-url https://your-tududi-domain.tld/api/oidc/callback/[appname]`
5. Configure claims with `kanidm system oauth2 update-scope-map [appname] [groupname] [scopes]`. If you're unsure, you can use `idm_all_persons` as the group to grant access to all users, or create a new groups with `kanidm group create [groupname]` and add users with `kanidm group add-members [groupname] [members]`. In scopes, you can use `openid profile email`.

**3. Configure Tududi**

```bash
OIDC_ENABLED=true
OIDC_PROVIDER_NAME=xxx #Put some UI friendly name here to show up on the login page
OIDC_PROVIDER_SLUG=appname #from step 1.1
OIDC_ISSUER_URL=https://your-kanidm-domain.tld/oauth2/openid/appname/ #make sure to replace appname with the name of the app from step 1.1
OIDC_CLIENT_ID=appname #from step 1.1
OIDC_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx #from step 1.2
OIDC_SCOPE=openid profile email
OIDC_AUTO_PROVISION=true
```

**4. Configure your reverse proxy**

Since Tududi will try and get OIDC information from `/.well-known/openid-configuration`, which doesn't work with Kanidm, you'll need to rewrite this path to the right one.

For example, in Caddy, you can do it this way:
```
your-tududi-domain.tld {
    # ... (your imports, if any)

    # 1. Define a named matcher for Tududi's IP and the broken discovery path
    @tududi_discovery {
        remote_ip [your tududi instance's IP address]
        path /.well-known/openid-configuration
    }

    # 2. Rewrite ONLY requests matching both conditions
    rewrite @tududi_discovery /oauth2/openid/[appname]/.well-known/openid-configuration

    # ... your existing reverse_proxy statement

}
```

---

## User Features

### Logging In with SSO

**First-Time Users:**

1. Navigate to Tududi login page
2. Click the provider button (e.g., "Sign in with Google")
3. You'll be redirected to the provider's login page
4. Approve the requested permissions
5. You'll be redirected back to Tududi and logged in
6. A new account is automatically created (if auto-provisioning is enabled)

**Returning Users:**

1. Click your provider button on the login page
2. If already logged in to provider, you'll be immediately authenticated
3. Redirected to the Today page

### Account Linking

Users with existing email/password accounts can link SSO providers:

**Steps:**

1. Log in with email/password
2. Go to **Profile** > **Security** tab
3. Scroll to **Connected Accounts** section
4. Click **Link [Provider Name]**
5. Approve permissions at provider
6. Provider is now linked to your account

**Benefits:**
- Log in with either email/password OR SSO
- Switch between auth methods freely
- Maintain single account with multiple login options

### Managing Connected Accounts

**View Connected Accounts:**

Go to **Profile** > **Security** > **Connected Accounts** to see:
- Linked providers
- Email addresses from each provider
- Date first linked
- Last login date

**Unlink Account:**

1. Click **Unlink** next to the provider
2. Confirm the action

**Important:** You cannot unlink your last authentication method. You must have either:
- A password set, OR
- At least one OIDC identity linked

---

## Advanced Topics

### Auto-Provisioning

When `OIDC_AUTO_PROVISION=true` (default), new users are automatically created on first login.

**How It Works:**

1. User completes SSO login
2. Tududi checks if an OIDC identity exists for this provider + user ID
3. If not, checks if a user with the email exists:
   - **User exists:** Links OIDC identity to existing user
   - **User doesn't exist:** Creates new user with:
     - Email from OIDC claims (verified)
     - Username from email prefix
     - No password (OIDC-only account)
     - Optional admin role (if domain matches)
4. User is logged in

**Disable Auto-Provisioning:**

```bash
OIDC_AUTO_PROVISION=false
```

When disabled:
- Only users with pre-linked OIDC identities can log in
- New SSO users are rejected with an error
- Useful for invite-only deployments

### Admin Role Assignment

Automatically grant admin privileges based on email domain:

```bash
OIDC_ADMIN_EMAIL_DOMAINS=company.com,example.org
```

**Rules:**
- New users with emails from these domains become admins
- Applies only on first provisioning (not on subsequent logins)
- Existing non-admin users are not promoted
- Case-insensitive domain matching

**Use Cases:**
- Corporate deployments: Trust internal email domains
- Family instances: Trust your domain
- Multi-tenant: Different providers for different admin groups

### Hybrid Authentication

Tududi supports hybrid authentication where users choose their preferred method:

**Scenarios:**

1. **Email/Password Only:** Traditional authentication
2. **SSO Only:** OIDC-only users (no password set)
3. **Both:** Users can use either method

**For OIDC-Only Users:**

If a user was created via SSO and has no password:
- Attempting email/password login shows: "This account uses SSO. Please sign in with your SSO provider."
- User must log in via SSO or set a password via password reset

**For Email/Password Users:**

- Can link SSO providers at any time
- Both auth methods work independently
- Unlinking SSO doesn't affect password login

### SSO-Only Mode

For deployments that want to enforce SSO-only authentication, password-based login and registration can be completely disabled.

**Configuration:**

```bash
# Disable password authentication
PASSWORD_AUTH_ENABLED=false

# Ensure OIDC is properly configured
OIDC_ENABLED=true
OIDC_PROVIDER_NAME=Your Provider
# ... other OIDC settings
```

**Behavior When Disabled:**

1. **Login Page:**
   - Password login form is hidden
   - Only OIDC provider buttons are shown
   - Registration link is hidden

2. **Registration:**
   - `/register` page shows "Password Registration Disabled" message
   - Direct registration attempts return 403 Forbidden
   - New users must use SSO (auto-provisioning must be enabled)

3. **API Behavior:**
   - `POST /api/login` with credentials returns 403: "Password login is disabled. Please use SSO to sign in."
   - `POST /api/register` returns 403: "Password registration is disabled. Please use SSO to sign in."
   - `GET /api/password-auth-status` returns `{ "enabled": false }`

**Use Cases:**

- **Corporate Deployments:** Enforce centralized identity management
- **Security Compliance:** Eliminate password management burden
- **Simplified UX:** Single authentication method for all users

**Important Considerations:**

1. **OIDC Must Be Configured:** Ensure at least one OIDC provider is configured before disabling password auth
2. **Auto-Provisioning Required:** Set `OIDC_AUTO_PROVISION=true` to allow new users to register via SSO
3. **Existing Users:** Users with passwords can no longer log in with them, must link SSO or be manually migrated
4. **Admin Access:** Ensure at least one admin can access via SSO before disabling password auth

**Migration Steps:**

If transitioning from password to SSO-only:

1. **Step 1:** Configure OIDC providers with `OIDC_ENABLED=true`
2. **Step 2:** Notify users to link their SSO accounts (Profile > Security > Connected Accounts)
3. **Step 3:** Verify all users have SSO identities linked
4. **Step 4:** Set `PASSWORD_AUTH_ENABLED=false` and restart server
5. **Step 5:** Monitor logs for authentication issues

**Rollback:**

To re-enable password authentication:
```bash
PASSWORD_AUTH_ENABLED=true  # or remove the variable
```
Restart the server. Password login will immediately become available again.

---

## Troubleshooting

### Session Lost After SSO Login (401 Errors)

**Symptoms:**
- Successfully authenticate with SSO provider
- Redirected to `/today` page
- Immediately see login screen again
- API calls return 401 "Authentication required"
- Browser logs show repeated 401 errors on `/api/profile`

**Cause:** Express is not configured to trust the reverse proxy, causing session cookies to not be set properly.

**Solution:**

Add to your `.env` file:
```bash
TUDUDI_TRUST_PROXY=true
```

Then restart the Tududi server:
```bash
docker compose restart  # For Docker
npm start              # For standalone
```

**Verification:**

After restarting, the error log should no longer show:
```
ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false
```

### "Provider not found" Error

**Cause:** The provider slug in the URL doesn't match any configured provider.

**Solution:**
1. Check `.env` file for correct `OIDC_PROVIDER_SLUG` value
2. Ensure slug is URL-safe (lowercase, no spaces)
3. Restart server after `.env` changes

### "Invalid state parameter" Error

**Cause:** OAuth state validation failed (security check).

**Possible Reasons:**
- State expired (>10 minutes old)
- Callback URL mismatch
- State already consumed

**Solution:**
1. Start the login flow again (don't reuse old URLs)
2. Check `BASE_URL` matches your actual domain
3. Verify callback URL in provider settings

### "Auto-provisioning disabled" Error

**Cause:** User doesn't exist and `OIDC_AUTO_PROVISION=false`.

**Solution:**
- Enable auto-provisioning: `OIDC_AUTO_PROVISION=true`, OR
- Create user account manually first, then link SSO

### Provider Button Not Showing

**Cause:** Provider not loaded from `.env`.

**Solution:**
1. Check `OIDC_ENABLED=true` is set
2. Verify all required variables are present
3. Check for typos in variable names
4. Restart server
5. Check browser console for API errors

### "Invalid grant" or Token Errors

**Cause:** JWT validation failed.

**Possible Reasons:**
- Wrong client secret
- Clock skew between servers
- Issuer URL mismatch

**Solution:**
1. Verify `OIDC_CLIENT_SECRET` matches provider
2. Ensure server time is accurate (NTP sync)
3. Check `OIDC_ISSUER_URL` exactly matches provider's issuer claim

### Callback URL Mismatch

**Cause:** Redirect URI configured in provider doesn't match Tududi's callback.

**Solution:**
1. Callback URL format: `{BASE_URL}/api/oidc/callback/{slug}`
2. Example: `https://tududi.example.com/api/oidc/callback/google`
3. Must match exactly in provider settings (including http/https)
4. Update provider settings and restart Tududi

### Can't Unlink Last Auth Method

**Cause:** Safety check prevents losing all access.

**Solution:**
1. Set a password first (Profile > Security)
2. Then unlink OIDC identity, OR
3. Link another OIDC provider first

---

## Security Considerations

### Secret Storage

- Client secrets are stored in `.env` file (plaintext)
- Ensure `.env` is never committed to version control (already in `.gitignore`)
- Use proper file permissions: `chmod 600 .env` on Linux/macOS
- For production, consider Docker secrets or Kubernetes secrets

### OAuth Flow Security

Tududi implements standard OAuth 2.0 security measures:

1. **CSRF Protection:** Cryptographically random state parameter (32 bytes)
2. **Replay Protection:** State is one-time use, 10-minute TTL
3. **JWT Validation:** ID tokens verified against provider's JWKS
4. **Nonce Validation:** Prevents token reuse attacks
5. **TLS Enforcement:** Always use HTTPS in production

### Data Privacy

**What's Stored:**
- OIDC subject (provider's user ID)
- Email, name, profile picture from claims
- Full raw claims (JSON) for debugging
- First/last login timestamps

**What's Not Stored:**
- Provider passwords
- OAuth access tokens (discarded after login)
- Refresh tokens

### Audit Trail

All authentication events are logged (if audit logging is enabled):
- Login success/failure
- OIDC linking/unlinking
- Provider information
- IP address and user agent

Check logs at: `/backend/logs/` (if enabled)

### Rate Limiting

OIDC endpoints are protected by rate limiting:
- `/api/oidc/auth/*`: 5 requests per 15 minutes per IP
- `/api/oidc/callback/*`: 5 requests per 15 minutes per IP
- Linking/unlinking: Standard authenticated API limits

### Best Practices

1. **Use HTTPS:** Always use HTTPS in production
2. **Restrict Callback URLs:** Only whitelist exact callback URLs needed
3. **Rotate Secrets:** Periodically rotate client secrets
4. **Monitor Logs:** Watch for suspicious authentication attempts
5. **Limit Providers:** Only enable providers you trust
6. **Email Verification:** Trust provider's email verification
7. **Review Permissions:** Only request necessary OAuth scopes

---

## Migration from Email/Password

Existing deployments can gradually adopt OIDC:

**Step 1: Configure Providers**

Add OIDC configuration to `.env` without removing email/password support.

**Step 2: Notify Users**

Announce new SSO option to users.

**Step 3: Users Link Accounts**

Existing users can link SSO providers to their accounts via Profile > Security.

**Step 4: Optional - Disable Email/Password**

Not recommended, but possible by customizing the frontend Login component.

**Rollback:**

Simply set `OIDC_ENABLED=false` and restart. Email/password authentication continues to work.

---

## API Integration

**Fetch Available Providers:**

```bash
GET /api/oidc/providers
```

Response:
```json
[
  {
    "slug": "google",
    "name": "Google",
    "button_text": "Sign in with {name}",
    "type": "oidc"
  }
]
```

**Initiate Login Flow:**

Redirect user to:
```
GET /api/oidc/auth/{slug}
```

**User's Connected Identities:**

```bash
GET /api/oidc/identities
Authorization: Bearer <token>
```

See [Swagger API docs](http://localhost:3002/api-docs) for full API reference.

---

## Support

**Issues:** [GitHub Issues](https://github.com/chrisvel/tududi/issues)
**Discussions:** [GitHub Discussions](https://github.com/chrisvel/tududi/discussions)
**Discord:** [Join our community](https://discord.gg/fkbeJ9CmcH)

**Related Documentation:**
- [User Management](08-user-management.md)
- [Architecture Overview](architecture.md)
- [Development Workflow](development-workflow.md)

---

**Document Version:** 1.0.0
**Last Updated:** 2026-04-20
**Maintainer:** Update when OIDC features change
