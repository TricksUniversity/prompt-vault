#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
DATA=/Users/narendra.bagul/Code/POC/Tools/shared-data/prompt-lib
mkdir -p "$DATA/postgres" "$DATA/exports"
docker compose up -d --build
echo "UI  → http://localhost:6060"
echo "API → http://localhost:6061/health"
echo "DB  → localhost:6062"
