import { Composition } from "remotion";
import { DemoComposite } from "./Composition";
import timing from "../../output/timing.json";

const FPS = 30;
const durationInFrames = Math.ceil((timing.totalDurationSec + 1) * FPS);

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
