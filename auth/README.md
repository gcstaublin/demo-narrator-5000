# Auth

Run once per environment before your first capture, and again whenever a
session expires:

```bash
npx tsx auth/capture-login.ts --env staging
npx tsx auth/capture-login.ts --env prod
```

This opens a real, visible browser window pointed at the environment's base
URL. Log in by hand — SSO, MFA, whatever your app needs — then return to the
terminal and press Enter. Playwright saves the resulting session (cookies +
localStorage) to `auth/<env>.storageState.json`.

`capture.ts` loads that file to run headlessly as an already-authenticated
session — the agent never sees or handles your actual password.

**These files are live session credentials.** They're already covered by
`.gitignore`; don't move them out of this folder, paste them into chat, or
commit them under any circumstances. Treat a leaked storageState file the
same as a leaked password — rotate/invalidate the session if one ever leaks.
