#!/bin/bash

echo "🧪 Testing Manual AI Provider Selection"
echo "======================================="

BASE_URL="http://localhost:3001/api/v1"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}1. Testing Auto Selection (Intelligent)${NC}"
curl -X POST "$BASE_URL/ai/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "blog_post",
    "topic": "Auto Selection Test - AI Content Generation",
    "targetAudience": "Developers",
    "keywords": ["AI", "automation", "testing"],
    "brandVoice": {
      "tone": "professional",
      "style": "conversational",
      "vocabulary": "technical",
      "length": "detailed"
    },
    "preferredProvider": "auto"
  }' | jq '.data.metadata | {selectedProvider, requestedProvider, selectionReason}'

echo -e "\n${GREEN}2. Testing Manual OpenAI Selection${NC}"
curl -X POST "$BASE_URL/ai/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "social_media",
    "topic": "Manual OpenAI Test - Premium AI Content",
    "targetAudience": "Business owners",
    "keywords": ["premium", "quality", "AI"],
    "brandVoice": {
      "tone": "professional",
      "style": "conversational",
      "vocabulary": "simple",
      "length": "concise"
    },
    "preferredProvider": "openai"
  }' | jq '.data.metadata | {selectedProvider, requestedProvider, selectionReason, aiModel, cost}'

echo -e "\n${YELLOW}3. Testing Manual Gemini Selection${NC}"
curl -X POST "$BASE_URL/ai/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email",
    "topic": "Manual Gemini Test - Free AI Content",
    "targetAudience": "General audience",
    "keywords": ["free", "fast", "efficient"],
    "brandVoice": {
      "tone": "friendly",
      "style": "conversational",
      "vocabulary": "simple",
      "length": "concise"
    },
    "preferredProvider": "gemini"
  }' | jq '.data.metadata | {selectedProvider, requestedProvider, selectionReason, aiModel, cost}'

echo -e "\n${RED}4. Testing Invalid Provider (should fallback)${NC}"
curl -X POST "$BASE_URL/ai/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ad_copy",
    "topic": "Invalid Provider Test",
    "targetAudience": "Test audience",
    "keywords": ["test", "fallback"],
    "brandVoice": {
      "tone": "casual",
      "style": "conversational",
      "vocabulary": "simple",
      "length": "concise"
    },
    "preferredProvider": "invalid"
  }' | jq '.data.metadata | {selectedProvider, requestedProvider, selectionReason, originalError}'

echo -e "\n${BLUE}5. Testing Complex Content (should prefer OpenAI in auto mode)${NC}"
curl -X POST "$BASE_URL/ai/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "blog_post",
    "topic": "Advanced Machine Learning Algorithms for Enterprise Applications",
    "targetAudience": "Enterprise architects and ML engineers",
    "keywords": ["machine learning", "enterprise", "algorithms", "scalability", "architecture"],
    "brandVoice": {
      "tone": "authoritative",
      "style": "technical",
      "vocabulary": "industry-specific",
      "length": "comprehensive"
    },
    "requirements": {
      "wordCount": "2000-3000",
      "includeHeadings": true,
      "includeCTA": true,
      "seoOptimized": true
    },
    "preferredProvider": "auto"
  }' | jq '.data.metadata | {selectedProvider, requestedProvider, selectionReason, complexity: "high"}'

echo -e "\n${GREEN}✅ Manual Provider Selection Tests Completed!${NC}"
echo "Check the results above to verify provider selection is working correctly." 