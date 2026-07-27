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
const durationInFrames = Math.ceil((effectiveDurationSec + 1) * FPS);

// capture.ts writes back the viewport it actually recorded at — this is a
// fallback only for timing.json files produced before that existed.
const FALLBACK_WIDTH = 1440;
const FALLBACK_HEIGHT = 900;
const width = (timing as any).viewport?.width ?? FALLBACK_WIDTH;
const height = (timing as any).viewport?.height ?? FALLBACK_HEIGHT;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DemoVideo"
      component={DemoComposite}
      durationInFrames={durationInFrames}
      fps={FPS}
      width={width}
      height={height}
    />
  );
};
