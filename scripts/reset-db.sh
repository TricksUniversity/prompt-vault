#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
DATA=/Users/narendra.bagul/Code/POC/Tools/shared-data/prompt-lib

echo "*** DESTRUCTIVE ***"
echo "This deletes $DATA/postgres (all prompts) and recreates an empty DB."
read -r -p "Type DELETE to confirm: " ANSWER
[ "$ANSWER" = "DELETE" ] || { echo "Aborted."; exit 1; }

docker compose down
rm -rf "$DATA/postgres"
mkdir -p "$DATA/postgres"
docker compose up -d --build
echo "Database reset."
