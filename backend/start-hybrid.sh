#!/bin/bash

echo "🚀 Starting AI Content Agent with Hybrid AI (OpenAI + Gemini)..."

# Kill existing server on port 3001
echo "🛑 Stopping existing server..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || echo "No existing server found"

# Wait a moment
sleep 2

# Start new server with Hybrid AI
echo "🤖 Starting server with Hybrid AI (OpenAI + Gemini)..."
node dist/gemini-server.js &

# Wait for server to start
sleep 3

# Test Hybrid AI endpoints
echo "🧪 Testing Hybrid AI integration..."
echo ""
echo "1. Health Check:"
curl -s http://localhost:3001/api/v1/health | jq '.'
echo ""
echo ""

echo "2. AI Health Check (Hybrid):"
curl -s http://localhost:3001/api/v1/ai/health | jq '.'
echo ""
echo ""

echo "3. Available AI Models (Hybrid):"
curl -s http://localhost:3001/api/v1/ai/models | jq '.data.models[] | {name, provider, cost: .costPerToken, recommended}'
echo ""
echo ""

echo "4. Content Templates:"
curl -s http://localhost:3001/api/v1/ai/templates | jq '.data.templates[] | {name, type, provider}'
echo ""
echo ""

echo "5. Test AI Generation (Hybrid):"
curl -s -X POST http://localhost:3001/api/v1/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "blog_post",
    "topic": "Hybrid AI for Content Generation",
    "targetAudience": "Content creators and marketers",
    "keywords": ["AI", "content", "automation", "hybrid"],
    "brandVoice": {
      "tone": "professional",
      "style": "conversational",
      "vocabulary": "industry-specific",
      "length": "detailed"
    },
    "requirements": {
      "wordCount": "500-800",
      "includeHeadings": true,
      "includeCTA": true,
      "seoOptimized": true
    },
    "context": "Explain the benefits of using both OpenAI and Gemini for content generation"
  }' | jq '.data | {title, provider: .metadata.provider, model: .metadata.aiModel, cost: .metadata.cost, wordCount: .metadata.wordCount}'

echo ""
echo ""
echo "✅ Hybrid AI integration test completed!"
echo ""
echo "🌐 Server running at: http://localhost:3001"
echo "📖 Health: http://localhost:3001/api/v1/health"
echo "🤖 AI Health: http://localhost:3001/api/v1/ai/health"
echo "🧪 Test: http://localhost:3001/api/v1/test"
echo ""
echo "🎯 Features:"
echo "  - OpenAI GPT-4 Turbo (Premium quality)"
echo "  - Google Gemini Flash (Free tier)"
echo "  - Intelligent provider selection"
echo "  - Cost optimization"
echo "  - Automatic fallback"
echo ""
echo "💰 Cost Strategy:"
echo "  - Complex content → OpenAI (Higher quality)"
echo "  - Simple content → Gemini (Free)"
echo "  - Hybrid mode → Intelligent selection" 