#!/bin/bash

echo "🏗️  Building backend for production..."

# Clean previous build
rm -rf dist/

# Build TypeScript với tsconfig.prod.json (ít strict hơn)
echo "📦 Compiling TypeScript..."
npx tsc -p tsconfig.prod.json

# Copy non-TS files
echo "📋 Copying static files..."
cp package.json dist/
cp package-lock.json dist/
cp -r migrations dist/ 2>/dev/null || true

echo "✅ Build completed!"
echo "📁 Output directory: dist/"

# Check if build was successful
if [ -f "dist/server.js" ]; then
  echo "✅ Build successful! Main entry point: dist/server.js"
  exit 0
else
  echo "❌ Build failed! dist/server.js not found"
  exit 1
fi 