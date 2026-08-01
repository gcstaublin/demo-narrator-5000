import { Composition } from "remotion";
import { DemoComposite } from "./Composition";
import timing from "../../output/timing.json";

const FPS = 30;
// capture.ts's per-step pacing treats narration length as a *floor*, not a
// ceiling — a `wait` step's own `ms` can run far longer than its narration
// budget (e.g. waiting up to 2 minutes for a reply that only takes a few
// seconds of narration to introduce). Using totalDurationSec alone here
// would silently truncate the composition to the narration track's length,
// cutting off whatever happened during the rest of the real capture.
// actualDurationSec (written by capture.ts from real wall-clock time) is
// absent only for timing.json files produced before that field existed.
const effectiveDurationSec = Math.max(
  timing.totalDurationSec,
  (timing as any).actualDurationSec ?? 0
);
// Intro/outro title cards (tts.ts's meta.introTitle/outroTitle) extend the
// composition beyond the captured demo itself — 0 when a card isn't set,
// see Composition.tsx for how these same two fields gate whether the card
// renders at all.
const introDurationSec = (timing as any).introDurationSec ?? 0;
const outroDurationSec = (timing as any).outroDurationSec ?? 0;
const durationInFrames = Math.ceil(
  (effectiveDurationSec + 1 + introDurationSec + outroDurationSec) * FPS
);

// Must match Composition.tsx's CANVAS_WIDTH/CANVAS_HEIGHT — duplicated
// rather than shared, matching this repo's existing convention of
// duplicating small constants (e.g. FPS) across the two composition files.
// The output canvas is fixed regardless of the captured viewport;
// Composition.tsx scales the real footage to fit inside it with padding.
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DemoVideo"
      component={DemoComposite}
      durationInFrames={durationInFrames}
      fps={FPS}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
    />
  );
};
