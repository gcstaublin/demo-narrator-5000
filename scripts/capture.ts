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
  action: "goto" | "click" | "fill" | "wait";
  path?: string;
  selector?: string;
  value?: string;
  ms?: number;
  narration?: string;
  postDelayMs?: number;
};

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

  if (!fs.existsSync(config.storageStatePath)) {
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
    storageState: config.storageStatePath,
    viewport: config.viewport,
    recordVideo: { dir: "output/video-tmp", size: config.viewport },
  });
  const page = await context.newPage();

  const timingById = new Map(
    (timing?.steps ?? []).map((t: any) => [t.id, t])
  );

  for (const step of steps) {
    console.log(`Executing ${step.id}: ${step.action}`);

    switch (step.action) {
      case "goto":
        await page.goto(new URL(step.path ?? "/", config.baseUrl).toString());
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
    }

    // Pace this action's on-screen dwell time to match its narration clip,
    // so the final composite doesn't need to time-warp footage after the fact.
    const t = timingById.get(step.id) as any;
    const narrationDurationMs = t?.durationSec ? t.durationSec * 1000 : 1200;
    const extraDelay = step.postDelayMs ?? 0;
    await page.waitForTimeout(narrationDurationMs + extraDelay);
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

  console.log("Saved output/raw-capture.webm");
}

main();
