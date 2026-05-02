#!/usr/bin/env bash

# Stop the script if any command fails
set -e

# Print clear section title
echo "Starting environment setup..."

# Move to the project root, no matter where the script is called from
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Create required project directories
echo "Creating required directories..."
mkdir -p logs
mkdir -p production/blue
mkdir -p production/green

# Create health log file if it does not exist
echo "Preparing monitoring log file..."
touch logs/health.log

# Install backend dependencies
echo "Installing backend dependencies with uv..."
cd "$PROJECT_ROOT/backend"
uv sync --all-groups

# Run backend checks
echo "Checking backend..."
uv run ruff check .
uv run pytest

# Install frontend dependencies
echo "Installing frontend dependencies with npm..."
cd "$PROJECT_ROOT/frontend"
npm install

# Run frontend checks
echo "Checking frontend..."
npm run lint
npm run build

# Return to project root
cd "$PROJECT_ROOT"

# Print success message
echo "Environment setup completed successfully."
echo "Backend, frontend, logs, and production folders are ready."
