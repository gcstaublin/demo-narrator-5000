/**
 * Pretty-prints a step list's narration as a readable "shooting script" —
 * no OpenAI/Playwright/Remotion calls, so it's free and instant to re-run
 * while iterating on a step list, ahead of the actually-expensive
 * npm run tts / capture / render pipeline.
 *
 * Duration is a rough estimate (word count / speaking-rate heuristic), not
 * the real TTS clip length — treat it as a ballpark for pacing, not a
 * substitute for the timing.json that npm run tts produces.
 */
import fs from "node:fs";

const STEP_FILE = process.argv[2];
if (!STEP_FILE) {
  console.error("Usage: npm run preview -- steps/<file>.json");
  process.exit(1);
}

// Average adult speaking rate for TTS narration; used only to ballpark
// per-step and total runtime here, not for actual pacing (npm run tts's
// measured clip durations are the source of truth for that).
const WORDS_PER_SECOND = 2.5;
const DEFAULT_GAP_MS = 400; // must match tts.ts's DEFAULT_GAP_MS
const DEFAULT_CARD_DURATION_SEC = 3; // must match tts.ts's DEFAULT_CARD_DURATION_SEC

type Step = {
  id: string;
  action: string;
  narration?: string;
  postDelayMs?: number;
  [key: string]: unknown;
};

const data = JSON.parse(fs.readFileSync(STEP_FILE, "utf-8"));
const steps: Step[] = data.steps ?? [];
const meta = data.meta ?? {};

console.log(`\n${meta.title ?? STEP_FILE}`);
console.log(
  `voice: ${meta.voice ?? "alloy (default)"}  |  captions: ${
    meta.captions ?? false
  }  |  music: ${
    meta.musicPath === null
      ? "none"
      : meta.musicPath ?? "auto-detect from assets/"
  }`
);
// Same resolution rule as tts.ts: no fallback to meta.title (that field
// already means something else — a descriptive label) — a card only shows
// if its own *Title is explicitly set.
const introTitle = meta.introTitle;
const outroTitle = meta.outroTitle;
const introDurationSec = introTitle
  ? meta.introDurationSec ?? DEFAULT_CARD_DURATION_SEC
  : 0;
const outroDurationSec = outroTitle
  ? meta.outroDurationSec ?? DEFAULT_CARD_DURATION_SEC
  : 0;
if (meta.logoPath && !introTitle && !outroTitle) {
  console.log(
    `Note: meta.logoPath is set but no intro/outro card will show (neither introTitle nor outroTitle/meta.title is set) — the logo won't appear anywhere.\n`
  );
}

console.log("─".repeat(72));

let totalSec = 0;

if (introTitle) {
  console.log(`[INTRO CARD] (~${introDurationSec.toFixed(1)}s)`);
  console.log(`   "${introTitle}"`);
  if (meta.introSubtitle) console.log(`   "${meta.introSubtitle}"`);
  console.log("");
  totalSec += introDurationSec;
}

steps.forEach((step, i) => {
  const gapSec = (step.postDelayMs ?? DEFAULT_GAP_MS) / 1000;
  const words = step.narration ? step.narration.trim().split(/\s+/).length : 0;
  const estSec = words / WORDS_PER_SECOND;
  totalSec += estSec + gapSec;

  const label = `${i + 1}. [${step.action}] ${step.id}`;
  console.log(label);
  if (step.narration) {
    console.log(`   "${step.narration}"`);
    console.log(`   ~${estSec.toFixed(1)}s narration + ${gapSec.toFixed(1)}s dwell`);
  } else {
    console.log(`   (silent action, ${gapSec.toFixed(1)}s dwell)`);
  }
  console.log("");
});

if (outroTitle) {
  console.log(`[OUTRO CARD] (~${outroDurationSec.toFixed(1)}s)`);
  console.log(`   "${outroTitle}"`);
  if (meta.outroSubtitle) console.log(`   "${meta.outroSubtitle}"`);
  console.log("");
  totalSec += outroDurationSec;
}

console.log("─".repeat(72));
console.log(`${steps.length} steps, ~${totalSec.toFixed(0)}s estimated total runtime\n`);
