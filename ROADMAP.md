# Roadmap

## Goal

Automate creation of software demo videos: give general direction ("show a
user creating a project and inviting a teammate"), get back a narrated MP4 of
the *actual* product UI — not a recreated/synthetic UI. This replaces manual
screen-recording tools (Loom, Screen Studio) and the multi-take/re-edit cycle
they require.

## Design decisions

- **No third-party "AI demo agent" SaaS tools.** Most of these spin up their
  own cloud browser to drive your app. If your app requires login and you're
  testing against both prod and lower environments, that means handing
  session/prod credentials to a cloud browser you don't control. Ruled out.
- **Self-built pipeline instead**, using tools that require no new accounts
  except one TTS provider:
  - **Playwright** — real browser automation, runs locally/on your infra,
    captures genuine screen recording of the actual app (not a recreation).
  - **Remotion** — used *only* as a compositor (real footage + audio +
    captions), never to regenerate UI. An earlier attempt used Remotion alone
    and it ended up recreating the UI in React instead of showing the real
    thing — that's the specific failure mode this architecture avoids.
  - **OpenAI TTS** (`gpt-4o-mini-tts`) — narration audio. Note: **API billing
    is separate from any ChatGPT subscription** — you must add a payment
    method under API billing specifically at platform.openai.com, or calls
    fail even with an active ChatGPT plan.
- **Auth approach**: one-time manual login per environment (prod/staging) via
  `auth/capture-login.ts`, saving a Playwright storageState file that's
  reused headlessly afterward. No credentials are ever scripted/typed by an
  agent. storageState files are gitignored and should be treated as
  sensitive (equivalent to a live session token).

## What's next

`steps/example-flow.json` was hand-written as a placeholder to have
something runnable during initial scaffolding. It is **not** meant to be
hand-authored going forward — that would defeat the "general direction in,
video out" goal.

The next piece to build: a generator where you give plain-English direction
and Claude Code (or similar) visits the real (non-prod, staging) environment
using the saved storageState session, inspects the live DOM, resolves your
direction into actual selectors/actions, and writes the step-list JSON
automatically. This needs a real staging URL + logged-in session to build
against.

### Multi-demo support (not yet built)

Every stage currently writes to fixed, unnamespaced paths — `audio/*`,
`output/timing.json`, `output/raw-capture.webm`, `public/*`,
`output/final.mp4` — regardless of which step-list file produced them.
Running a second demo before moving the first's `output/final.mp4` out
overwrites it, and interleaved runs can mix one demo's audio with another's
footage. Today this is single-demo-at-a-time by convention only (see
README).

Planned fix: derive a slug from the step-list filename (or `meta.title`) and
namespace every intermediate path by it — `audio/<slug>/`,
`output/<slug>/timing.json`, `output/<slug>/raw-capture.webm`,
`output/<slug>/final.mp4`. The one complication: `remotion/src/Composition.tsx`
and `remotion/src/Root.tsx` currently `import timing from
"../../output/timing.json"` as a **static** import, which can't take a
runtime-selected path. Fixing that means switching to Remotion's dynamic
props mechanism (`calculateMetadata` / the CLI's `--props` flag) instead of
a static JSON import — arguably the more correct approach anyway, and worth
doing as part of this change rather than working around the static import.
