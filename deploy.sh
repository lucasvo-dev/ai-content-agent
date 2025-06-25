#!/bin/bash

echo "🚀 AI Content Agent - Dokku Deployment Script"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to deploy frontend
deploy_frontend() {
    echo -e "${BLUE}📱 Deploying Frontend to ai-content-agent-fe...${NC}"
    
    # No need to move package.json or Procfile here anymore
    
    # Push to frontend remote
    git push dokku-fe main
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Frontend deployed successfully!${NC}"
        echo -e "${GREEN}🌐 Frontend URL: https://agent.guustudio.vn${NC}"
    else
        echo -e "${RED}❌ Frontend deployment failed${NC}"
        return 1
    fi
}

# Function to deploy backend
deploy_backend() {
    echo -e "${BLUE}🔧 Deploying Backend to ai-content-agent-be...${NC}"
    
    # No need to move package.json or create Procfile here anymore
    
    # Push to backend remote
    git push dokku-be main
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Backend deployed successfully!${NC}"
        echo -e "${GREEN}🔗 Backend URL: https://be.agent.guustudio.vn${NC}"
    else
        echo -e "${RED}❌ Backend deployment failed${NC}"
        return 1
    fi
}

# Main deployment menu
echo -e "${YELLOW}Select deployment option:${NC}"
echo "1. Deploy Frontend only"
echo "2. Deploy Backend only" 
echo "3. Deploy Both (Frontend first, then Backend)"
echo "4. Setup Dokku apps (run on server)"

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        deploy_frontend
        ;;
    2)
        deploy_backend
        ;;
    3)
        echo -e "${BLUE}🚀 Deploying both Frontend and Backend...${NC}"
        deploy_frontend
        if [ $? -eq 0 ]; then
            deploy_backend
        fi
        ;;
    4)
        echo -e "${YELLOW}📋 Run these commands on your Dokku server (once):${NC}"
        echo ""
        echo "# Create apps (if not already created)"
        echo "dokku apps:create ai-content-agent-fe"
        echo "dokku apps:create ai-content-agent-be"
        echo ""
        echo "# Set build directories for monorepo (IMPORTANT!)"
        echo "dokku git:set ai-content-agent-fe build-dir frontend"
        echo "dokku git:set ai-content-agent-be build-dir backend"
        echo ""
        echo "# Add git remotes (run on your local machine if not already added):"
        echo "git remote add dokku-fe dokku@116.118.51.71:ai-content-agent-fe"
        echo "git remote add dokku-be dokku@116.118.51.71:ai-content-agent-be"
        echo ""
        echo "# Set environment variables for backend:"
        echo "dokku config:set ai-content-agent-be NODE_ENV=production"
        echo "dokku config:set ai-content-agent-be PORT=3001"
        echo "dokku config:set ai-content-agent-be OPENAI_API_KEY=your-openai-key"
        echo "dokku config:set ai-content-agent-be GOOGLE_AI_API_KEY=your-gemini-key"
        echo ""
        echo "# Set ports for proxy (frontend typically 5173, backend 3001)"
        echo "dokku proxy:ports-set ai-content-agent-fe http:80:5173 https:443:5173"
        echo "dokku proxy:ports-set ai-content-agent-be http:80:3001 https:443:3001"
        echo ""
        echo "# Set domains and enable Let's Encrypt (run on your Dokku server):"
        echo "dokku domains:set ai-content-agent-fe agent.guustudio.vn"
        echo "dokku domains:set ai-content-agent-be be.agent.guustudio.vn"
        echo "dokku letsencrypt:enable ai-content-agent-fe"
        echo "dokku letsencrypt:enable ai-content-agent-be"
        echo "dokku letsencrypt:set ai-content-agent-fe email votanlean@gmail.com"
        echo "dokku letsencrypt:set ai-content-agent-be email votanlean@gmail.com"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}🎉 Deployment script completed!${NC}" 