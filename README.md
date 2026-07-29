# demo-narrator-5000

Turns a plain-English "step list" into a narrated, branded demo video of your
*actual* product UI — no synthetic recreation, no manual screen recording.

Pipeline: **step list → TTS narration + timing → Playwright capture (paced to
narration) → Remotion composite (real footage + voiceover + music + captions) → MP4**

## How it works

You provide a target URL, a list of actions to run against it (click here,
type this, scroll there), and a line of narration for each one describing
what's happening. From there:

1. **Narration comes first.** Each step's narration text is sent to OpenAI's
   TTS API, which generates a spoken audio clip for it. Every clip is timed
   — a five-second sentence gets a five-second budget — and those timings
   become the schedule the rest of the pipeline follows.
2. **Playwright drives the real app.** A headless Chromium browser opens
   your actual product — not a mockup or recreation — and performs each
   step for real (clicking, typing, scrolling, navigating) while recording
   the screen. Each action is paced to last as long as its narration clip,
   so a step with a longer explanation gets more on-screen dwell time and a
   quick aside gets less.
3. **Remotion assembles the final video.** The raw screen recording, the
   narration voiceover, optional background music, and captions (derived
   from the same narration timing) are composited together into one MP4.

The result is a narrated, captioned demo of your actual product, without
anyone manually recording a screen or hand-timing a voiceover to it.

## Prerequisites / setup checklist

- [ ] Node.js 18+
- [ ] `npm install` in this directory (installs Playwright, Remotion, ffmpeg wrapper, etc.)
- [ ] `npx playwright install chromium`
- [ ] `ffmpeg` installed and on PATH (`brew install ffmpeg` / `apt install ffmpeg`)
- [ ] Create your own `.env` file — run `cp .env.example .env`, then open
      **`.env`** (not `.env.example`) and paste in your real `OPENAI_API_KEY`.
      - **`.env.example` is committed to git; `.env` is not.** Never put a
        real key in `.env.example` — anything written there is public the
        moment you push. `scripts/tts.ts` will refuse to run and tell you
        what's wrong if you skip this step or edit the wrong file.
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

**One demo at a time.** Every stage writes to fixed, unnamespaced paths
(`audio/`, `output/timing.json`, `output/raw-capture.webm`, `public/`,
`output/final.mp4`) regardless of which step-list file you ran. Starting a
second demo before moving `output/final.mp4` elsewhere will overwrite it —
or worse, mix one demo's audio with another's footage if you interleave
runs. Move/rename `output/final.mp4` out before starting the next demo. See
[ROADMAP.md](ROADMAP.md) for the planned per-demo namespacing fix.

## Step list format

Each entry in a `steps/*.json` file's `steps` array is one browser action.
`narration` is optional — omit it for silent/setup actions (the capture
still runs, it just doesn't get a caption or narration-length dwell time).
`postDelayMs` adds extra dwell time after the action, on top of whatever the
narration clip's length already provides.

| action   | fields                          | does |
|----------|----------------------------------|------|
| `goto`   | `path`                          | Navigate to `path`, resolved against the env's `baseUrl`. |
| `click`  | `selector`                      | Click the element matching `selector`. |
| `fill`   | `selector`, `value`             | Type `value` into the element matching `selector`. |
| `wait`   | `ms`                            | Pause for `ms` (default 500), no page interaction. |
| `scroll` | `amount`, `x`, `y` (all optional) | Scroll the page by `amount` px (default 400) via a mouse wheel event at `(x, y)` — defaults to roughly the left-third of the viewport, useful for pages with independently-scrolling panels. |

`config/<env>.json`'s `storageStatePath` is optional — omit it (or leave it
`null`) for public pages that don't need a login session.

### Per-demo config (`meta`)

A step list's `meta` object can set config for that specific demo. These are
resolved once by `npm run tts` and written into `output/timing.json`, which
`capture.ts`, `prepare-assets.sh`, and the Remotion composition all read from
— so there's one place downstream steps look for "what this demo actually
asked for," instead of duplicated or hardcoded values that can drift out of
sync with each other.

| field        | fallback when omitted                              |
|--------------|-----------------------------------------------------|
| `voice`      | `alloy` — any OpenAI TTS voice name |
| `viewport`   | the env's `config/<env>.json` viewport | 
| `musicPath`  | auto-detects a single `.mp3`/`.wav`/`.m4a` in `assets/`, or silence if none |
| `userAgent`  | the env's `config/<env>.json` `userAgent`, or a real desktop Chrome UA (built from the actual bundled Chromium version, not a hardcoded string) |

Viewport is a per-demo decision more than a per-environment one — the same
staging environment might back both a desktop demo and a phone-sized one —
so `meta.viewport` wins over the environment default when both are set.

`musicPath` has three distinct states, useful if `assets/` holds more than
one track (say, `chill.mp3` and `techno.mp3` for different demos):
- **omitted** — auto-detect a single track in `assets/`
- **set to a path**, e.g. `"assets/chill.mp3"` — use that exact file
- **set to `null`** — explicitly no music for this demo, silence, and
  skip auto-detection (so having other demos' tracks sitting in `assets/`
  doesn't accidentally pull one in)
`capture.ts` also writes back whichever viewport it actually used, so the
Remotion composition is always sized to match the real recording rather than
a value that has to be kept in sync by hand.

By default Playwright's Chromium reports an automated/headless User-Agent,
which some target apps' client-side browser-detection flags as unsupported
mid-recording — set `meta.userAgent` (or `userAgent` in `config/<env>.json`
for an env-wide default) to override it with a specific UA string if the
built-in desktop Chrome default still gets flagged.

## Directory guide

- `config/` — per-environment settings (base URL, storageState path). No secrets committed.
- `steps/` — your step list JSON files (the "direction" you write).
- `scripts/tts.ts` — narration generation + timing measurement.
- `scripts/capture.ts` — Playwright runner, paced to narration timing.
- `remotion/` — compositing project; imports the *real* captured video as background.
- `public/` — gitignored; staged by `scripts/prepare-assets.sh` right before rendering (Remotion serves static assets from here, at the project root).
- `auth/` — one-time login scripts to produce storageState files (gitignored output).

## Current status

`steps/example-flow.json` is a hand-written example to have something
runnable out of the box. Writing your own step-list JSON by hand works today,
but isn't the end goal. See [ROADMAP.md](ROADMAP.md) for design decisions and
what's next.
