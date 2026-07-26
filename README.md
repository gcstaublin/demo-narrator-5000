# demo-narrator-5000

Turns a plain-English "step list" into a narrated, branded demo video of your
*actual* product UI — no synthetic recreation, no manual screen recording.

Pipeline: **step list → TTS narration + timing → Playwright capture (paced to
narration) → Remotion composite (real footage + voiceover + music + captions) → MP4**

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
