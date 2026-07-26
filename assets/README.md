# assets

Optional user-supplied assets go here.

- Music for the final composite, ducked well under narration volume. You
  must supply/license this yourself; keep the original filename for
  attribution if your license requires it. These files are gitignored —
  never committed.
  - If your step list sets `meta.musicPath` (see README.md), that exact
    file is used.
  - Otherwise `scripts/prepare-assets.sh` auto-detects a single
    `.mp3`/`.wav`/`.m4a` file here (warns and uses the first if there's
    more than one).
  - If neither is found, it generates silence as a placeholder so the
    pipeline still runs.
