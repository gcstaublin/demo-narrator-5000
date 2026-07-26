# Instructions for Claude working in this repo

## Before creating any new demo

A "demo" here means writing a new `steps/*.json` step list (optionally
paired with a new `config/*.json` environment). Before writing the first
line of either, ask the user for these four things — don't default any of
them silently:

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

All four map directly onto fields the tool already supports per-demo
(`meta.viewport`, `meta.voice`, `meta.musicPath`, and the step list itself)
— see README.md's "Per-demo config (meta)" section. The gap to avoid is
conversational, not technical: the tool has always supported per-demo
overrides; the failure mode is an agent picking values for the user
instead of asking.

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
