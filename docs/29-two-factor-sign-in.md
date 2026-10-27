# Two-factor sign-in

Users can turn on a second step at sign-in: a 6-digit code from an authenticator app (TOTP, RFC 6238). It is opt-in per user. On a hosted instance it is required for the superadmin before the admin panel opens.

## For users

- **Turn it on:** Profile > Security > Two-factor sign-in. Scan the QR code, enter a code, and save the 10 recovery codes (shown once). Every other device is signed out. The card then lists the API keys that still work without a code, so old ones can be revoked.
- **Signing in:** after the password, or after single sign-on, the sign-in page asks for a code. "Use a recovery code" takes one of the saved codes instead. Each code works once.
- **New recovery codes:** made from the same card. The old ones stop working.
- **Turn it off:** needs a current code or a recovery code, even straight after signing in.
- **Lost phone and codes:** an admin resets it (see below).

## Rules

| Rule | Value |
| --- | --- |
| Code | 6 digits, 30-second step, one step of clock drift either way; a code is never accepted twice |
| Tries per sign-in | 5 wrong codes, then the password is needed again |
| Lockout | 10 wrong codes per user in 15 minutes, across all devices |
| Half-finished sign-in | expires after 5 minutes |
| Step-up | creating an API key or new recovery codes asks for the password (or a code, with 2FA on) if none was typed in the last 10 minutes |
| CalDAV | with 2FA on, the account password no longer works for Basic auth; use an API key as the password |

API keys and MCP tokens keep working with 2FA on. Sign-in links for members without an email are not affected, and those members cannot turn 2FA on.

## Admin reset

Admin > Access shows who has two-factor sign-in on. The reset button (open padlock) turns it off for a user who is locked out:

- On a self-hosted instance, the instance admin can reset anyone except themselves.
- On a hosted instance, an account admin can reset members of their own account but not other admins; the superadmin resets admins.

Every reset signs the user out everywhere, is logged in `auth_audit_logs` (`mfa_reset`, with `reset_by`), and emails the user.

## Hosted superadmin

With `TUDUDI_HOSTED_MODE=true`, the superadmin (`is_admin`) gets `403 mfa_setup_required` from every `/api/admin/*` route, and the app shows a setup prompt, until two-factor sign-in is on. The rest of the app works as usual. Self-hosted admins stay opt-in.

## Server setup

The authenticator secret is encrypted at rest with `shared/crypto/secretCipher.js`, so `TUDUDI_SESSION_SECRET` (or `TUDUDI_OIDC_SECRET_ENCRYPTION_KEY`) must be set. Without it the card says so and setup is refused.

## Security emails and audit

`backend/emails/securityNotice.js` is sent when 2FA is turned on, turned off or reset, when a recovery code is used, and when new codes are made. The same events, and every wrong code, go to `auth_audit_logs` (`mfa_enabled`, `mfa_disabled`, `mfa_reset`, `mfa_recovery_code_used`, `mfa_recovery_codes_regenerated`, `mfa_failed`).

## API

| Endpoint | Does |
| --- | --- |
| `POST /api/login` | Answers `{ mfa_required: true }` when the account has 2FA on |
| `POST /api/login/mfa` | `{ code }` or `{ recovery_code }`; finishes the sign-in |
| `GET /api/current_user` | `{ user: null, mfa_pending: true }` while a sign-in waits for its code |
| `GET /api/profile/mfa` | Status, recovery codes left, whether the server can encrypt |
| `POST /api/profile/mfa/setup` | QR code (SVG) and secret, kept in the session until confirmed |
| `POST /api/profile/mfa/enable` | `{ code }`; returns the recovery codes |
| `POST /api/profile/mfa/disable` | `{ code }` or `{ recovery_code }` |
| `POST /api/profile/mfa/recovery-codes` | New codes (step-up) |
| `POST /api/auth/reverify` | `{ password }`, or `{ code }` with 2FA on; opens the 10-minute step-up window |
| `POST /api/admin/users/:id/mfa/reset` | Admin reset |

A step-up route answers `403 { reauth_required: true, method: 'password' | 'code' }`; the web app shows a prompt and retries. Requests made with an API token are not asked.

Code lives in `backend/modules/mfa/` (`totp.js`, `service.js`, `session.js`), the tables are `user_mfa` and `user_recovery_codes`.
