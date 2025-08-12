#!/bin/bash
# Startup script for Address Validation Service
# This script ensures native modules are rebuilt to prevent Node version mismatch

echo "Starting Address Validation Service..."

# Rebuild any native modules if needed
echo "Rebuilding native modules..."
npm rebuild 2>/dev/null || true

# Ensure all dependencies are installed correctly
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm ci --production
fi

# Ensure dist directory exists
if [ ! -d "dist" ]; then
  echo "Building TypeScript..."
  npm run build
fi

# Start the actual server
echo "Starting server on port ${PORT:-3715}..."
exec node dist/server.js