#!/bin/bash

echo "🚀 Starting AI Content Agent with Google Gemini Flash integration..."

# Kill existing server on port 3001
echo "🛑 Stopping existing server..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || echo "No existing server found"

# Wait a moment
sleep 2

# Start new server with Gemini
echo "🤖 Starting server with Gemini Flash (FREE)..."
node dist/gemini-server.js &

# Wait for server to start
sleep 3

# Test Gemini endpoints
echo "🧪 Testing Gemini Flash integration..."
echo ""
echo "1. Health Check:"
curl -s http://localhost:3001/api/v1/health | jq '.'
echo ""
echo ""

echo "2. AI Health Check (Gemini):"
curl -s http://localhost:3001/api/v1/ai/health | jq '.'
echo ""
echo ""

echo "3. Available AI Models (Gemini):"
curl -s http://localhost:3001/api/v1/ai/models | jq '.data.models[] | {name, provider, cost: .costPerToken, recommended}'
echo ""
echo ""

echo "4. Content Templates (Gemini):"
curl -s http://localhost:3001/api/v1/ai/templates | jq '.data.templates[] | {name, type, provider, model}'
echo ""
echo ""

echo "5. Test Content Generation (Gemini):"
curl -s -X POST http://localhost:3001/api/v1/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "blog_post",
    "topic": "Google Gemini Flash AI Integration",
    "targetAudience": "Developers and AI enthusiasts",
    "keywords": ["Gemini", "AI", "free", "content generation"],
    "brandVoice": {
      "tone": "professional",
      "style": "conversational",
      "vocabulary": "technical",
      "length": "detailed"
    },
    "requirements": {
      "wordCount": "300-500",
      "includeHeadings": true,
      "includeCTA": true,
      "seoOptimized": true
    },
    "context": "Testing Gemini Flash integration for free AI content generation"
  }' | jq '.data | {title, type, wordCount: .metadata.wordCount, seoScore: .metadata.seoScore, provider: .metadata.provider, cost: .metadata.cost}'
echo ""
echo ""

echo "✅ Gemini Flash integration test completed!"
echo "🌐 Frontend: http://localhost:5173"
echo "🔗 Backend: http://localhost:3001"
echo "🤖 AI Provider: Google Gemini Flash"
echo "💰 Cost: FREE within generous limits"
echo "🚀 Ready for content generation!" 