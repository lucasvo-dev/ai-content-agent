#!/bin/bash

# 🔄 AI Content Agent - Environment Sync Script
# Synchronizes environment variables from local to Dokku server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOKKU_SERVER="dokku@116.118.51.71"
BACKEND_APP="ai-content-agent-be"
FRONTEND_APP="ai-content-agent-fe"
LOCAL_ENV_FILE="backend/.env"

echo -e "${BLUE}🔄 AI Content Agent - Environment Sync Script${NC}"
echo "=============================================="

# Check if .env file exists
if [ ! -f "$LOCAL_ENV_FILE" ]; then
    echo -e "${RED}❌ Error: $LOCAL_ENV_FILE not found!${NC}"
    exit 1
fi

echo -e "${YELLOW}📂 Reading environment variables from: $LOCAL_ENV_FILE${NC}"

# Function to set environment variable on Dokku
set_dokku_env() {
    local app=$1
    local key=$2
    local value=$3
    
    echo -e "${BLUE}  Setting $key for $app...${NC}"
    ssh $DOKKU_SERVER config:set --no-restart $app $key="$value"
}

# Function to sync specific environment variables
sync_production_env() {
    local app=$1
    
    echo -e "${GREEN}🚀 Syncing production environment for $app...${NC}"
    
    # Production environment variables
    set_dokku_env $app "NODE_ENV" "production"
    set_dokku_env $app "PORT" "3001"
    set_dokku_env $app "HOST" "0.0.0.0"
    
    # Extract and set API keys from local .env
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ $key =~ ^#.*$ ]] && continue
        [[ -z $key ]] && continue
        
        # Remove quotes from value
        value=$(echo "$value" | sed 's/^"//;s/"$//')
        
        # Sync important production variables
        case $key in
            "OPENAI_API_KEY"|"GEMINI_API_KEY"|"AI_PROVIDER"|"GOOGLE_SEARCH_API_KEY"|"GOOGLE_SEARCH_ENGINE_ID"|"BING_SEARCH_API_KEY")
                set_dokku_env $app "$key" "$value"
                ;;
            "JWT_SECRET"|"JWT_REFRESH_SECRET"|"SESSION_SECRET"|"ENCRYPTION_KEY")
                set_dokku_env $app "$key" "$value"
                ;;
            "DATABASE_URL"|"SUPABASE_URL"|"SUPABASE_ANON_KEY"|"SUPABASE_SERVICE_ROLE_KEY")
                set_dokku_env $app "$key" "$value"
                ;;
            "REDIS_URL"|"REDIS_HOST"|"REDIS_PORT")
                set_dokku_env $app "$key" "$value"
                ;;
            "SMTP_HOST"|"SMTP_PORT"|"SMTP_USER"|"SMTP_PASS")
                set_dokku_env $app "$key" "$value"
                ;;
            "FACEBOOK_APP_ID"|"FACEBOOK_APP_SECRET"|"FACEBOOK_GRAPH_API_VERSION")
                set_dokku_env $app "$key" "$value"
                ;;
            "GOOGLE_CLIENT_ID"|"GOOGLE_CLIENT_SECRET"|"MICROSOFT_CLIENT_ID"|"MICROSOFT_CLIENT_SECRET")
                set_dokku_env $app "$key" "$value"
                ;;
        esac
    done < "$LOCAL_ENV_FILE"
    
    # Set production-specific variables
    set_dokku_env $app "FRONTEND_URL" "https://agent.guustudio.vn"
    set_dokku_env $app "ENABLE_AI_CONTENT_GENERATION" "true"
    set_dokku_env $app "ENABLE_WORDPRESS_PUBLISHING" "true"
    set_dokku_env $app "ENABLE_FACEBOOK_PUBLISHING" "true"
    set_dokku_env $app "ENABLE_ANALYTICS" "true"
}

# Menu
echo ""
echo "Select sync operation:"
echo "1. Sync Backend Environment Variables"
echo "2. Sync Frontend Environment Variables"
echo "3. Sync Both (Recommended)"
echo "4. View Current Backend Environment"
echo "5. View Current Frontend Environment"
echo "6. Restart Backend"
echo "7. Restart Frontend"
echo "8. Full Deployment (Sync + Deploy)"

read -p "Enter your choice (1-8): " choice

case $choice in
    1)
        echo -e "${GREEN}🔧 Syncing Backend Environment Variables...${NC}"
        sync_production_env $BACKEND_APP
        echo -e "${GREEN}✅ Backend environment sync completed!${NC}"
        ;;
    2)
        echo -e "${GREEN}🔧 Syncing Frontend Environment Variables...${NC}"
        # Frontend specific env vars
        set_dokku_env $FRONTEND_APP "VITE_API_URL" "https://be-agent.guustudio.vn"
        set_dokku_env $FRONTEND_APP "VITE_APP_ENV" "production"
        echo -e "${GREEN}✅ Frontend environment sync completed!${NC}"
        ;;
    3)
        echo -e "${GREEN}🔧 Syncing Both Frontend and Backend...${NC}"
        sync_production_env $BACKEND_APP
        set_dokku_env $FRONTEND_APP "VITE_API_URL" "https://be-agent.guustudio.vn"
        set_dokku_env $FRONTEND_APP "VITE_APP_ENV" "production"
        echo -e "${GREEN}✅ Full environment sync completed!${NC}"
        ;;
    4)
        echo -e "${BLUE}📋 Current Backend Environment:${NC}"
        ssh $DOKKU_SERVER config $BACKEND_APP
        ;;
    5)
        echo -e "${BLUE}📋 Current Frontend Environment:${NC}"
        ssh $DOKKU_SERVER config $FRONTEND_APP
        ;;
    6)
        echo -e "${YELLOW}🔄 Restarting Backend...${NC}"
        ssh $DOKKU_SERVER ps:restart $BACKEND_APP
        echo -e "${GREEN}✅ Backend restarted!${NC}"
        ;;
    7)
        echo -e "${YELLOW}🔄 Restarting Frontend...${NC}"
        ssh $DOKKU_SERVER ps:restart $FRONTEND_APP
        echo -e "${GREEN}✅ Frontend restarted!${NC}"
        ;;
    8)
        echo -e "${GREEN}🚀 Full Deployment Process...${NC}"
        echo -e "${BLUE}Step 1: Syncing environments...${NC}"
        sync_production_env $BACKEND_APP
        set_dokku_env $FRONTEND_APP "VITE_API_URL" "https://be-agent.guustudio.vn"
        set_dokku_env $FRONTEND_APP "VITE_APP_ENV" "production"
        
        echo -e "${BLUE}Step 2: Deploying applications...${NC}"
        ./deploy.sh
        
        echo -e "${GREEN}✅ Full deployment completed!${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice!${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Environment sync completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "- Test your applications:"
echo "  Frontend: https://agent.guustudio.vn"
echo "  Backend:  https://be-agent.guustudio.vn/api/v1/health"
echo ""
echo "- To deploy code changes, run: ./deploy.sh"
echo "- To sync env again, run: ./sync-env.sh" 