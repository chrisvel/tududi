## tududi E2E (Playwright)

End-to-end tests live in this isolated `e2e/` folder.
The suite uses Playwright and assumes the app is running locally.

### Quick start

`npm run test:ui`

1) Backend (with a test user):

```bash
TUDUDI_USER_EMAIL=test@tududi.com TUDUDI_USER_PASSWORD=password123 npm run backend:start
```

2) Frontend dev server:

```bash
npm run frontend:dev
```

3) E2E tests:

```bash
cd e2e
npm ci
npm run install-browsers
APP_URL=http://localhost:8080 E2E_EMAIL=test@tududi.com E2E_PASSWORD=password123 npm test
```

- Only Chromium:

```bash
npx playwright test --project=Chromium
```

- UI mode:

```bash
npm run test:ui
```

### Notes
- Base URL defaults to `http://localhost:8080`. Override with `APP_URL`.
- The login smoke test fills Email/Password and expects redirect to `/today`.
- Ensure a user exists. The backend start step above auto-creates/updates the user via env vars.
