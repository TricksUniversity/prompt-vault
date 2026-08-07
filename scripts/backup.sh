#!/usr/bin/env bash
set -euo pipefail
DATA=/Users/narendra.bagul/Code/POC/Tools/shared-data/prompt-lib
STAMP=$(date +%Y%m%d-%H%M%S)
DEST="${DATA}-backup-${STAMP}"
cp -R "$DATA" "$DEST"
echo "Backup written to $DEST"
