#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

echo "Pushing to GitHub..."
if git push github main; then
  echo "GitHub sync complete."
else
  echo "WARNING: GitHub push failed (remote unreachable or rejected). Sync manually if needed."
fi
