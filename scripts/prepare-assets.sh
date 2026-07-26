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

# A step list's meta.musicPath (resolved by tts.ts into timing.json) picks
# a specific track explicitly. Falls back to auto-detecting whatever's in
# assets/ when a demo doesn't care which track it gets.
MUSIC_PATH=""
if [ -f output/timing.json ]; then
  MUSIC_PATH=$(node -e "const t=require('./output/timing.json'); process.stdout.write(t.musicPath || '')")
fi

if [ -n "$MUSIC_PATH" ] && [ ! -f "$MUSIC_PATH" ]; then
  echo "meta.musicPath (${MUSIC_PATH}) not found — falling back to auto-detection in assets/."
  MUSIC_PATH=""
fi

if [ -n "$MUSIC_PATH" ]; then
  echo "Using background music from meta.musicPath: ${MUSIC_PATH}"
  ffmpeg -y -i "$MUSIC_PATH" -c:a libmp3lame -q:a 4 public/music-track.mp3
else
  shopt -s nullglob
  music_files=(assets/*.mp3 assets/*.wav assets/*.m4a)
  shopt -u nullglob

  if [ ${#music_files[@]} -gt 0 ]; then
    music_file="${music_files[0]}"
    if [ ${#music_files[@]} -gt 1 ]; then
      echo "Multiple audio files found in assets/ — using ${music_file}, ignoring the rest. Set meta.musicPath in the step list to choose explicitly."
    fi
    ffmpeg -y -i "$music_file" -c:a libmp3lame -q:a 4 public/music-track.mp3
  else
    echo "No background music found in assets/ — generating silence as a placeholder."
    ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 5 -q:a 9 public/music-track.mp3
  fi
fi

echo "Assets staged in public/"
