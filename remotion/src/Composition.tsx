import { AbsoluteFill, Audio, Img, Sequence, Video, staticFile } from "remotion";
import timing from "../../output/timing.json";

const FPS = 30;

// Must match Root.tsx's CANVAS_WIDTH/CANVAS_HEIGHT — duplicated rather than
// shared, matching this repo's existing convention of duplicating small
// constants (e.g. FPS) across the two composition files.
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

// Used when a step list doesn't set meta.background — pure CSS, no asset
// file needed for the default case.
const DEFAULT_BACKGROUND =
  "linear-gradient(160deg, #2B2E36 0%, #14151A 100%)";

// capture.ts writes back the viewport it actually recorded at — this is a
// fallback only for timing.json files produced before that existed.
const FALLBACK_WIDTH = 1440;
const FALLBACK_HEIGHT = 900;

// Toggle burned-in captions on/off without deleting the caption code.
const SHOW_CAPTIONS = false;

/**
 * This composition does NOT recreate any UI. The foreground is the actual
 * Playwright recording of the real app (output/raw-capture.webm, converted
 * to mp4 and staged in public/ before rendering — see
 * scripts/prepare-assets.sh), scaled and padded within a fixed
 * 1920x1080 canvas so it reads as a produced demo rather than a raw screen
 * recording. Remotion's job here is purely compositing: real footage +
 * background frame + voiceover + music + captions.
 */
export const DemoComposite: React.FC = () => {
  const contentWidth = (timing as any).viewport?.width ?? FALLBACK_WIDTH;
  const contentHeight = (timing as any).viewport?.height ?? FALLBACK_HEIGHT;
  const padding = (timing as any).padding ?? 96;
  const cornerRadius = (timing as any).cornerRadius ?? 12;
  const shadow = (timing as any).shadow ?? true;
  const backgroundImageStaged = (timing as any).backgroundImageStaged ?? false;
  const background = (timing as any).background;

  const availableWidth = CANVAS_WIDTH - padding * 2;
  const availableHeight = CANVAS_HEIGHT - padding * 2;
  const scale = Math.min(
    availableWidth / contentWidth,
    availableHeight / contentHeight
  );
  const scaledWidth = contentWidth * scale;
  const scaledHeight = contentHeight * scale;
  const left = (CANVAS_WIDTH - scaledWidth) / 2;
  const top = (CANVAS_HEIGHT - scaledHeight) / 2;

  return (
    <AbsoluteFill>
      {backgroundImageStaged ? (
        <Img
          src={staticFile("background.png")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <AbsoluteFill style={{ background: background ?? DEFAULT_BACKGROUND }} />
      )}

      <div
        style={{
          position: "absolute",
          left,
          top,
          width: scaledWidth,
          height: scaledHeight,
          borderRadius: cornerRadius,
          overflow: "hidden",
          boxShadow: shadow ? "0 40px 80px rgba(0, 0, 0, 0.45)" : undefined,
        }}
      >
        <Video src={staticFile("raw-capture.mp4")} style={{ width: "100%", height: "100%" }} />
      </div>

      <Audio src={staticFile("narration-track.mp3")} />

      {/* Background music, ducked well under narration volume */}
      <Audio src={staticFile("music-track.mp3")} volume={0.08} loop />

      {SHOW_CAPTIONS &&
        timing.steps
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
