#!/usr/bin/env bash

# Stop the script if any required command fails unexpectedly
set -e

# Move to project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Define production state file and log file
CURRENT_FILE="$PROJECT_ROOT/production/current"
LOG_FILE="$PROJECT_ROOT/logs/health.log"

# Define blue and green ports
BLUE_PORT=8001
GREEN_PORT=8002

# First argument = interval between checks, default is 5 seconds
INTERVAL_SECONDS="${1:-5}"

# Second argument = number of checks, default 0 means run forever
MAX_CHECKS="${2:-0}"

# Make sure logs folder and log file exist
mkdir -p "$PROJECT_ROOT/logs"
touch "$LOG_FILE"

# Make sure current production state exists
if [ ! -f "$CURRENT_FILE" ]; then
  echo "Monitoring failed: production/current does not exist."
  echo "Run ./scripts/deploy_blue_green.sh first."
  exit 1
fi

echo "Starting health monitoring..."
echo "Logging results to: $LOG_FILE"
echo "Interval: ${INTERVAL_SECONDS}s"

COUNT=0

while true; do
  # Read current production color
  CURRENT="$(cat "$CURRENT_FILE")"

  # Choose port based on current production color
  if [ "$CURRENT" = "blue" ]; then
    PORT="$BLUE_PORT"
  elif [ "$CURRENT" = "green" ]; then
    PORT="$GREEN_PORT"
  else
    echo "Invalid production/current value: $CURRENT"
    exit 1
  fi

  # Build health check URL
  HEALTH_URL="http://127.0.0.1:$PORT/api/health"

  # Create timestamp for log line
  TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"

  # Run health check and write result to log file
  if curl --silent --fail "$HEALTH_URL" > /dev/null; then
    echo "$TIMESTAMP HEALTH OK environment=$CURRENT url=$HEALTH_URL" | tee -a "$LOG_FILE"
  else
    echo "$TIMESTAMP HEALTH FAIL environment=$CURRENT url=$HEALTH_URL" | tee -a "$LOG_FILE"
  fi

  # Increase check counter
  COUNT=$((COUNT + 1))

  # Stop after MAX_CHECKS if a limit was provided
  if [ "$MAX_CHECKS" -gt 0 ] && [ "$COUNT" -ge "$MAX_CHECKS" ]; then
    echo "Monitoring completed after $COUNT checks."
    break
  fi

  # Wait before next health check
  sleep "$INTERVAL_SECONDS"
done
