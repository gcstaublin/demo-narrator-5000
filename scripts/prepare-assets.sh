#!/usr/bin/env bash
# Converts the raw Playwright recording (webm) to mp4 and stages all assets
# where Remotion expects them (remotion/public/), so remotion/src/Composition.tsx
# can reference them via staticFile().
set -euo pipefail

mkdir -p remotion/public

ffmpeg -y -i output/raw-capture.webm -c:v libx264 -pix_fmt yuv420p remotion/public/raw-capture.mp4
cp audio/narration-track.mp3 remotion/public/narration-track.mp3

if [ -f assets/music-track.mp3 ]; then
  cp assets/music-track.mp3 remotion/public/music-track.mp3
else
  echo "No assets/music-track.mp3 found — generating silence as a placeholder."
  ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 5 -q:a 9 remotion/public/music-track.mp3
fi

echo "Assets staged in remotion/public/"
