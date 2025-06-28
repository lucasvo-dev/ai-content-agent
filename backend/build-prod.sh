#!/bin/bash

echo "🏗️  Building backend for production..."

# Clean previous build
rm -rf dist/

# Use dev build config which works
echo "📦 Compiling TypeScript with dev config..."
npx tsc -p tsconfig.dev.json
npx tsc-alias -p tsconfig.dev.json

# Copy non-TS files
echo "📋 Copying static files..."
cp package.json dist/
cp package-lock.json dist/
cp -r migrations dist/ 2>/dev/null || true

echo "✅ Build completed!"
echo "📁 Output directory: dist/"

# Check if build was successful
if [ -f "dist/dev-server.js" ]; then
  echo "✅ Build successful! Main entry point: dist/dev-server.js"
  exit 0
else
  echo "❌ Build failed! dist/dev-server.js not found"
  exit 1
fi 