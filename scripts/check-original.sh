#!/bin/sh
# Proves the original Navigation Prototype source is unchanged since this tool was created (14 Oct 2026).
# The baseline is the hash of its source files taken before the first copy.
ORIG="${ORIGINAL_PROTOTYPE_DIR:-$(dirname "$0")/../../Navigation Prototype}"
BASELINE="c7e507ca5f2f6cd2dfa996ad2f652fdaf1680a1c"
cd "$ORIG" || { echo "original prototype folder not found: $ORIG"; exit 2; }
NOW=$(find src index.html package.json package-lock.json tsconfig.json vite.config.ts vite.demo.config.ts -type f | sort | xargs shasum | shasum | cut -c1-40)
if [ "$NOW" = "$BASELINE" ]; then echo "original prototype unchanged ($NOW)"; else echo "ORIGINAL PROTOTYPE CHANGED: expected $BASELINE, got $NOW"; exit 1; fi
