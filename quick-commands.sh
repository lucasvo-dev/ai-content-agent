#!/bin/bash

# 🚀 AI Content Agent - Quick Commands
# Fast access to common development and deployment tasks

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 AI Content Agent - Quick Commands${NC}"
echo "==================================="

# Quick command functions
dev_start() {
    echo -e "${GREEN}🔧 Starting development servers...${NC}"
    
    # Kill existing processes
    pkill -f "npm run dev" || true
    pkill -f "node.*3001" || true
    pkill -f "vite.*5173" || true
    
    # Start backend
    echo -e "${BLUE}Starting backend on port 3001...${NC}"
    (cd backend && npm run dev) &
    BACKEND_PID=$!
    
    # Wait a moment then start frontend
    sleep 3
    echo -e "${BLUE}Starting frontend on port 5173...${NC}"
    (cd frontend && npm run dev) &
    FRONTEND_PID=$!
    
    echo -e "${GREEN}✅ Development servers started!${NC}"
    echo "  Backend:  http://localhost:3001"
    echo "  Frontend: http://localhost:5173"
    echo ""
    echo "Press Ctrl+C to stop both servers"
    
    # Wait for interrupt
    trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null' EXIT
    wait
}

dev_stop() {
    echo -e "${YELLOW}🛑 Stopping development servers...${NC}"
    pkill -f "npm run dev" || true
    pkill -f "node.*3001" || true
    pkill -f "vite.*5173" || true
    echo -e "${GREEN}✅ Development servers stopped!${NC}"
}

quick_deploy() {
    echo -e "${GREEN}🚀 Quick Deploy (Sync + Deploy)...${NC}"
    ./sync-env.sh && ./deploy.sh
}

show_logs() {
    echo -e "${BLUE}📋 Recent deployment logs:${NC}"
    echo ""
    echo "=== Backend Logs ==="
    ssh dokku@116.118.51.71 logs ai-content-agent-be --tail 20
    echo ""
    echo "=== Frontend Logs ==="
    ssh dokku@116.118.51.71 logs ai-content-agent-fe --tail 20
}

health_check() {
    echo -e "${BLUE}🏥 Health Check...${NC}"
    echo ""
    echo "Local servers:"
    
    # Check local backend
    if curl -s http://localhost:3001/api/v1/health >/dev/null 2>&1; then
        echo -e "  Backend (local):  ${GREEN}✅ Running${NC}"
    else
        echo -e "  Backend (local):  ${RED}❌ Not running${NC}"
    fi
    
    # Check local frontend
    if curl -s http://localhost:5173 >/dev/null 2>&1; then
        echo -e "  Frontend (local): ${GREEN}✅ Running${NC}"
    else
        echo -e "  Frontend (local): ${RED}❌ Not running${NC}"
    fi
    
    echo ""
    echo "Production servers:"
    
    # Check production backend
    if curl -k -s https://be-agent.guustudio.vn/api/v1/health >/dev/null 2>&1; then
        echo -e "  Backend (prod):   ${GREEN}✅ Online${NC}"
    else
        echo -e "  Backend (prod):   ${YELLOW}⚠️ Issues${NC}"
    fi
    
    # Check production frontend
    if curl -s https://agent.guustudio.vn >/dev/null 2>&1; then
        echo -e "  Frontend (prod):  ${GREEN}✅ Online${NC}"
    else
        echo -e "  Frontend (prod):  ${YELLOW}⚠️ Issues${NC}"
    fi
}

# Menu
case "$1" in
    "start"|"dev")
        dev_start
        ;;
    "stop")
        dev_stop
        ;;
    "deploy")
        quick_deploy
        ;;
    "logs")
        show_logs
        ;;
    "health"|"status")
        health_check
        ;;
    "sync")
        ./sync-env.sh
        ;;
    "git")
        ./git-sync.sh
        ;;
    *)
        echo ""
        echo "Usage: ./quick-commands.sh [command]"
        echo ""
        echo "Available commands:"
        echo "  start, dev    - Start development servers (backend + frontend)"
        echo "  stop          - Stop development servers"
        echo "  deploy        - Quick deploy (sync env + deploy)"
        echo "  logs          - Show production logs"
        echo "  health, status- Health check (local + production)"
        echo "  sync          - Sync environment variables"
        echo "  git           - Git sync operations"
        echo ""
        echo "Examples:"
        echo "  ./quick-commands.sh start"
        echo "  ./quick-commands.sh deploy"
        echo "  ./quick-commands.sh health"
        ;;
esac 