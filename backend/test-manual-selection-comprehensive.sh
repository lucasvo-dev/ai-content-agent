#!/bin/bash

echo "🧪 Comprehensive Manual AI Provider Selection Test"
echo "=================================================="

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
    "type": "social_media",
    "topic": "Auto Selection Test",
    "targetAudience": "General audience",
    "keywords": ["test", "auto"],
    "brandVoice": {
      "tone": "casual",
      "style": "conversational",
      "vocabulary": "simple",
      "length": "concise"
    },
    "preferredProvider": "auto"
  }' | jq '.data.metadata | {selectedProvider, requestedProvider, selectionReason, aiModel, cost}' 2>/dev/null

echo -e "\n${BLUE}2. Testing Manual OpenAI Selection${NC}"
curl -X POST "$BASE_URL/ai/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "blog_post",
    "topic": "Manual OpenAI Test - Premium Content",
    "targetAudience": "Business professionals",
    "keywords": ["premium", "quality", "business"],
    "brandVoice": {
      "tone": "professional",
      "style": "formal",
      "vocabulary": "industry-specific",
      "length": "comprehensive"
    },
    "preferredProvider": "openai"
  }' | jq '.data.metadata | {selectedProvider, requestedProvider, selectionReason, aiModel, cost}' 2>/dev/null

echo -e "\n${BLUE}3. Testing Manual Gemini Selection${NC}"
curl -X POST "$BASE_URL/ai/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email",
    "topic": "Manual Gemini Test - Free Content",
    "targetAudience": "General users",
    "keywords": ["free", "fast", "efficient"],
    "brandVoice": {
      "tone": "friendly",
      "style": "conversational",
      "vocabulary": "simple",
      "length": "concise"
    },
    "preferredProvider": "gemini"
  }' | jq '.data.metadata | {selectedProvider, requestedProvider, selectionReason, aiModel, cost}' 2>/dev/null

echo -e "\n${BLUE}4. Testing Complex Content (Should prefer OpenAI)${NC}"
curl -X POST "$BASE_URL/ai/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "blog_post",
    "topic": "Advanced AI Architecture for Enterprise Solutions",
    "targetAudience": "Technical architects and CTOs",
    "keywords": ["AI", "architecture", "enterprise", "scalability", "microservices"],
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
    "context": "This is a detailed technical article for enterprise decision makers who need to understand the complexities of implementing AI solutions at scale."
  }' | jq '.data.metadata | {selectedProvider, requestedProvider, selectionReason, aiModel, cost, complexity: .complexity}' 2>/dev/null

echo -e "\n${BLUE}5. Testing Simple Content (Should prefer Gemini)${NC}"
curl -X POST "$BASE_URL/ai/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "social_media",
    "topic": "Quick tip for productivity",
    "targetAudience": "General audience",
    "keywords": ["tip", "productivity"],
    "brandVoice": {
      "tone": "casual",
      "style": "conversational",
      "vocabulary": "simple",
      "length": "concise"
    }
  }' | jq '.data.metadata | {selectedProvider, requestedProvider, selectionReason, aiModel, cost}' 2>/dev/null

echo -e "\n${GREEN}✅ Manual Provider Selection Test Complete${NC}"
echo "Check the results above to verify manual selection is working correctly." 