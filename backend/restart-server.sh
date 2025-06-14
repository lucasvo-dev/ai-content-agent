#!/bin/bash

echo "🔄 Restarting AI Content Agent server with Gemini Flash integration..."

# Kill existing server on port 3001
echo "🛑 Stopping existing server..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || echo "No existing server found"

# Wait a moment
sleep 2

# Start new server
echo "🚀 Starting server with Gemini Flash..."
node dist/final-server.js &

# Wait for server to start
sleep 3

# Test endpoints
echo "🧪 Testing Gemini integration..."
echo ""
echo "1. Health Check:"
curl -s http://localhost:3001/api/v1/health | jq '.'
echo ""
echo ""

echo "2. AI Health Check:"
curl -s http://localhost:3001/api/v1/ai/health | jq '.'
echo ""
echo ""

echo "3. Available AI Models:"
curl -s http://localhost:3001/api/v1/ai/models | jq '.data.models[] | {name, provider, cost: .costPerToken, recommended}'
echo ""
echo ""

echo "4. Content Templates:"
curl -s http://localhost:3001/api/v1/ai/templates | jq '.data.templates[] | {name, type, provider, model}'
echo ""
echo ""

echo "✅ Server restarted with Gemini Flash integration!"
echo "🌐 Frontend: http://localhost:5173"
echo "🔗 Backend: http://localhost:3001"
echo "🤖 AI Provider: Google Gemini Flash (Free)" 