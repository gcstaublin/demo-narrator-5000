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
