#!/usr/bin/env bash
# Deploy Firestore security rules to project metapp-b4642 using the
# service account credentials stored in FIREBASE_SERVICE_ACCOUNT_JSON.
#
# Usage:  ./scripts/deploy-firestore-rules.sh
#
# Requires:
#   - FIREBASE_SERVICE_ACCOUNT_JSON env var (a Replit secret in this repo)
#   - npx (bundled with node)

set -euo pipefail

if [ -z "${FIREBASE_SERVICE_ACCOUNT_JSON:-}" ]; then
  echo "FIREBASE_SERVICE_ACCOUNT_JSON is not set" >&2
  exit 1
fi

# firebase-tools picks up GOOGLE_APPLICATION_CREDENTIALS as a file path.
TMP_KEY="$(mktemp -t firebase-sa-XXXXXX.json)"
trap 'rm -f "$TMP_KEY"' EXIT
printf '%s' "$FIREBASE_SERVICE_ACCOUNT_JSON" > "$TMP_KEY"

GOOGLE_APPLICATION_CREDENTIALS="$TMP_KEY" \
  npx --yes firebase-tools@13 deploy \
  --only firestore:rules \
  --project metapp-b4642 \
  --non-interactive

echo "Firestore rules deployed to metapp-b4642."
