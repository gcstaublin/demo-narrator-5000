# Instructions for Claude working in this repo

## Before creating any new demo

A "demo" here means writing a new `steps/*.json` step list (optionally
paired with a new `config/*.json` environment). Before writing the first
line of either, ask the user for these six things — don't default any of
them silently. Most users driving this tool aren't developers and won't
know these are configurable at all unless asked directly in plain
language — don't rely on them knowing to dig into `meta` fields or
README tables themselves.

1. **Viewport.** Offer a few concrete presets (e.g. Desktop 1440x900,
   Laptop 1280x800, Mobile 390x844) rather than just picking one.
2. **TTS voice.** `scripts/tts.ts` hardcodes `alloy` as a fallback, but
   every demo can override it via `meta.voice`. Offer quick-pick options
   rather than silently using the fallback. As of mid-2026, OpenAI's docs
   for `gpt-4o-mini-tts` (the model this repo uses) say "for best quality,
   we recommend `marin` or `cedar`" — both are real, current voices added
   after most models' training cutoffs, so don't assume they're invalid
   just because they're unfamiliar. Good default quick-picks: **marin,
   cedar, alloy, nova** (nova as a distinct warm/conversational option
   alongside OpenAI's own top picks and the tool's neutral default). Full
   current voice set for this model: alloy, ash, ballad, coral, echo,
   fable, nova, onyx, sage, shimmer, verse, marin, cedar. Re-check
   OpenAI's TTS docs if this list looks stale.
3. **Backing music.** None, an existing track in `assets/`, or a new file
   the user provides. Never assume silence or auto-detect without asking.
4. **The actual test scenario.** Never invent the route/flow/steps
   yourself — ask what the user specifically wants demoed.
5. **Captions.** Burned-in on-screen captions, on or off (`meta.captions`).
   Default is `false` if the user doesn't care — but ask, don't silently
   default.
6. **Framing/presentation.** How much space and styling around the
   browser footage (`meta.padding`, `meta.cornerRadius`, `meta.shadow`,
   `meta.background`). Describe this visually, not as field names — offer
   named presets rather than asking for pixel values:
   - **Standard (default)** — comfortable inset with rounded corners and a
     drop shadow, dark gradient background (`padding: 96`,
     `cornerRadius: 12`, `shadow: true`).
   - **Full-bleed / tight** — footage fills nearly the whole frame, square
     corners, no shadow (`padding: 32`, `cornerRadius: 0`, `shadow:
     false`).
   - **Custom** — ask what they want changed (padding amount, corner
     rounding, shadow on/off, background color/gradient/image path) and
     set those fields directly rather than forcing them into a preset.

All six map directly onto fields the tool already supports per-demo
(`meta.viewport`, `meta.voice`, `meta.musicPath`, `meta.captions`,
`meta.padding`/`cornerRadius`/`shadow`/`background`, and the step list
itself) — see README.md's "Per-demo config (meta)" section. The gap to
avoid is conversational, not technical: the tool has always supported
per-demo overrides; the failure mode is an agent picking values for the
user instead of asking.

## Script review before the expensive steps

Writing the step list is cheap; `npm run capture` (drives a real browser)
and `npm run render` (Remotion composite) are not, in time if nothing
else. After drafting or editing a `steps/*.json` file and before running
`npm run tts`, `npm run capture`, or `npm run render`:

1. Paste the full ordered narration — every step's action + narration line
   — into the chat, or run `npm run preview -- steps/<file>.json` (reads
   the step list only, makes no API calls, prints a shooting-script view
   with a rough per-step and total duration estimate) and share that
   output.
2. Wait for explicit approval or edits before running any pipeline
   command. Apply requested changes and re-preview rather than assuming a
   partial "looks good" covers the whole script.

This applies to first drafts and to edits alike — a tweaked step list gets
re-reviewed before the next `npm run capture`/`render`, not just the first
one.

## Save the take?

After `npm run render` finishes successfully, ask the user whether to
save this take to `local-renders/<name>/` as a local copy (see the
existing `grantland-v1`/`v2`/`v3`-style naming in that directory for
precedent — an incrementing suffix per attempt at the same demo). If yes,
copy `output/final.mp4` (and `output/timing.json` if useful for reference)
into that directory yourself. If no, leave it in `output/final.mp4` as-is
— remember the "one demo at a time" caveat below before starting another
demo.

## Demo files stay local, not committed

`config/*.json` and `steps/*.json` are gitignored by default (see
`.gitignore`) except for the environment templates (`staging.json`,
`prod.json`), the one hand-written example (`example-flow.json`), and
public QA/test-automation practice-site configs (`saucedemo.json`,
`the-internet.json`, `demoqa.json`). Real, one-off demos
(a specific person's site, a specific narrated scenario) are personal
local artifacts — don't remove them from `.gitignore` without asking.
Finished demo videos are meant to be shared externally (e.g. YouTube), not
committed as repo assets.

## Git workflow

Never commit directly to `main`. Check the current branch before making
changes; if on `main`, create a descriptively named branch first, push it,
and open a PR rather than pushing to `main` directly.

## Stress-testing against live third-party sites

If pointing this tool at a real external site (not your own app) for
testing: expect selector fragility (`:has-text()` can match unrelated
copy elsewhere on the page — prefer structural/positional or exact
`aria-label` selectors), expect `baseUrl` to need to be the bare origin if
the target app has a fixed subpath (`scripts/capture.ts`'s `resolveGotoUrl`
joins `path` onto `baseUrl` rather than replacing it, but confirm this fix
has landed on `main` before relying on it), and expect the target site's
own anti-abuse/rate-limiting to kick in if the same query is repeated many
times in a short window — verify actual captured frames before declaring
a capture successful, since `capture.ts` has no built-in check that an
action's result was actually correct (e.g. it won't notice if it drove
straight through a live site's own error page).
