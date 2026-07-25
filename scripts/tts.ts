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

const SILENCE_BETWEEN_STEPS_SEC = 0.6; // breathing room between narration lines
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const OPENAI_VOICE = "alloy"; // swap for any supported voice

type Step = {
  id: string;
  action: string;
  narration?: string;
  [key: string]: unknown;
};

async function synthesize(text: string, outPath: string) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_VOICE,
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

  for (const step of steps) {
    if (!step.narration) {
      timing.push({ id: step.id, startSec: cursor, durationSec: 0 });
      continue;
    }

    const clipPath = path.join("audio", `${step.id}.mp3`);
    console.log(`Synthesizing ${step.id}: "${step.narration}"`);
    await synthesize(step.narration, clipPath);

    const duration = getDurationSeconds(clipPath);

    timing.push({
      id: step.id,
      narration: step.narration,
      audioFile: clipPath,
      startSec: cursor,
      durationSec: duration,
    });

    concatLines.push(`file '${path.resolve(clipPath)}'`);
    // insert silence gap after each clip so the stitched track has breathing room
    concatLines.push(`file '${path.resolve("audio/_silence.mp3")}'`);

    cursor += duration + SILENCE_BETWEEN_STEPS_SEC;
  }

  // generate a short reusable silence clip for gaps
  execSync(
    `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${SILENCE_BETWEEN_STEPS_SEC} -q:a 9 audio/_silence.mp3`
  );

  fs.writeFileSync(concatListPath, concatLines.join("\n"));
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy audio/narration-track.mp3`
  );

  fs.writeFileSync(
    "output/timing.json",
    JSON.stringify({ totalDurationSec: cursor, steps: timing }, null, 2)
  );

  console.log(`\nDone. Total narration length: ${cursor.toFixed(1)}s`);
  console.log("Wrote audio/narration-track.mp3 and output/timing.json");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
