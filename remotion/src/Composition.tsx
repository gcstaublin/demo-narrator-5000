import { AbsoluteFill, Audio, Sequence, Video, staticFile } from "remotion";
import timing from "../../output/timing.json";

const FPS = 30;

/**
 * This composition does NOT recreate any UI. The background is the actual
 * Playwright recording of the real app (output/raw-capture.webm, converted
 * to mp4 and staged in public/ before rendering — see
 * scripts/prepare-assets.sh). Remotion's job here is purely compositing:
 * real footage + voiceover + music + captions.
 */
export const DemoComposite: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0B0C0E" }}>
      <Video src={staticFile("raw-capture.mp4")} style={{ width: "100%", height: "100%" }} />

      <Audio src={staticFile("narration-track.mp3")} />

      {/* Background music, ducked well under narration volume */}
      <Audio src={staticFile("music-track.mp3")} volume={0.08} loop />

      {timing.steps
        .filter((s: any) => s.narration)
        .map((s: any) => (
          <Sequence
            key={s.id}
            from={Math.round(s.startSec * FPS)}
            durationInFrames={Math.round((s.durationSec + 0.4) * FPS)}
          >
            <Caption text={s.narration} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};

const Caption: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      bottom: 64,
      left: "50%",
      transform: "translateX(-50%)",
      maxWidth: "80%",
      padding: "14px 28px",
      borderRadius: 10,
      background: "rgba(11, 12, 14, 0.78)",
      color: "#F5F5F3",
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      fontSize: 28,
      fontWeight: 500,
      lineHeight: 1.4,
      textAlign: "center",
    }}
  >
    {text}
  </div>
);
