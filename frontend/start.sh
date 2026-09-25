#!/bin/sh
# Launcher for the Vite frontend (@workspace/conta-pj-home).
# The Emergent supervisor runs `yarn start` here with PORT=3000.
# Uses the locally-installed Vite binary (persisted under /app) so it does not
# depend on a global pnpm, which is lost across pod restarts.
set -e

export BASE_PATH="${BASE_PATH:-/}"
# Empty key => the app boots in demonstration mode (Clerk auth disabled).
export VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY:-}"

cd /app/artifacts/conta-pj-home
exec ./node_modules/.bin/vite --config vite.config.ts --host 0.0.0.0
