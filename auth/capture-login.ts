/**
 * One-time, per-environment login capture.
 *
 * Opens a real (headed) browser so you can log in by hand — including SSO,
 * MFA, whatever your app requires — then saves the resulting session
 * (cookies + localStorage) to a storageState file that capture.ts reuses
 * headlessly for every future recording.
 *
 * Usage:
 *   npx tsx auth/capture-login.ts --env staging
 *
 * Re-run whenever a session expires or you need to refresh credentials.
 * The output file contains live session data — never commit it.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const envName = process.argv.includes("--env")
  ? process.argv[process.argv.indexOf("--env") + 1]
  : "staging";

async function main() {
  const config = JSON.parse(
    fs.readFileSync(path.join("config", `${envName}.json`), "utf-8")
  );

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(config.baseUrl);

  console.log(`\nA browser window has opened at ${config.baseUrl}.`);
  console.log("Log in by hand (including any SSO/MFA steps).");
  console.log("Once you're fully logged in and see the app, come back here and press Enter.\n");

  await new Promise((resolve) => process.stdin.once("data", resolve));

  const outPath = config.storageStatePath;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await page.context().storageState({ path: outPath });

  // Playwright's storageState() only persists cookies + localStorage — it
  // has no concept of sessionStorage. Some auth SDKs (e.g. Okta's embedded
  // widget, as used by this app) keep the actual access/ID tokens in
  // sessionStorage instead, which means storageState() alone silently
  // captures a session-less file. Snapshot sessionStorage separately so
  // capture.ts can replay it into every new page via addInitScript.
  const sessionStorageDump: Record<string, string> = await page.evaluate(() =>
    Object.keys(window.sessionStorage).reduce((acc, key) => {
      acc[key] = window.sessionStorage.getItem(key) ?? "";
      return acc;
    }, {} as Record<string, string>)
  );
  const sessionStoragePath = outPath.replace(/\.json$/, ".sessionStorage.json");
  fs.writeFileSync(sessionStoragePath, JSON.stringify(sessionStorageDump, null, 2));

  console.log(`Saved session to ${outPath}`);
  console.log(`Saved sessionStorage to ${sessionStoragePath}`);
  await browser.close();
  process.exit(0);
}

main();
