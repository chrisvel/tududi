# OIDC/SSO Implementation Plan for Tududi

**GitHub Issue:** [#977 - Add SSO/OIDC Support for Enterprise Authentication](https://github.com/chrisvel/tududi/issues/977)

## Context

Tududi currently only supports email/password authentication. This feature request adds OpenID Connect (OIDC) support to enable Single Sign-On via external identity providers (Google, Okta, Keycloak, Authentik, PocketID, etc.). This is a highly requested feature for both enterprise deployments and homelab users who standardize on SSO.

**Key Requirements:**
- Support multiple OIDC providers configured via environment variables
- Just-In-Time (JIT) user provisioning from OIDC claims
- Account linking (connect OIDC to existing email/password accounts)
- Hybrid authentication (users can choose email/password OR OIDC)
- Simple .env-based configuration (self-hoster friendly)
- Maintain backward compatibility with existing authentication

**Community Interest:** Users specifically mentioned PocketID support and requested this not be enterprise-gated.

**Implementation Approach:** Start with .env-based configuration for simplicity and faster delivery. Admin UI for provider management can be added in a future release if needed.

---

## Implementation Summary

### .env-Based Configuration

This implementation uses **environment variables** for OIDC provider configuration instead of database storage and admin UI.

**Key Differences from Full Admin UI Approach:**

| Aspect | .env Approach (This Plan) | Admin UI Approach |
|--------|---------------------------|-------------------|
| **Configuration** | Edit `.env` file, restart server | Web UI, no restart needed |
| **Tables** | 3 tables (identities, state, audit) | 4 tables (+ providers table) |
| **Timeline** | Faster | Longer |
| **Complexity** | Lower | Higher |
| **Target Audience** | Self-hosters with shell access | Non-technical admins |
| **Secret Storage** | .env plaintext (standard practice) | Database with AES-256-GCM |
| **Provider Limit** | Practical for 1-5 providers | Scales to 10+ providers |
| **Migration Path** | Can add admin UI later | N/A |

**Why This Approach:**
- ✅ **Faster delivery:** Ship OIDC faster
- ✅ **Simpler codebase:** Less code to maintain
- ✅ **Familiar pattern:** Self-hosters already edit .env for DB, SMTP, etc.
- ✅ **Sufficient for MVP:** Most users need 1-2 providers
- ✅ **Clear upgrade path:** Can always add UI later

**Trade-offs:**
- ⚠️ Requires server restart to change providers
- ⚠️ Requires shell/file access (not web-based)
- ⚠️ No per-provider enable/disable toggle

---

## Database Schema Changes

### 1. New Tables

#### `oidc_identities` - Links users to OIDC identities
```sql
CREATE TABLE oidc_identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_slug STRING NOT NULL,           -- Matches slug from .env (e.g., "google", "okta")

  -- OIDC Claims
  subject STRING NOT NULL,                 -- Provider's unique user ID
  email STRING,
  name STRING,
  given_name STRING,
  family_name STRING,
  picture STRING,

  -- Metadata
  raw_claims JSON,
  first_login_at DATETIME,
  last_login_at DATETIME,

  created_at DATETIME,
  updated_at DATETIME,

  UNIQUE(provider_slug, subject)
);

CREATE INDEX idx_identities_user ON oidc_identities(user_id);
CREATE INDEX idx_identities_provider_slug ON oidc_identities(provider_slug);
CREATE INDEX idx_identities_email ON oidc_identities(email);
```

**Migration:** `20260420000001-create-oidc-identities.js`

#### `oidc_state_nonces` - Temporary OAuth state validation (CSRF protection)
```sql
CREATE TABLE oidc_state_nonces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  state STRING UNIQUE NOT NULL,
  nonce STRING NOT NULL,
  provider_slug STRING NOT NULL,           -- Matches slug from .env
  code_verifier STRING,                    -- For PKCE (future)
  redirect_uri STRING,
  expires_at DATETIME NOT NULL,            -- 10 minute TTL
  created_at DATETIME
);

CREATE INDEX idx_state_nonces_state ON oidc_state_nonces(state);
CREATE INDEX idx_state_nonces_expires ON oidc_state_nonces(expires_at);
```

**Migration:** `20260420000002-create-oidc-state-nonces.js`

#### `auth_audit_log` - Security audit trail (Optional)
```sql
CREATE TABLE auth_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type STRING NOT NULL,              -- login_success, login_failed, logout, oidc_linked, oidc_unlinked
  auth_method STRING NOT NULL,             -- email_password, oidc, api_token
  provider_slug STRING,                    -- OIDC provider slug (if applicable)
  ip_address STRING,
  user_agent STRING,
  metadata JSON,
  created_at DATETIME
);

CREATE INDEX idx_audit_user ON auth_audit_log(user_id);
CREATE INDEX idx_audit_event ON auth_audit_log(event_type);
CREATE INDEX idx_audit_created ON auth_audit_log(created_at);
```

**Migration:** `20260420000003-create-auth-audit-log.js` (optional, can be added later)

### 2. User Model Changes

**Make password optional** for OIDC-only users:

```javascript
// backend/models/user.js
password_digest: {
    type: DataTypes.STRING,
    allowNull: true,  // Changed from false
    field: 'password_digest',
}
```

**Add validation:** Users must have either `password_digest` OR at least one `oidc_identity`.

**Migration:** `20260420000004-make-password-optional.js`

---

## Backend Implementation

### Module Structure

Create new OIDC module at `/backend/modules/oidc/`:

```
backend/modules/oidc/
├── index.js                   # Module exports
├── routes.js                  # Express routes
├── controller.js              # HTTP handlers
├── service.js                 # Core OIDC flow (openid-client)
├── providerConfig.js          # Load providers from .env
├── oidcIdentityService.js     # Identity linking/unlinking
├── stateManager.js            # State/nonce management
├── provisioningService.js     # JIT user provisioning
└── auditService.js            # Auth event logging (optional)
```

### Key Services

#### 1. `providerConfig.js` - Load Providers from Environment
**Purpose:** Parse and validate OIDC provider configuration from .env

**Methods:**
- `loadProvidersFromEnv()` → array of provider configs
- `getProvider(slug)` → single provider config
- `getAllProviders()` → all enabled providers

**Environment Variables:**

**Single Provider:**
```bash
OIDC_ENABLED=true
OIDC_PROVIDER_NAME=Google
OIDC_PROVIDER_SLUG=google
OIDC_ISSUER_URL=https://accounts.google.com
OIDC_CLIENT_ID=xxx
OIDC_CLIENT_SECRET=xxx
OIDC_SCOPE=openid profile email
OIDC_AUTO_PROVISION=true
OIDC_ADMIN_EMAIL_DOMAINS=example.com,company.com
```

**Multiple Providers (Numbered):**
```bash
OIDC_ENABLED=true

# Provider 1
OIDC_PROVIDER_1_NAME=Google
OIDC_PROVIDER_1_SLUG=google
OIDC_PROVIDER_1_ISSUER=https://accounts.google.com
OIDC_PROVIDER_1_CLIENT_ID=xxx
OIDC_PROVIDER_1_CLIENT_SECRET=xxx
OIDC_PROVIDER_1_SCOPE=openid profile email
OIDC_PROVIDER_1_AUTO_PROVISION=true

# Provider 2
OIDC_PROVIDER_2_NAME=Okta
OIDC_PROVIDER_2_SLUG=okta
OIDC_PROVIDER_2_ISSUER=https://company.okta.com
OIDC_PROVIDER_2_CLIENT_ID=yyy
OIDC_PROVIDER_2_CLIENT_SECRET=yyy
OIDC_PROVIDER_2_ADMIN_EMAIL_DOMAINS=company.com
```

**Implementation:**
```javascript
function loadProvidersFromEnv() {
  if (process.env.OIDC_ENABLED !== 'true') {
    return [];
  }

  const providers = [];

  // Try numbered providers (OIDC_PROVIDER_1_*, OIDC_PROVIDER_2_*, ...)
  let i = 1;
  while (process.env[`OIDC_PROVIDER_${i}_NAME`]) {
    providers.push({
      slug: process.env[`OIDC_PROVIDER_${i}_SLUG`],
      name: process.env[`OIDC_PROVIDER_${i}_NAME`],
      issuer: process.env[`OIDC_PROVIDER_${i}_ISSUER`],
      clientId: process.env[`OIDC_PROVIDER_${i}_CLIENT_ID`],
      clientSecret: process.env[`OIDC_PROVIDER_${i}_CLIENT_SECRET`],
      scope: process.env[`OIDC_PROVIDER_${i}_SCOPE`] || 'openid profile email',
      autoProvision: process.env[`OIDC_PROVIDER_${i}_AUTO_PROVISION`] !== 'false',
      adminEmailDomains: parseCommaSeparated(
        process.env[`OIDC_PROVIDER_${i}_ADMIN_EMAIL_DOMAINS`]
      ),
    });
    i++;
  }

  // Fallback to single provider
  if (providers.length === 0 && process.env.OIDC_PROVIDER_NAME) {
    providers.push({
      slug: process.env.OIDC_PROVIDER_SLUG || 'default',
      name: process.env.OIDC_PROVIDER_NAME,
      issuer: process.env.OIDC_ISSUER_URL,
      clientId: process.env.OIDC_CLIENT_ID,
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      scope: process.env.OIDC_SCOPE || 'openid profile email',
      autoProvision: process.env.OIDC_AUTO_PROVISION !== 'false',
      adminEmailDomains: parseCommaSeparated(
        process.env.OIDC_ADMIN_EMAIL_DOMAINS
      ),
    });
  }

  return providers;
}
```

#### 2. `service.js` - Core OIDC Flow
**Purpose:** Handle OAuth 2.0 authorization code flow using `openid-client` library

**Dependency:** `npm install openid-client@^6.2.0`

**Methods:**
- `discoverProvider(issuerUrl)` → cached OIDC metadata
- `initiateAuthFlow(providerSlug, req)` → authorization URL
- `handleCallback(providerSlug, code, state)` → user + tokens
- `validateIdToken(idToken, nonce, issuer)` → claims

**Flow:**
1. **Initiate:** Load provider from .env, generate state/nonce, store in DB, redirect to provider
2. **Callback:** Validate state, exchange code for tokens, validate JWT
3. **Provision:** Create or link user, update claims
4. **Session:** Set `req.session.userId` (integrates with existing auth)

**Key Implementation:**
```javascript
const { Issuer } = require('openid-client');
const providerConfig = require('./providerConfig');

async function initiateAuthFlow(providerSlug, req) {
  const config = providerConfig.getProvider(providerSlug);
  if (!config) throw new Error('Provider not found');

  const issuer = await Issuer.discover(config.issuer);
  const client = new issuer.Client({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uris: [`${process.env.BASE_URL}/api/oidc/callback/${providerSlug}`],
    response_types: ['code'],
  });

  const { state, nonce } = await stateManager.createState(providerSlug);

  const authUrl = client.authorizationUrl({
    scope: config.scope,
    state,
    nonce,
  });

  return authUrl;
}
```

#### 3. `provisioningService.js` - JIT User Creation
**Purpose:** Auto-create or link users from OIDC claims

**Logic:**
1. Check if `oidc_identity` exists (provider_slug + subject)
   - **Exists:** Update last_login_at, return user
2. Check if user with email exists
   - **Exists + auto_provision:** Link identity to user
   - **Not exists + auto_provision:** Create new user (no password)
3. Apply admin rules from .env (email domain matching)
4. Store claims in `oidc_identities`

**Implementation:**
```javascript
async function provisionUser(providerSlug, claims) {
  const config = providerConfig.getProvider(providerSlug);

  // Check existing identity
  let identity = await OIDCIdentity.findOne({
    where: { provider_slug: providerSlug, subject: claims.sub }
  });

  if (identity) {
    await identity.update({ last_login_at: new Date() });
    return await User.findByPk(identity.user_id);
  }

  // Check if auto-provision is enabled
  if (!config.autoProvision) {
    throw new Error('Auto-provisioning disabled for this provider');
  }

  // Find or create user
  let user = await User.findOne({ where: { email: claims.email } });

  if (!user) {
    // Create new user (no password)
    user = await User.create({
      email: claims.email,
      username: claims.email.split('@')[0],
      verified_email: true,  // Trust OIDC provider
      is_admin: shouldBeAdmin(config, claims.email),
    });
  }

  // Link identity
  await OIDCIdentity.create({
    user_id: user.id,
    provider_slug: providerSlug,
    subject: claims.sub,
    email: claims.email,
    name: claims.name,
    picture: claims.picture,
    raw_claims: claims,
    first_login_at: new Date(),
    last_login_at: new Date(),
  });

  return user;
}

function shouldBeAdmin(config, email) {
  if (!config.adminEmailDomains || config.adminEmailDomains.length === 0) {
    return false;
  }
  const domain = email.split('@')[1];
  return config.adminEmailDomains.includes(domain);
}
```

#### 4. `stateManager.js` - OAuth State Management
**Purpose:** CSRF protection via state/nonce with 10-minute TTL

**Methods:**
- `createState(providerSlug)` → `{ state, nonce }`
- `validateState(state)` → `{ nonce, providerSlug }`
- `consumeState(state)` → delete record (one-time use)

**Implementation:**
```javascript
const crypto = require('crypto');
const { OIDCStateNonce } = require('../../models');

async function createState(providerSlug) {
  const state = crypto.randomBytes(32).toString('hex');
  const nonce = crypto.randomBytes(32).toString('hex');

  await OIDCStateNonce.create({
    state,
    nonce,
    provider_slug: providerSlug,
    expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  });

  return { state, nonce };
}

async function validateState(state) {
  const record = await OIDCStateNonce.findOne({ where: { state } });

  if (!record) {
    throw new Error('Invalid state parameter');
  }

  if (new Date() > record.expires_at) {
    throw new Error('State expired');
  }

  return {
    nonce: record.nonce,
    providerSlug: record.provider_slug,
  };
}

async function consumeState(state) {
  await OIDCStateNonce.destroy({ where: { state } });
}
```

### Routes

```javascript
// Public routes
GET  /api/oidc/providers                    // List enabled providers from .env
GET  /api/oidc/auth/:slug                   // Initiate OIDC flow (redirects)
GET  /api/oidc/callback/:slug               // OAuth callback handler

// Authenticated routes
POST   /api/oidc/link/:slug                 // Link OIDC to current user
DELETE /api/oidc/unlink/:identityId         // Unlink OIDC identity
GET    /api/oidc/identities                 // List user's OIDC identities
```

**Note:** No admin routes needed - configuration is done via .env file.

### Integration with Existing Auth

**Key insight:** No changes needed to `/backend/middleware/auth.js`!

OIDC callback creates standard session: `req.session.userId = user.id`

Existing middleware already supports this pattern, so OIDC users work seamlessly.

### Auth Service Updates

Update `/backend/modules/auth/service.js` login method:

```javascript
async login(email, password, session) {
    // ... existing validation ...

    const user = await User.findOne({ where: { email } });
    if (!user) {
        throw new UnauthorizedError('Invalid credentials');
    }

    // NEW: Check if OIDC-only user (no password)
    if (!user.password_digest) {
        throw new UnauthorizedError(
            'This account uses SSO. Please sign in with your SSO provider.'
        );
    }

    // ... rest of password validation ...
}
```

---

## Frontend Implementation

### 1. Login Page Modifications

**File:** `/frontend/components/Login.tsx`

**Changes:**
1. Fetch enabled providers on mount: `GET /api/oidc/providers`
2. Render provider buttons above email/password form
3. Add divider: "Or continue with email"

**New Component:** `/frontend/components/Auth/OIDCProviderButtons.tsx`

```tsx
interface OIDCProvider {
  slug: string;
  name: string;
  button_text: string;
  button_icon_url?: string;
  type: string;
}

const OIDCProviderButtons: React.FC<{ providers: OIDCProvider[] }> = ({ providers }) => {
  const handleProviderClick = (slug: string) => {
    // Redirect to initiate OIDC flow
    window.location.href = `/api/oidc/auth/${slug}`;
  };

  return (
    <div className="oidc-providers space-y-3 mb-6">
      {providers.map(provider => (
        <button
          key={provider.slug}
          onClick={() => handleProviderClick(provider.slug)}
          className="w-full flex items-center justify-center gap-3 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {provider.button_icon_url && (
            <img src={provider.button_icon_url} className="w-5 h-5" />
          )}
          {provider.button_text.replace('{name}', provider.name)}
        </button>
      ))}
    </div>
  );
};
```

### 2. OAuth Callback Handler

**File:** `/frontend/components/Auth/OIDCCallback.tsx`
**Route:** `/auth/callback/:provider`

Shows loading state while backend processes callback. Backend redirects to `/today` on success or `/login?error=message` on failure.

### 3. Profile Settings - Connected Accounts

**File:** `/frontend/components/Profile/tabs/SecurityTab.tsx`

Add new section: "Connected Accounts"

**Features:**
- List linked OIDC identities (provider, email, linked date)
- "Link {Provider}" buttons for available providers
- "Unlink" button for each identity
- Validation: Cannot unlink last auth method if no password set

**APIs:**
- `GET /api/oidc/identities` - Fetch user's identities
- `POST /api/oidc/link/:provider` - Initiate linking
- `DELETE /api/oidc/unlink/:identityId` - Remove identity

---

## Security Considerations

### 1. Secret Storage
**Location:** `.env` file (plaintext)
**Rationale:**
- Consistent with existing secrets (DB password, session secret, API keys)
- Self-hosted deployments already secure .env files
- Simpler than database encryption
- Standard practice for environment-based configuration

**Best Practices:**
- Never commit `.env` to version control (already in `.gitignore`)
- Use proper file permissions (600 on Linux/macOS)
- Use Docker secrets or Kubernetes secrets in production

### 2. CSRF Protection
**State parameter:** 32-byte cryptographically random string
- Stored in DB with 10-minute TTL
- Validated on callback
- Consumed after use (one-time only)

### 3. Replay Protection
**Nonce:** 32-byte random string included in ID token validation
- Prevents token reuse
- Validated by `openid-client` library

### 4. JWT Validation
**Use `openid-client` for automatic:**
- JWKS (JSON Web Key Set) fetching from provider
- Signature validation using provider's public key
- Issuer, audience, expiration verification
- Nonce validation

### 5. Rate Limiting
Apply existing limiters:
- OIDC auth/callback: 5 requests per 15 minutes per IP (authLimiter)
- User linking/unlinking: authenticatedApiLimiter

### 6. Audit Logging (Optional)
Log all authentication events:
- Login success/failure
- OIDC linking/unlinking
- Provider creation/deletion
- Include: user ID, IP, user agent, timestamp

---

## Implementation Steps

### Phase 1: Database & Models
1. Create `oidc_identities` migration and model
2. Create `oidc_state_nonces` migration and model
3. Create migration to make `password_digest` nullable
4. Update User model validation for password-optional users
5. Add model associations in `/backend/models/index.js`
6. (Optional) Create `auth_audit_log` migration and model

**Testing:** Unit tests for models and validation rules

### Phase 2: Backend Core Services
1. Install `openid-client` dependency
2. Implement `providerConfig.js` (load from .env)
3. Implement `stateManager.js` (state lifecycle)
4. Implement `auditService.js` (event logging, optional)

**Testing:** Unit tests for each service

### Phase 3: OIDC Authentication Flow
1. Implement `service.js` (discovery, auth flow, callback)
2. Implement `provisioningService.js` (JIT provisioning logic)
3. Implement `oidcIdentityService.js` (linking/unlinking)
4. Implement `controller.js` and `routes.js`
5. Update auth service to handle OIDC-only users
6. Add routes to Express app

**Testing:** Integration tests with mock OIDC provider

### Phase 4: Frontend Login Flow
1. Create `OIDCProviderButtons` component
2. Update `Login.tsx` to fetch and display providers
3. Create `OIDCCallback.tsx` component
4. Add callback route to `App.tsx`
5. Add i18n translations for OIDC UI

**Testing:** E2E tests with Playwright (mock provider)

### Phase 5: Frontend Account Linking
1. Create "Connected Accounts" section in SecurityTab
2. Implement link/unlink flows
3. Add validation for last auth method
4. Add confirmation dialogs

**Testing:** E2E tests for linking workflows

### Phase 6: Documentation & Polish
1. Create `/docs/10-oidc-sso.md` (user guide)
2. Update README with .env configuration examples
3. Add provider-specific setup guides (Google, Okta, Authentik, PocketID)
4. Add i18n for all UI text
5. Full regression testing


---

## Future: Admin UI (Optional Phase 7)

If .env configuration proves limiting, a future release can add admin UI:

### Database Migration
- Create `oidc_providers` table
- Add migration script to import .env → database
- Keep .env as fallback if table is empty

### Admin UI Features
- `/admin/oidc-providers` page
- Provider CRUD operations
- Enable/disable toggle
- Test connection button
- Audit log viewer

**Estimated Additional Time:** Moderate effort

This keeps the initial release simple while providing a clear upgrade path.

---

## Testing Strategy

### Unit Tests
- **Models:** Validation rules, nullable password, composite unique constraints
- **Services:** Encryption, state management, JWT validation, provisioning logic

### Integration Tests
- **OIDC Flow:** Initiate → callback → provision user (with mock provider)
- **Account Linking:** Link to existing user, prevent duplicates
- **Admin Operations:** CRUD providers, secret encryption

### E2E Tests (Playwright)
- **Login:** Click provider button → mock OIDC → callback → logged in
- **Linking:** Email/password user links OIDC account
- **Admin:** Create provider, enable/disable, delete

### Security Tests
- **CSRF:** Invalid state rejected
- **Replay:** Reused state rejected
- **JWT Tampering:** Invalid signature rejected
- **Expired State:** Old state rejected

---

## Configuration

### Environment Variables

**Option 1: Single Provider (Simplest)**
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

# Auto-provisioning
OIDC_AUTO_PROVISION=true
OIDC_ADMIN_EMAIL_DOMAINS=example.com,mycompany.com

# Optional Settings
OIDC_STATE_TTL_MINUTES=10
OIDC_JWKS_CACHE_TTL_SECONDS=3600
```

**Option 2: Multiple Providers (Numbered)**
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
OIDC_PROVIDER_2_NAME=Company Okta
OIDC_PROVIDER_2_SLUG=okta
OIDC_PROVIDER_2_ISSUER=https://company.okta.com
OIDC_PROVIDER_2_CLIENT_ID=yyy
OIDC_PROVIDER_2_CLIENT_SECRET=yyy
OIDC_PROVIDER_2_SCOPE=openid profile email
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

### Provider-Specific Issuer URLs

**Popular Providers:**
- **Google:** `https://accounts.google.com`
- **Okta:** `https://{your-domain}.okta.com`
- **Keycloak:** `https://{your-domain}/realms/{realm-name}`
- **Authentik:** `https://{your-domain}/application/o/{application-slug}/`
- **PocketID:** `https://pocketid.app`
- **Azure AD:** `https://login.microsoftonline.com/{tenant-id}/v2.0`
- **Generic:** Any OIDC-compliant provider with `.well-known/openid-configuration`

### Required Environment Variables

The following environment variables must be set for OAuth redirects:

```bash
# Base URL for callback redirects
BASE_URL=http://localhost:3002  # Development
BASE_URL=https://tududi.example.com  # Production

# Trust proxy (REQUIRED for production behind reverse proxy)
TUDUDI_TRUST_PROXY=true
```

**Why TUDUDI_TRUST_PROXY is Required:**

When deployed behind a reverse proxy (nginx, Traefar, Apache), Express must be configured to trust the proxy headers. Without this:
- Sessions may not be saved properly after OIDC callback
- Rate limiting will fail with `X-Forwarded-For` errors
- Users will experience 401 errors after successful SSO login

The `BASE_URL` is used to construct the callback URL: `${BASE_URL}/api/oidc/callback/{slug}`

---

## Critical Files

### Database Migrations
- `/backend/migrations/20260420000001-create-oidc-identities.js`
- `/backend/migrations/20260420000002-create-oidc-state-nonces.js`
- `/backend/migrations/20260420000003-create-auth-audit-log.js` (optional)
- `/backend/migrations/20260420000004-make-password-optional.js`

### Backend Models
- `/backend/models/user.js` - Make password optional, add validation
- `/backend/models/oidc_identity.js` - New model
- `/backend/models/oidc_state_nonce.js` - New model
- `/backend/models/auth_audit_log.js` - New model (optional)

### Backend Services
- `/backend/modules/oidc/providerConfig.js` - Load providers from .env
- `/backend/modules/oidc/service.js` - Core OIDC flow
- `/backend/modules/oidc/provisioningService.js` - JIT provisioning
- `/backend/modules/oidc/stateManager.js` - State/nonce management
- `/backend/modules/oidc/oidcIdentityService.js` - Identity linking
- `/backend/modules/oidc/controller.js` - HTTP handlers
- `/backend/modules/oidc/routes.js` - Express routes
- `/backend/modules/auth/service.js` - Update login for OIDC-only users

### Frontend Components
- `/frontend/components/Login.tsx` - Add provider buttons
- `/frontend/components/Auth/OIDCProviderButtons.tsx` - New component
- `/frontend/components/Auth/OIDCCallback.tsx` - New component
- `/frontend/components/Profile/tabs/SecurityTab.tsx` - Add Connected Accounts

---

## Verification Steps

After implementation, verify:

1. **Basic OIDC Login:**
   - Add Google provider to `.env`
   - Restart server
   - Login page shows "Sign in with Google" button
   - User clicks button → redirects to Google → approves → redirected back
   - User is logged in, session created, redirected to /today
   - User profile shows Google as connected account

2. **Account Linking:**
   - Existing email/password user goes to Profile → Security
   - Clicks "Link Google" → OIDC flow → returns to profile
   - Google account now listed under Connected Accounts
   - User can log in with either email/password OR Google

3. **JIT Provisioning:**
   - New user (no tududi account) clicks "Sign in with Google"
   - User approves at Google
   - New tududi account auto-created with email from OIDC claims
   - User logged in and redirected to /today

4. **Admin Rules:**
   - Set `.env`: `OIDC_ADMIN_EMAIL_DOMAINS=example.com`
   - User with email `admin@example.com` logs in via OIDC
   - User is auto-assigned admin role
   - User can access `/admin` routes

5. **Security:**
   - Try invalid state parameter → rejected with 401
   - Try reusing state → rejected (consumed after use)
   - Check audit log: login events recorded (if enabled)

6. **Edge Cases:**
   - OIDC-only user (no password) tries email/password login → error message
   - User tries to unlink last auth method → blocked with warning
   - `OIDC_ENABLED=false` in .env → no OIDC buttons on login page
   - Invalid provider slug in URL → 404 error

7. **Multiple Providers:**
   - Configure 2+ providers in `.env` (numbered)
   - Restart server
   - Login page shows all provider buttons
   - Each provider works independently

---

## Success Criteria

✅ Users can log in via OIDC providers configured in .env
✅ First-time users auto-created with verified email (JIT provisioning)
✅ Existing users can link/unlink OIDC accounts
✅ Support for multiple OIDC providers via numbered .env variables
✅ Admin roles assigned per provider rules (email domain matching)
✅ Client secrets stored securely in .env (standard practice)
✅ JWT signatures validated against provider JWKS
✅ Email/password auth still works (backward compatible)
✅ Server restart required to update provider configuration (documented)
✅ All tests pass (unit, integration, E2E)
✅ Documentation complete (user guide, setup examples)

---

## Migration Path: .env → Admin UI

If future requirements demand UI-based provider management, the migration path is straightforward:

### Phase 1: Add Database Table
```sql
CREATE TABLE oidc_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug STRING UNIQUE NOT NULL,
  name STRING NOT NULL,
  issuer STRING NOT NULL,
  client_id STRING NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  scope STRING DEFAULT 'openid profile email',
  auto_provision BOOLEAN DEFAULT 1,
  admin_email_domains TEXT,
  enabled BOOLEAN DEFAULT 1,
  created_at DATETIME,
  updated_at DATETIME
);
```

### Phase 2: Dual-Source Configuration
Update `providerConfig.js` to:
1. First check database for providers
2. Fallback to .env if database is empty
3. Allow admin UI to override .env

### Phase 3: Migration Script
```bash
npm run oidc:migrate-env-to-db
```
Reads `.env` providers and inserts into database.

### Phase 4: Admin UI
Build `/admin/oidc-providers` page with CRUD operations.

### Benefits of This Approach
- ✅ Ship OIDC faster
- ✅ Learn from user feedback before building UI
- ✅ Keep initial implementation simple
- ✅ Clear upgrade path when needed
- ✅ .env configuration sufficient for most self-hosters

---

## References

- **Issue:** https://github.com/chrisvel/tududi/issues/977
- **Discussion:** https://github.com/chrisvel/tududi/discussions/238
- **Library:** https://www.npmjs.com/package/openid-client
- **OAuth 2.0 Spec:** https://oauth.net/2/
- **OpenID Connect Spec:** https://openid.net/connect/
