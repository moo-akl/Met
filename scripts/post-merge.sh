#!/bin/bash
set -euo pipefail

# Keep setup reproducible: dependency changes must include their lockfile.
pnpm install --frozen-lockfile
pnpm run typecheck:libs

# Publishing and database schema changes require separate, reviewed actions.
echo "Post-merge dependency setup and shared-library build complete."
