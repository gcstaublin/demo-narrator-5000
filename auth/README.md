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

`capture-login.ts` also writes a sibling `auth/<env>.sessionStorage.json`.
Playwright's `storageState()` only persists cookies + `localStorage` — some
auth SDKs (e.g. an embedded Okta widget) keep the actual tokens in
`sessionStorage` instead, which `storageState()` silently misses. This file
carries that over; `capture.ts` replays it into every page load via
`context.addInitScript`. If a `<env>.json` login stops working with a
storageState file that "looks right" but still bounces to a login screen,
this is the first thing to check.

**These files are live session credentials.** They're already covered by
`.gitignore`; don't move them out of this folder, paste them into chat, or
commit them under any circumstances. Treat a leaked storageState or
sessionStorage file the same as a leaked password — rotate/invalidate the
session if one ever leaks.

## Conditional Access / device-trust environments

Some environments sit behind SSO with device-compliance checks (e.g. Azure
AD Conditional Access). Playwright's default throwaway browser profile has
no device trust, so login gets redirected to a "register this device"
screen instead of completing — the resulting storageState looks plausible
(real SSO cookies) but the app's own token store ends up empty, and
`capture.ts` just bounces to the login screen when it replays the session.

If you hit this, add `chromeUserDataDir` to that environment's
`config/<env>.json`, pointing at a **dedicated, non-default** profile
directory — e.g. `~/.dn5000-chrome-profile` on macOS.
`capture-login.ts` then launches real Chrome against that profile instead
of a fresh throwaway one.

**Do not point this at your actual default Chrome profile**
(`~/Library/Application Support/Google/Chrome` with no custom directory).
Chrome refuses remote debugging outright against that exact path — a
deliberate security feature to stop automation tools from silently taking
over your everyday browser — and will launch then immediately kill itself
with `DevTools remote debugging requires a non-default data directory` in
its stderr. A separate directory is required, full stop; Playwright cannot
work around this.

The first run against a fresh dedicated profile starts logged out, so
you'll go through a real interactive login (unlike a copy of your daily
profile, which would start already-authenticated). If Conditional Access
device-trust on your org is checked at the OS level (e.g. via a Microsoft
SSO/device-registration broker) rather than tied to one specific browser
profile folder, a dedicated-but-real-Chrome profile on the same,
already-enrolled machine should still inherit that trust and skip the
device-registration prompt — that's the working theory this fix rests on;
confirm it actually does on your first real run.

This is opt-in per environment — leave `chromeUserDataDir` unset (the
default) and nothing about this changes; you only need it for environments
that actually require device compliance. Since `config/<env>.json` files
for real (non-template) environments are gitignored, this path lives only
in your own local config, never committed.

Trade-offs: since this is a separate profile directory (not your daily
one), it doesn't conflict with your regular Chrome running at the same
time — no need to quit it first. `capture.ts`'s headless replay of the
resulting storageState is unaffected either way — it doesn't launch against
this profile, just the saved cookies/localStorage.
