# demonarrator5000

Turns a plain-English "step list" into a narrated, branded demo video of your
*actual* product UI — no synthetic recreation, no manual screen recording.

Pipeline: **step list → TTS narration + timing → Playwright capture (paced to
narration) → Remotion composite (real footage + voiceover + music + captions) → MP4**

## Prerequisites / setup checklist

- [ ] Node.js 18+
- [ ] `npm install` in this directory (installs Playwright, Remotion, ffmpeg wrapper, etc.)
- [ ] `npx playwright install chromium`
- [ ] `ffmpeg` installed and on PATH (`brew install ffmpeg` / `apt install ffmpeg`)
- [ ] Copy `.env.example` → `.env` and fill in `OPENAI_API_KEY`
      - **Important:** OpenAI API billing is separate from any ChatGPT
        subscription. Even if you already pay for ChatGPT Plus/Team, you must
        add a payment method under **API billing** specifically at
        platform.openai.com/settings/organization/billing. If the TTS step
        fails with a billing/quota error, this is almost always why — check
        API billing, not your ChatGPT plan.
- [ ] Auth setup per environment (see `auth/README.md`) — one-time manual
      login per env (prod / staging) to capture a Playwright `storageState`
      file. These files contain live session cookies: keep them out of git
      (already covered by `.gitignore`) and treat them like credentials.

## Usage

```bash
# 1. Generate narration audio + timing from a step list
npm run tts -- steps/example-flow.json

# 2. Capture the real UI, paced to match narration timing
npm run capture -- steps/example-flow.json --env staging

# 3. Composite: real footage + voiceover + music + captions -> final MP4
npm run render
```

Output lands in `output/final.mp4`.

## Directory guide

- `config/` — per-environment settings (base URL, storageState path). No secrets committed.
- `steps/` — your step list JSON files (the "direction" you write).
- `scripts/tts.ts` — narration generation + timing measurement.
- `scripts/capture.ts` — Playwright runner, paced to narration timing.
- `remotion/` — compositing project; imports the *real* captured video as background.
- `auth/` — one-time login scripts to produce storageState files (gitignored output).

## Current status

`steps/example-flow.json` is a hand-written example to have something
runnable out of the box. Writing your own step-list JSON by hand works today,
but isn't the end goal. See [ROADMAP.md](ROADMAP.md) for design decisions and
what's next.
