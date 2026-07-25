import { Composition } from "remotion";
import { DemoComposite } from "./Composition";
import timing from "../../output/timing.json";

const FPS = 30;
const durationInFrames = Math.ceil((timing.totalDurationSec + 1) * FPS);

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DemoVideo"
      component={DemoComposite}
      durationInFrames={durationInFrames}
      fps={FPS}
      width={1440}
      height={900}
    />
  );
};
