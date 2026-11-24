#!/usr/bin/env bash
# CI guard: Money Plan is fully offline. Fails if app code uses network APIs, analytics or remote fonts.
set -euo pipefail
cd "$(dirname "$0")/.."
pattern='\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|EventSource|sendBeacon|axios|@sentry/|firebase|amplitude|segment\.io|fonts\.googleapis|fonts\.gstatic|https?://'
hits=$(grep -rnE "$pattern" src app --include='*.ts' --include='*.tsx' --include='*.js' | grep -v 'no-network-allow' || true)
if [ -n "$hits" ]; then
  echo "Network access found (Money Plan must stay offline):"
  echo "$hits"
  exit 1
fi
# Dependencies that phone home.
if grep -nE '"(@sentry/[^"]+|firebase|@react-native-firebase/[^"]+|@segment/[^"]+|@amplitude/[^"]+|expo-updates|expo-network|axios)"' package.json; then
  echo "A network dependency is listed in package.json."
  exit 1
fi
echo "No network access found."
