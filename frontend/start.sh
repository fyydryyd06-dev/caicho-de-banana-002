#!/bin/sh
# Launcher for the Vite frontend (@workspace/conta-pj-home).
# The Emergent supervisor runs `yarn start` here with PORT=3000.
set -e

export BASE_PATH="${BASE_PATH:-/}"
# Empty key => the app boots in demonstration mode (Clerk auth disabled).
export VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY:-}"

cd /app
exec pnpm --filter @workspace/conta-pj-home run dev
