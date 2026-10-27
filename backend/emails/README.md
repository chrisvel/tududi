# Emails

Every email tududi sends is built here. Each file is one email; its strings
live in `locales/<lang>/emails.json` (the app's language codes, so `jp` and
`ua`), and `layout.js` turns them into the text and HTML bodies. An email goes
out in the recipient's `users.language`, falling back to English for a
missing language or key.

| Email | File | Sent when |
|---|---|---|
| Verify your email | `verification.js` | Right after a password sign-up |
| Verification reminder | `verification.js` (`reminder`) | Once, 1 to 7 days after a sign-up that never verified (daily job, 03:00 UTC) |
| Reset your password | `passwordReset.js` | Someone asks for a reset on the sign-in page |
| Member invite | `memberInvite.js` | An owner or admin adds a member without a password |
| Trial ends soon | `trialReminder.js` | Hosted only: 3 days before a never-paid trial ends, and on its last day (daily job) |
| Account still empty | `emptyAccount.js` | Hosted only: once, 2 to 14 days after an owner's account started (trial start, else sign-up) if they have made nothing (daily job) |
| Come back | `comeBack.js` | Hosted only: an owner who made things and then nothing for 7 to 30 days; again only after they have been active since (daily job) |
| Account will be deleted | `deletionWarning.js` | Hosted only, deletion on: a week before an ended unpaid trial is deleted (daily job) |
| Task and project notifications | `notification.js` | A notification fires for a user who turned email on for it; the text is the notification's own |
| Security notice | `securityNotice.js` | Two-factor sign-in is turned on, turned off, or reset by an admin; a recovery code is used; new recovery codes are made |
| Contact form | `contactMessage.js` | Someone writes from the landing site's contact page; goes to the operator, in English |

## Previewing

```bash
npm run emails:preview            # every email, every language
npm run emails:preview -- de jp   # only these languages
```

This writes one HTML page per email and language, plus an `index.html`, to
`backend/emails/preview/` (git-ignored), filled with sample data.

## Adding or changing an email

1. Add or edit the module and its keys in `locales/en/emails.json`.
2. Add the same keys to every other language. Plurals use i18next suffixes
   (`key_one`, `key_few`, `key_other`, ...) as `Intl.PluralRules` names them
   for that language.
3. Register a new module in `index.js` and call `renderEmail(name, { language,
   ...vars })` where it is sent. `tests/unit/emails/emails.test.js` checks
   that every language has every key and renders every email.
