#!/usr/bin/env bash

# Stop the script if any command fails
set -e

# Move to project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Define production state files
CURRENT_FILE="$PROJECT_ROOT/production/current"
PREVIOUS_FILE="$PROJECT_ROOT/production/previous"

BLUE_PORT=8001
GREEN_PORT=8002

echo "Starting rollback..."

# Make sure deployment state exists
if [ ! -f "$CURRENT_FILE" ] || [ ! -f "$PREVIOUS_FILE" ]; then
  echo "Rollback failed: current or previous production state is missing."
  echo "Run ./scripts/deploy_blue_green.sh at least once before rollback."
  exit 1
fi

CURRENT="$(cat "$CURRENT_FILE")"
PREVIOUS="$(cat "$PREVIOUS_FILE")"

# Validate previous environment
if [ "$PREVIOUS" != "blue" ] && [ "$PREVIOUS" != "green" ]; then
  echo "Rollback failed: invalid previous environment: $PREVIOUS"
  exit 1
fi

# Pick rollback port
if [ "$PREVIOUS" = "blue" ]; then
  ROLLBACK_PORT="$BLUE_PORT"
else
  ROLLBACK_PORT="$GREEN_PORT"
fi

echo "Current production: $CURRENT"
echo "Rolling back to: $PREVIOUS"

# Check that previous environment is healthy before switching
echo "Checking rollback target health..."
curl --fail "http://127.0.0.1:$ROLLBACK_PORT/api/health" > /dev/null

# Swap current and previous
echo "$CURRENT" > "$PREVIOUS_FILE"
echo "$PREVIOUS" > "$CURRENT_FILE"

echo "Rollback successful."
echo "Current production is now: $PREVIOUS"
echo "Previous production is now: $CURRENT"
echo "Rollback target health: http://127.0.0.1:$ROLLBACK_PORT/api/health"
