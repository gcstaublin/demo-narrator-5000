/**
 * Generates narration audio per step, measures each clip's duration, and
 * produces:
 *   - audio/step-N.mp3        (individual narration clips)
 *   - audio/narration-track.mp3  (stitched full track, silence-padded)
 *   - output/timing.json      (per-step start/end times, consumed by
 *                              capture.ts for pacing and remotion for
 *                              caption timing)
 *
 * Requires OPENAI_API_KEY in .env.
 *
 * NOTE: OpenAI API billing is separate from any ChatGPT subscription plan.
 * If this script fails with a 429/quota or billing error, check
 * platform.openai.com/settings/organization/billing (API billing) — a
 * ChatGPT Plus/Team subscription does NOT fund API usage.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import "dotenv/config";

const STEP_FILE = process.argv[2];
if (!STEP_FILE) {
  console.error("Usage: npm run tts -- steps/<file>.json");
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!fs.existsSync(".env")) {
  console.error(
    "No .env file found. Run `cp .env.example .env`, then open .env " +
      "(not .env.example) and paste in your real OPENAI_API_KEY."
  );
  process.exit(1);
}
if (!apiKey || apiKey.startsWith("REPLACE_WITH_") || apiKey === "sk-...") {
  console.error(
    "OPENAI_API_KEY in .env is still the placeholder value. Open .env and " +
      "paste in your real key from platform.openai.com/api-keys."
  );
  process.exit(1);
}

// Fallback gap when a step doesn't specify postDelayMs. Must match the same
// fallback in scripts/capture.ts's `extraDelay` — both scripts build a
// per-step time budget independently (this one for the audio track's silence
// padding, that one for how long the browser dwells on-screen), and if the
// two ever disagree, narration and footage will drift out of sync exactly
// like the site-transition-latency bug this replaced.
const DEFAULT_GAP_MS = 400;
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_VOICE = "alloy"; // used when a step list doesn't set meta.voice

type Step = {
  id: string;
  action: string;
  narration?: string;
  postDelayMs?: number;
  [key: string]: unknown;
};

type Meta = {
  title?: string;
  env?: string;
  startPath?: string;
  voice?: string;
  viewport?: { width: number; height: number };
  // undefined (key omitted) -> auto-detect a track in assets/
  // null (key explicitly set) -> no music, don't auto-detect either
  // string -> use that exact file
  musicPath?: string | null;
  userAgent?: string;
  // Screen-Studio-style frame around the real footage — see
  // remotion/src/Composition.tsx and README.md's meta table for the
  // resolution rules (omitted / CSS string / file path).
  background?: string;
  padding?: number;
  cornerRadius?: number;
  shadow?: boolean;
  [key: string]: unknown;
};

async function synthesize(text: string, outPath: string, voice: string) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice,
      input: text,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `OpenAI TTS request failed (${res.status}): ${body}\n` +
        `If this looks like a billing/quota error, check API billing at ` +
        `platform.openai.com/settings/organization/billing — a ChatGPT ` +
        `subscription does not cover API usage.`
    );
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buffer);
}

function getDurationSeconds(filePath: string): number {
  const out = execSync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`
  )
    .toString()
    .trim();
  return parseFloat(out);
}

async function main() {
  const data = JSON.parse(fs.readFileSync(STEP_FILE, "utf-8"));
  const steps: Step[] = data.steps;
  const meta: Meta = data.meta ?? {};
  const voice = meta.voice ?? DEFAULT_VOICE;

  console.log(`Voice: ${voice}${meta.voice ? "" : " (default — set meta.voice in the step list to override)"}`);

  fs.mkdirSync("audio", { recursive: true });
  fs.mkdirSync("output", { recursive: true });

  const timing: Array<{
    id: string;
    narration?: string;
    audioFile?: string;
    startSec: number;
    durationSec: number;
  }> = [];

  let cursor = 0;
  const concatListPath = "audio/concat-list.txt";
  const concatLines: string[] = [];

  // Every step — narrated or silent — occupies real on-screen time in the
  // capture (a click's settle delay, a scroll's pause, etc). The audio
  // track's silence padding has to account for silent steps too, or the
  // audio and video will drift apart step by step exactly like they did
  // before this fix.
  function silenceClipPath(stepId: string) {
    return path.join("audio", `_silence-${stepId}.mp3`);
  }
  function writeSilence(seconds: number, outPath: string) {
    execSync(
      `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${seconds} -q:a 9 "${outPath}"`
    );
  }

  for (const step of steps) {
    const gapSec = (step.postDelayMs ?? DEFAULT_GAP_MS) / 1000;

    if (!step.narration) {
      timing.push({ id: step.id, startSec: cursor, durationSec: 0 });
      if (gapSec > 0) {
        const silPath = silenceClipPath(step.id);
        writeSilence(gapSec, silPath);
        concatLines.push(`file '${path.resolve(silPath)}'`);
      }
      cursor += gapSec;
      continue;
    }

    const clipPath = path.join("audio", `${step.id}.mp3`);
    console.log(`Synthesizing ${step.id}: "${step.narration}"`);
    await synthesize(step.narration, clipPath, voice);

    const duration = getDurationSeconds(clipPath);

    timing.push({
      id: step.id,
      narration: step.narration,
      audioFile: clipPath,
      startSec: cursor,
      durationSec: duration,
    });

    concatLines.push(`file '${path.resolve(clipPath)}'`);
    if (gapSec > 0) {
      const silPath = silenceClipPath(step.id);
      writeSilence(gapSec, silPath);
      concatLines.push(`file '${path.resolve(silPath)}'`);
    }

    cursor += duration + gapSec;
  }

  fs.writeFileSync(concatListPath, concatLines.join("\n"));
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy audio/narration-track.mp3`
  );

  // viewport and musicPath are resolved here (not read directly by capture.ts
  // or prepare-assets.sh from the step list) so there's one place downstream
  // scripts look for "what this demo actually asked for" — same reasoning as
  // the per-step timing budget above.
  fs.writeFileSync(
    "output/timing.json",
    JSON.stringify(
      {
        totalDurationSec: cursor,
        voice,
        viewport: meta.viewport,
        musicPath: meta.musicPath,
        userAgent: meta.userAgent,
        background: meta.background,
        padding: meta.padding,
        cornerRadius: meta.cornerRadius,
        shadow: meta.shadow,
        steps: timing,
      },
      null,
      2
    )
  );

  console.log(`\nDone. Total narration length: ${cursor.toFixed(1)}s`);
  console.log("Wrote audio/narration-track.mp3 and output/timing.json");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
