#!/bin/bash

# AI Content Agent - Start Script
# Khởi động cả Frontend và Backend đồng thời

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[AI Content Agent]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port)
    if [ ! -z "$pids" ]; then
        print_warning "Killing existing process on port $port"
        kill -9 $pids 2>/dev/null || true
        sleep 2
    fi
}

# Function to cleanup on exit
cleanup() {
    print_status "Shutting down services..."
    
    # Kill backend process
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    # Kill frontend process
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes on our ports
    kill_port 3001
    kill_port 5173
    
    print_success "All services stopped"
    exit 0
}

# Setup signal handlers
trap cleanup SIGINT SIGTERM

# Main execution
main() {
    print_status "Starting AI Content Agent..."
    
    # Check if we're in the right directory
    if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    # Check for required dependencies
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    # Kill any existing processes on our ports
    kill_port 3001
    kill_port 5173
    
    # Check if ports are available
    if ! check_port 3001; then
        print_error "Port 3001 is still in use"
        exit 1
    fi
    
    if ! check_port 5173; then
        print_error "Port 5173 is still in use"
        exit 1
    fi
    
    print_status "Installing dependencies..."
    
    # Install backend dependencies
    print_status "Installing backend dependencies..."
    cd backend
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        npm install
    fi
    cd ..
    
    # Install frontend dependencies
    print_status "Installing frontend dependencies..."
    cd frontend
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        npm install
    fi
    cd ..
    
    print_success "Dependencies installed"
    
    # Create logs directory
    mkdir -p logs
    
    # Start backend
    print_status "Starting backend server on port 3001..."
    cd backend
    npm run dev > ../logs/backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..
    
    # Wait a moment for backend to start
    sleep 3
    
    # Check if backend started successfully
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        print_error "Backend failed to start. Check logs/backend.log"
        exit 1
    fi
    
    # Start frontend
    print_status "Starting frontend server on port 5173..."
    cd frontend
    npm run dev > ../logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    cd ..
    
    # Wait a moment for frontend to start
    sleep 3
    
    # Check if frontend started successfully
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        print_error "Frontend failed to start. Check logs/frontend.log"
        cleanup
        exit 1
    fi
    
    print_success "All services started successfully!"
    echo ""
    echo -e "${GREEN}🚀 AI Content Agent is running:${NC}"
    echo -e "   ${BLUE}Frontend:${NC} http://localhost:5173"
    echo -e "   ${BLUE}Backend:${NC}  http://localhost:3001"
    echo -e "   ${BLUE}API Docs:${NC} http://localhost:3001/api/v1/health"
    echo ""
    echo -e "${YELLOW}📝 Logs:${NC}"
    echo -e "   Backend: logs/backend.log"
    echo -e "   Frontend: logs/frontend.log"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    echo ""
    
    # Monitor processes
    while true; do
        # Check if backend is still running
        if ! kill -0 $BACKEND_PID 2>/dev/null; then
            print_error "Backend process died unexpectedly"
            cleanup
            exit 1
        fi
        
        # Check if frontend is still running
        if ! kill -0 $FRONTEND_PID 2>/dev/null; then
            print_error "Frontend process died unexpectedly"
            cleanup
            exit 1
        fi
        
        sleep 5
    done
}

# Show usage if help requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "AI Content Agent Start Script"
    echo ""
    echo "Usage: ./start.sh [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --logs         Show logs after starting"
    echo ""
    echo "This script will:"
    echo "  1. Install dependencies if needed"
    echo "  2. Start backend server on port 3001"
    echo "  3. Start frontend server on port 5173"
    echo "  4. Monitor both processes"
    echo ""
    echo "Press Ctrl+C to stop all services"
    exit 0
fi

# Run main function
main

# Show logs if requested
if [ "$1" = "--logs" ]; then
    echo ""
    print_status "Showing logs (Ctrl+C to stop)..."
    tail -f logs/backend.log logs/frontend.log
fi 