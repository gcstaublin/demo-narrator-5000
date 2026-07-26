#!/usr/bin/env bash
# Converts the raw Playwright recording (webm) to mp4 and stages all assets
# where Remotion expects them (public/ at the project root — Remotion
# resolves the public folder relative to package.json, not relative to
# remotion/src/), so remotion/src/Composition.tsx can reference them via
# staticFile().
set -euo pipefail

mkdir -p public

ffmpeg -y -i output/raw-capture.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart public/raw-capture.mp4
cp audio/narration-track.mp3 public/narration-track.mp3

# A step list's meta.musicPath (resolved by tts.ts into timing.json) has
# three distinct states, not two — the key can be absent, explicitly null,
# or an explicit path, and those mean different things:
#   - key absent           -> auto-detect a track in assets/
#   - musicPath: null      -> explicitly no music for this demo, don't
#                              auto-detect either (assets/ may still have
#                              tracks meant for *other* demos)
#   - musicPath: "<path>"  -> use that exact file
MUSIC_MODE="auto"
MUSIC_PATH=""
if [ -f output/timing.json ]; then
  RESULT=$(node -e "
    const t = require('./output/timing.json');
    if (!('musicPath' in t)) process.stdout.write('auto');
    else if (!t.musicPath) process.stdout.write('none');
    else process.stdout.write('path:' + t.musicPath);
  ")
  case "$RESULT" in
    auto) MUSIC_MODE="auto" ;;
    none) MUSIC_MODE="none" ;;
    path:*) MUSIC_MODE="explicit"; MUSIC_PATH="${RESULT#path:}" ;;
  esac
fi

if [ "$MUSIC_MODE" = "explicit" ] && [ ! -f "$MUSIC_PATH" ]; then
  echo "meta.musicPath (${MUSIC_PATH}) not found — falling back to auto-detection in assets/."
  MUSIC_MODE="auto"
fi

if [ "$MUSIC_MODE" = "none" ]; then
  echo "meta.musicPath is explicitly null — no background music for this demo."
  ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 5 -q:a 9 public/music-track.mp3
elif [ "$MUSIC_MODE" = "explicit" ]; then
  echo "Using background music from meta.musicPath: ${MUSIC_PATH}"
  ffmpeg -y -i "$MUSIC_PATH" -c:a libmp3lame -q:a 4 public/music-track.mp3
else
  shopt -s nullglob
  music_files=(assets/*.mp3 assets/*.wav assets/*.m4a)
  shopt -u nullglob

  if [ ${#music_files[@]} -gt 0 ]; then
    music_file="${music_files[0]}"
    if [ ${#music_files[@]} -gt 1 ]; then
      echo "Multiple audio files found in assets/ — using ${music_file}, ignoring the rest. Set meta.musicPath in the step list to choose explicitly, or set it to null for no music."
    fi
    ffmpeg -y -i "$music_file" -c:a libmp3lame -q:a 4 public/music-track.mp3
  else
    echo "No background music found in assets/ — generating silence as a placeholder."
    ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 5 -q:a 9 public/music-track.mp3
  fi
fi

echo "Assets staged in public/"
