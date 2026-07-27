/**
 * Drives the real app in a real browser and records the screen, pacing each
 * action to match the narration timing produced by tts.ts. Run tts.ts first.
 *
 * Usage:
 *   npm run capture -- steps/example-flow.json --env staging
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const stepFile = args[0];
const envName = args.includes("--env")
  ? args[args.indexOf("--env") + 1]
  : "staging";

if (!stepFile) {
  console.error("Usage: npm run capture -- steps/<file>.json --env <env>");
  process.exit(1);
}

type Step = {
  id: string;
  action: "goto" | "click" | "fill" | "wait" | "scroll";
  path?: string;
  selector?: string;
  value?: string;
  ms?: number;
  amount?: number;
  x?: number;
  y?: number;
  narration?: string;
  postDelayMs?: number;
};

// A step's `path` is always relative to the app rooted at `baseUrl` — it
// should extend baseUrl, never replace it. `new URL(path, baseUrl)` doesn't
// do that: per the URL spec, a leading-slash path discards the *entire*
// path of the base, keeping only its origin. That's invisible for a
// bare-origin baseUrl (https://host) but silently sends every goto to the
// wrong page for any app mounted under a subpath (https://host/app) — a
// common setup for Java/.NET context-path deployments, path-based ingress
// routing, and self-hosted enterprise tools (Jira, Confluence, etc).
function resolveGotoUrl(baseUrl: string, path: string | undefined): string {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = (path ?? "/").replace(/^\/+/, "");
  return new URL(normalizedPath ? `${trimmedBase}/${normalizedPath}` : trimmedBase).toString();
}

async function main() {
  const config = JSON.parse(
    fs.readFileSync(path.join("config", `${envName}.json`), "utf-8")
  );
  const data = JSON.parse(fs.readFileSync(stepFile, "utf-8"));
  const steps: Step[] = data.steps;

  let timing: any = null;
  const timingPath = "output/timing.json";
  if (fs.existsSync(timingPath)) {
    timing = JSON.parse(fs.readFileSync(timingPath, "utf-8"));
  } else {
    console.warn(
      "No output/timing.json found — run `npm run tts` first for narration-paced capture. Proceeding with default pacing."
    );
  }

  // A step list's meta.viewport (resolved by tts.ts into timing.json) wins
  // over the environment's default — viewport is a per-demo decision (this
  // demo wants an iPhone-sized capture) more than an environment one (this
  // env is normally viewed on desktop). Falling back to config.viewport
  // keeps existing step lists working unchanged.
  const viewport = timing?.viewport ?? config.viewport;
  console.log(
    `Viewport: ${viewport.width}x${viewport.height}${timing?.viewport ? "" : " (from config — set meta.viewport in the step list to override)"}`
  );

  if (config.storageStatePath && !fs.existsSync(config.storageStatePath)) {
    console.error(
      `No storageState found at ${config.storageStatePath}. Run:\n` +
        `  npx tsx auth/capture-login.ts --env ${envName}\n` +
        `first to authenticate.`
    );
    process.exit(1);
  }

  fs.mkdirSync("output/video-tmp", { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: config.storageStatePath ?? undefined,
    viewport,
    recordVideo: { dir: "output/video-tmp", size: viewport },
  });
  const page = await context.newPage();

  const timingById = new Map(
    (timing?.steps ?? []).map((t: any) => [t.id, t])
  );

  // Narration timing sets a *floor* for each step's on-screen time, not a
  // ceiling — a `wait` step's own `ms` can (and for something like "wait up
  // to 2 minutes for a reply" deliberately does) run far longer than its
  // narration budget. Track real wall-clock time across the whole capture so
  // Root.tsx can size the composition to what actually happened instead of
  // silently truncating to the narration track's length.
  const captureStart = Date.now();

  for (const step of steps) {
    console.log(`Executing ${step.id}: ${step.action}`);
    const actionStart = Date.now();

    switch (step.action) {
      case "goto":
        await page.goto(resolveGotoUrl(config.baseUrl, step.path));
        break;
      case "click":
        await page.click(step.selector!);
        break;
      case "fill":
        await page.fill(step.selector!, step.value ?? "");
        break;
      case "wait":
        await page.waitForTimeout(step.ms ?? 500);
        break;
      case "scroll": {
        const vp = page.viewportSize() ?? viewport;
        const x = step.x ?? Math.round(vp.width * 0.3);
        const y = step.y ?? Math.round(vp.height * 0.5);
        await page.mouse.move(x, y);
        // A single big wheel() jump reads as an abrupt, unnatural snap.
        // Split it into small ticks with easing (large steps up front,
        // tapering off) so the capture reads like a real scroll gesture
        // instead of a hard cut to a new scroll position.
        const totalAmount = step.amount ?? 400;
        const tickCount = 14;
        for (let i = 0; i < tickCount; i++) {
          // ease-out: weight ticks so they shrink across the gesture
          const weight = tickCount - i;
          const totalWeight = (tickCount * (tickCount + 1)) / 2;
          const tickAmount = (totalAmount * weight) / totalWeight;
          await page.mouse.wheel(0, tickAmount);
          await page.waitForTimeout(25);
        }
        break;
      }
    }

    // Pace this step's total on-screen time (action + dwell) to match its
    // narration clip, so the final composite doesn't need to time-warp
    // footage after the fact. The action itself (page load, click,
    // in-page transition animations) takes real, variable wall-clock time —
    // if we added the full dwell on top of that unconditionally, every step
    // would run longer than planned and the whole capture would drift later
    // and later behind the narration track. Instead we only wait out
    // whatever's left of the budget after the action's own elapsed time.
    const t = timingById.get(step.id) as any;
    const narrationDurationMs =
      t && typeof t.durationSec === "number" ? t.durationSec * 1000 : 1200;
    // DEFAULT_GAP_MS must match scripts/tts.ts's fallback — see the comment
    // there for why the two have to agree.
    const DEFAULT_GAP_MS = 400;
    const extraDelay = step.postDelayMs ?? DEFAULT_GAP_MS;
    const budgetMs = narrationDurationMs + extraDelay;
    const elapsedMs = Date.now() - actionStart;
    const remainingMs = Math.max(0, budgetMs - elapsedMs);
    if (elapsedMs > budgetMs) {
      console.warn(
        `${step.id}: action took ${elapsedMs}ms, longer than its ${budgetMs}ms budget — this step will run behind.`
      );
    }
    await page.waitForTimeout(remainingMs);
  }

  await context.close();
  await browser.close();

  // Playwright names the recorded file automatically; find and normalize it.
  const files = fs.readdirSync("output/video-tmp");
  const recorded = files.find((f) => f.endsWith(".webm"));
  if (!recorded) throw new Error("No recording produced.");
  fs.renameSync(
    path.join("output/video-tmp", recorded),
    "output/raw-capture.webm"
  );
  fs.rmSync("output/video-tmp", { recursive: true, force: true });

  const actualDurationSec = (Date.now() - captureStart) / 1000;

  // Persist the viewport and real elapsed capture time back into
  // timing.json so Root.tsx can size the Remotion composition to match the
  // actual recording instead of guessing — these are the resolved/observed
  // values, not just whatever the step list or narration timing predicted.
  fs.writeFileSync(
    timingPath,
    JSON.stringify(
      { ...(timing ?? { totalDurationSec: 0, steps: [] }), viewport, actualDurationSec },
      null,
      2
    )
  );

  console.log("Saved output/raw-capture.webm");
}

main();
