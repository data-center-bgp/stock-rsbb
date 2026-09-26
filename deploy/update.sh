#!/usr/bin/env bash
# Update the VPS to the latest main and restart (see DEPLOY.md).
# Run from anywhere: ./deploy/update.sh
#
# The build replaces .next while the old version is still running, so the
# app can error for the minute or two it takes: run updates outside the
# hours staff are recording.
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
npm ci
npm run build
pm2 reload ecosystem.config.cjs --update-env
pm2 save

echo "Updated to $(git log -1 --format='%h %s')"
