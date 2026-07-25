# assets

Optional user-supplied assets go here.

- Any single `.mp3` / `.wav` / `.m4a` file — background music for the final
  composite, ducked well under narration volume. You must supply/license
  this yourself; keep the original filename for attribution if your
  license requires it. `scripts/prepare-assets.sh` picks up whichever one
  file it finds (warns and uses the first if there's more than one). If
  none is found, it generates silence as a placeholder so the pipeline
  still runs. These files are gitignored — never committed.
