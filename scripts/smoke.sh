#!/usr/bin/env bash
set -euo pipefail
API=http://localhost:6061

fail() { echo "FAIL: $1"; exit 1; }

echo "1/5 health"
[ "$(curl -s -o /dev/null -w '%{http_code}' $API/health)" = "200" ] || fail "health"

echo "2/5 create"
ID=$(curl -s -X POST $API/api/prompts -H 'Content-Type: application/json' \
  -d '{"name":"Smoke Test Survivor","purpose":"smoke","body":"Hello {{name}}","category":"Ops","tags":["smoke"]}' \
  | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
[ -n "$ID" ] || fail "create"

echo "3/5 search"
curl -s "$API/api/prompts?q=Survivor" | grep -q "Smoke Test Survivor" || fail "search"

echo "4/5 usage increment"
curl -s -X POST "$API/api/prompts/$ID/use" | grep -q '"usage_count":1' || fail "usage"

echo "5/5 delete"
[ "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE $API/api/prompts/$ID)" = "204" ] || fail "delete"

echo "SMOKE PASSED"
