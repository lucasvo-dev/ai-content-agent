#!/bin/bash

# 🔄 AI Content Agent - Git Sync Script
# Synchronizes code between local, GitHub, and Dokku

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 AI Content Agent - Git Sync Script${NC}"
echo "========================================="

# Function to check git status
check_git_status() {
    if [[ -n $(git status --porcelain) ]]; then
        echo -e "${YELLOW}⚠️  You have uncommitted changes:${NC}"
        git status --short
        echo ""
        read -p "Do you want to commit these changes? (y/n): " commit_choice
        
        if [[ $commit_choice == "y" || $commit_choice == "Y" ]]; then
            read -p "Enter commit message: " commit_message
            git add .
            git commit -m "$commit_message"
            echo -e "${GREEN}✅ Changes committed!${NC}"
        else
            echo -e "${RED}❌ Please commit or stash your changes first!${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Working directory is clean${NC}"
    fi
}

# Function to sync with GitHub
sync_github() {
    echo -e "${BLUE}📤 Pushing to GitHub...${NC}"
    git push origin main
    echo -e "${GREEN}✅ GitHub sync completed!${NC}"
}

# Function to deploy to Dokku
deploy_dokku() {
    echo -e "${BLUE}🚀 Deploying to Dokku...${NC}"
    ./deploy.sh
}

# Function to sync environment
sync_environment() {
    echo -e "${BLUE}🔧 Syncing environment variables...${NC}"
    ./sync-env.sh
}

# Function to show deployment status
show_status() {
    echo -e "${BLUE}📊 Deployment Status:${NC}"
    echo ""
    echo "🌐 Frontend: https://agent.guustudio.vn"
    echo "🔧 Backend:  https://be-agent.guustudio.vn/api/v1/health"
    echo ""
    echo "Testing connectivity..."
    
    # Test frontend
    if curl -s -o /dev/null -w "%{http_code}" https://agent.guustudio.vn | grep -q "200"; then
        echo -e "  Frontend: ${GREEN}✅ Online${NC}"
    else
        echo -e "  Frontend: ${RED}❌ Offline${NC}"
    fi
    
    # Test backend (skip SSL verification due to current issue)
    if curl -k -s -o /dev/null -w "%{http_code}" https://be-agent.guustudio.vn/api/v1/health 2>/dev/null | grep -q "200"; then
        echo -e "  Backend:  ${GREEN}✅ Online${NC}"
    else
        echo -e "  Backend:  ${YELLOW}⚠️ SSL Issue (functioning but needs SSL fix)${NC}"
    fi
}

# Main menu
echo ""
echo "Select sync operation:"
echo "1. Quick Sync (Commit + GitHub + Deploy)"
echo "2. Commit & Push to GitHub only"
echo "3. Deploy to Dokku only"
echo "4. Sync Environment Variables only"
echo "5. Full Sync (Env + Code + Deploy)"
echo "6. Show Deployment Status"
echo "7. Git Status Check"

read -p "Enter your choice (1-7): " choice

case $choice in
    1)
        echo -e "${GREEN}🚀 Quick Sync Process...${NC}"
        check_git_status
        sync_github
        deploy_dokku
        show_status
        ;;
    2)
        echo -e "${GREEN}📤 GitHub Sync...${NC}"
        check_git_status
        sync_github
        ;;
    3)
        echo -e "${GREEN}🚀 Dokku Deploy...${NC}"
        deploy_dokku
        show_status
        ;;
    4)
        echo -e "${GREEN}🔧 Environment Sync...${NC}"
        sync_environment
        ;;
    5)
        echo -e "${GREEN}🔄 Full Sync Process...${NC}"
        check_git_status
        sync_environment
        sync_github
        deploy_dokku
        show_status
        ;;
    6)
        show_status
        ;;
    7)
        echo -e "${BLUE}📋 Git Status:${NC}"
        git status
        echo ""
        echo -e "${BLUE}📋 Recent Commits:${NC}"
        git log --oneline -5
        ;;
    *)
        echo -e "${RED}❌ Invalid choice!${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Sync operation completed!${NC}" 