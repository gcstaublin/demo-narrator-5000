import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
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

/**
 * This composition does NOT recreate any UI. The foreground is the actual
 * Playwright recording of the real app (output/raw-capture.webm, converted
 * to mp4 and staged in public/ before rendering — see
 * scripts/prepare-assets.sh), scaled and padded within a fixed
 * 1920x1080 canvas so it reads as a produced demo rather than a raw screen
 * recording. Remotion's job here is purely compositing: real footage +
 * background frame + voiceover + music + captions + intro/outro title cards.
 */
export const DemoComposite: React.FC = () => {
  const { durationInFrames } = useVideoConfig();

  const contentWidth = (timing as any).viewport?.width ?? FALLBACK_WIDTH;
  const contentHeight = (timing as any).viewport?.height ?? FALLBACK_HEIGHT;
  const padding = (timing as any).padding ?? 96;
  const cornerRadius = (timing as any).cornerRadius ?? 12;
  const shadow = (timing as any).shadow ?? true;
  const backgroundImageStaged = (timing as any).backgroundImageStaged ?? false;
  const background = (timing as any).background;
  // Resolved once by tts.ts into timing.json from meta.captions (default
  // false) — see README.md's meta table and CLAUDE.md's demo Q&A checklist.
  const showCaptions = (timing as any).captions ?? false;

  // Each card is independently opt-in — see tts.ts's resolution of
  // meta.introTitle/outroTitle into these fields. introFrames/outroFrames
  // are 0 (and the card doesn't render) when its title wasn't set.
  const introTitle = (timing as any).introTitle as string | undefined;
  const introSubtitle = (timing as any).introSubtitle as string | undefined;
  const introFrames = Math.round(((timing as any).introDurationSec ?? 0) * FPS);
  const outroTitle = (timing as any).outroTitle as string | undefined;
  const outroSubtitle = (timing as any).outroSubtitle as string | undefined;
  const outroFrames = Math.round(((timing as any).outroDurationSec ?? 0) * FPS);
  const logoStaged = (timing as any).logoStaged ?? false;
  const mainContentFrames = Math.max(
    0,
    durationInFrames - introFrames - outroFrames
  );

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
      {/* Spans the full video (intro + demo + outro), not just the
          main-content window, so the frame reads as one continuous piece
          rather than the background changing when the title cards appear. */}
      {backgroundImageStaged ? (
        <Img
          src={staticFile("background.png")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <AbsoluteFill style={{ background: background ?? DEFAULT_BACKGROUND }} />
      )}

      {/* Also spans the full video, unlike narration, so it doesn't cut in
          abruptly right as the demo footage starts. */}
      <Audio src={staticFile("music-track.mp3")} volume={0.08} loop />

      {introTitle && (
        <Sequence from={0} durationInFrames={introFrames} name="intro-card">
          <TitleCard
            title={introTitle}
            subtitle={introSubtitle}
            logoStaged={logoStaged}
          />
        </Sequence>
      )}

      <Sequence
        from={introFrames}
        durationInFrames={mainContentFrames}
        name="main-content"
      >
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

        {showCaptions &&
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
      </Sequence>

      {outroTitle && (
        <Sequence
          from={durationInFrames - outroFrames}
          durationInFrames={outroFrames}
          name="outro-card"
        >
          <TitleCard
            title={outroTitle}
            subtitle={outroSubtitle}
            logoStaged={logoStaged}
          />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

// Fade-in + slight scale-up on entrance, then hold — the same title/subtitle
// layout is reused for both the intro and outro card, just with different
// copy (meta.introTitle/introSubtitle vs outroTitle/outroSubtitle).
const FADE_IN_FRAMES = 20;

const TitleCard: React.FC<{
  title: string;
  subtitle?: string;
  logoStaged: boolean;
}> = ({ title, subtitle, logoStaged }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, FADE_IN_FRAMES], [0, 1], {
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, FADE_IN_FRAMES], [0.92, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {logoStaged && (
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            overflow: "hidden",
            marginBottom: 28,
            border: "2px solid rgba(245, 245, 243, 0.35)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
          }}
        >
          <Img
            src={staticFile("logo.png")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}
      <div
        style={{
          color: "#F5F5F3",
          fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
          fontSize: 56,
          fontWeight: 700,
          textAlign: "center",
          maxWidth: "80%",
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            color: "rgba(245, 245, 243, 0.7)",
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
            fontSize: 26,
            fontWeight: 400,
            textAlign: "center",
            maxWidth: "70%",
            marginTop: 14,
          }}
        >
          {subtitle}
        </div>
      )}
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
