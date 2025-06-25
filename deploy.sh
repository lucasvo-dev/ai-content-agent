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
    
    # Ensure we have the right package.json for frontend
    git add package.json Procfile .buildpacks
    git commit -m "Add frontend deployment config"
    
    # Push to frontend remote
    git push dokku-fe main
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Frontend deployed successfully!${NC}"
        echo -e "${GREEN}🌐 Frontend URL: http://your-server-ip:ai-content-agent-fe-port${NC}"
    else
        echo -e "${RED}❌ Frontend deployment failed${NC}"
        return 1
    fi
}

# Function to deploy backend
deploy_backend() {
    echo -e "${BLUE}🔧 Deploying Backend to ai-content-agent-be...${NC}"
    
    # Switch to backend package.json
    mv package.json package-frontend.json
    mv backend-package.json package.json
    
    # Create Procfile for backend
    echo "web: npm start" > Procfile
    
    # Commit backend config
    git add package.json Procfile
    git commit -m "Add backend deployment config"
    
    # Push to backend remote
    git push dokku-be main
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Backend deployed successfully!${NC}"
        echo -e "${GREEN}🔗 Backend URL: http://your-server-ip:ai-content-agent-be-port${NC}"
    else
        echo -e "${RED}❌ Backend deployment failed${NC}"
        # Restore frontend config
        mv package.json backend-package.json
        mv package-frontend.json package.json
        return 1
    fi
    
    # Restore frontend config
    mv package.json backend-package.json
    mv package-frontend.json package.json
    echo "web: npm start" > Procfile
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
        echo -e "${YELLOW}📋 Run these commands on your Dokku server:${NC}"
        echo ""
        echo "# Create apps"
        echo "dokku apps:create ai-content-agent-fe"
        echo "dokku apps:create ai-content-agent-be"
        echo ""
        echo "# Add git remotes (run on your local machine):"
        echo "git remote add dokku-fe dokku@your-server-ip:ai-content-agent-fe"
        echo "git remote add dokku-be dokku@your-server-ip:ai-content-agent-be"
        echo ""
        echo "# Set environment variables for backend:"
        echo "dokku config:set ai-content-agent-be NODE_ENV=production"
        echo "dokku config:set ai-content-agent-be PORT=3001"
        echo "dokku config:set ai-content-agent-be OPENAI_API_KEY=your-openai-key"
        echo "dokku config:set ai-content-agent-be GOOGLE_AI_API_KEY=your-gemini-key"
        echo ""
        echo "# Set ports"
        echo "dokku proxy:ports-set ai-content-agent-fe http:80:5173"
        echo "dokku proxy:ports-set ai-content-agent-be http:80:3001"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}🎉 Deployment script completed!${NC}" 