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

  // Playwright's clicks/fills never move a visible pointer, so capture.ts
  // records where each click/fill target sat (viewport coordinates) into
  // its timing entry — see the matching capture note there. Steps with no
  // recorded target (goto, wait, scroll) are skipped; the cursor simply
  // holds its last position across them.
  const cursorTargets: CursorTarget[] = ((timing as any).steps ?? [])
    .filter((s: any) => typeof s.cursorX === "number" && typeof s.cursorY === "number")
    .map((s: any) => ({
      startSec: s.startSec,
      x: s.cursorX,
      y: s.cursorY,
      isClick: s.cursorAction === "click",
    }));

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

        <CursorOverlay targets={cursorTargets} scale={scale} left={left} top={top} />

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

type CursorTarget = { startSec: number; x: number; y: number; isClick: boolean };

// How long the cursor takes to glide between two consecutive targets, and
// how long a click's ripple takes to expand and fade. Both are tuned by
// feel, not derived from anything in timing.json.
const CURSOR_TRAVEL_SEC = 0.45;
const CLICK_RIPPLE_SEC = 0.55;
const CURSOR_FADE_SEC = 0.3;

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const easeInOutCubic = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

// Draws a synthetic pointer that eases between each real click/fill target
// (in the gap before the next action fires) and holds through the action's
// narration window, with a small ripple on clicks — since Playwright's
// automated actions never move a visible cursor of their own, this is
// wholly synthesized from the target points capture.ts records.
const CursorOverlay: React.FC<{
  targets: CursorTarget[];
  scale: number;
  left: number;
  top: number;
}> = ({ targets, scale, left, top }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  if (targets.length === 0) return null;

  const first = targets[0];
  if (t < first.startSec - CURSOR_TRAVEL_SEC - CURSOR_FADE_SEC) return null;

  // `prev` is the last target already reached by time t (or `first`, as a
  // resting position before it's technically been "reached"); `next` is the
  // upcoming target we may currently be traveling toward.
  let prev = first;
  let next: CursorTarget | null = null;
  for (const target of targets) {
    if (target.startSec <= t) {
      prev = target;
    } else {
      next = target;
      break;
    }
  }

  let x = prev.x;
  let y = prev.y;
  if (next) {
    const travelStart = Math.max(prev.startSec, next.startSec - CURSOR_TRAVEL_SEC);
    if (t >= travelStart) {
      const progress = Math.min(1, (t - travelStart) / Math.max(0.001, next.startSec - travelStart));
      const eased = easeInOutCubic(progress);
      x = lerp(prev.x, next.x, eased);
      y = lerp(prev.y, next.y, eased);
    }
  }

  const opacity = interpolate(
    t,
    [first.startSec - CURSOR_TRAVEL_SEC - CURSOR_FADE_SEC, first.startSec - CURSOR_TRAVEL_SEC],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const sinceClick = t - prev.startSec;
  const showRipple = prev.isClick && sinceClick >= 0 && sinceClick < CLICK_RIPPLE_SEC;
  const rippleProgress = showRipple ? sinceClick / CLICK_RIPPLE_SEC : 0;

  const screenX = left + x * scale;
  const screenY = top + y * scale;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      {showRipple && (
        <div
          style={{
            position: "absolute",
            left: screenX,
            top: screenY,
            width: 40,
            height: 40,
            marginLeft: -20,
            marginTop: -20,
            borderRadius: "50%",
            border: "2px solid rgba(255, 255, 255, 0.85)",
            transform: `scale(${lerp(0.3, 1.8, rippleProgress)})`,
            opacity: lerp(0.8, 0, rippleProgress),
          }}
        />
      )}
      <svg
        width={24}
        height={28}
        viewBox="0 0 24 28"
        style={{
          position: "absolute",
          left: screenX - 3,
          top: screenY - 2,
          filter: "drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5))",
        }}
      >
        <path
          d="M3 2 L3 20 L7.5 16 L11 25 L14.5 23.5 L11 15 L19 15 Z"
          fill="#F5F5F3"
          stroke="#111"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
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
