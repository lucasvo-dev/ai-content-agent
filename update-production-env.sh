#!/bin/bash

echo "🔧 Updating Production Environment Variables..."
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    print_error ".env file not found in backend/"
    exit 1
fi

print_warning "Reading environment variables from backend/.env"

# Extract values from .env file
CLAUDE_API_KEY=$(grep "^CLAUDE_API_KEY=" backend/.env | cut -d'=' -f2)
WORDPRESS_WEDDING_PASSWORD=$(grep "^WORDPRESS_WEDDING_PASSWORD=" backend/.env | cut -d'=' -f2)
WORDPRESS_YEARBOOK_PASSWORD=$(grep "^WORDPRESS_YEARBOOK_PASSWORD=" backend/.env | cut -d'=' -f2)
WORDPRESS_MAIN_PASSWORD=$(grep "^WORDPRESS_MAIN_PASSWORD=" backend/.env | cut -d'=' -f2)

print_warning "Updating Claude API Key..."
ssh dokku@116.118.51.71 config:set ai-content-agent-be CLAUDE_API_KEY="$CLAUDE_API_KEY"

print_warning "Updating WordPress Wedding Site Password..."
ssh dokku@116.118.51.71 config:set ai-content-agent-be WORDPRESS_WEDDING_URL="https://wedding.guustudio.vn"
ssh dokku@116.118.51.71 config:set ai-content-agent-be WORDPRESS_WEDDING_USERNAME="admin"
ssh dokku@116.118.51.71 config:set ai-content-agent-be WORDPRESS_WEDDING_PASSWORD="$WORDPRESS_WEDDING_PASSWORD"

print_warning "Updating WordPress Yearbook Site Password..."
ssh dokku@116.118.51.71 config:set ai-content-agent-be WORDPRESS_YEARBOOK_URL="https://guukyyeu.vn"
ssh dokku@116.118.51.71 config:set ai-content-agent-be WORDPRESS_YEARBOOK_USERNAME="admin"
ssh dokku@116.118.51.71 config:set ai-content-agent-be WORDPRESS_YEARBOOK_PASSWORD="$WORDPRESS_YEARBOOK_PASSWORD"

print_warning "Updating WordPress Main Site Password..."
ssh dokku@116.118.51.71 config:set ai-content-agent-be WORDPRESS_MAIN_URL="https://guustudio.vn"
ssh dokku@116.118.51.71 config:set ai-content-agent-be WORDPRESS_MAIN_USERNAME="admin"
ssh dokku@116.118.51.71 config:set ai-content-agent-be WORDPRESS_MAIN_PASSWORD="$WORDPRESS_MAIN_PASSWORD"

print_warning "Enabling all features in production..."
ssh dokku@116.118.51.71 config:set ai-content-agent-be ENABLE_AI_CONTENT_GENERATION="true"
ssh dokku@116.118.51.71 config:set ai-content-agent-be ENABLE_WORDPRESS_PUBLISHING="true"
ssh dokku@116.118.51.71 config:set ai-content-agent-be ENABLE_FACEBOOK_PUBLISHING="true"
ssh dokku@116.118.51.71 config:set ai-content-agent-be ENABLE_ANALYTICS="true"

print_success "All environment variables updated successfully!"

print_warning "Restarting backend to apply changes..."
ssh dokku@116.118.51.71 ps:restart ai-content-agent-be

print_success "Production environment update completed!"
echo ""
echo "🌐 Frontend: https://agent.guustudio.vn"
echo "🔧 Backend:  https://be-agent.guustudio.vn/api/v1/health"
echo ""
print_warning "Testing connectivity..."
curl -s https://agent.guustudio.vn > /dev/null && print_success "Frontend: Online" || print_error "Frontend: Offline"
curl -s https://be-agent.guustudio.vn/api/v1/health > /dev/null && print_success "Backend: Online" || print_error "Backend: Offline" 