#!/bin/bash

# AI Content Agent - Stop Script
# Dừng tất cả services

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

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local service_name=$2
    
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pids" ]; then
        print_status "Stopping $service_name on port $port..."
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        
        # Wait a moment for graceful shutdown
        sleep 2
        
        # Force kill if still running
        local remaining_pids=$(lsof -ti:$port 2>/dev/null)
        if [ ! -z "$remaining_pids" ]; then
            print_warning "Force killing $service_name processes..."
            echo "$remaining_pids" | xargs kill -9 2>/dev/null || true
        fi
        
        print_success "$service_name stopped"
    else
        print_status "$service_name is not running on port $port"
    fi
}

# Function to kill Node.js processes by name
kill_node_processes() {
    local pattern=$1
    local service_name=$2
    
    local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    if [ ! -z "$pids" ]; then
        print_status "Stopping $service_name processes..."
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        
        # Wait for graceful shutdown
        sleep 2
        
        # Force kill if still running
        local remaining_pids=$(pgrep -f "$pattern" 2>/dev/null || true)
        if [ ! -z "$remaining_pids" ]; then
            print_warning "Force killing $service_name processes..."
            echo "$remaining_pids" | xargs kill -9 2>/dev/null || true
        fi
        
        print_success "$service_name processes stopped"
    fi
}

# Main function
main() {
    print_status "Stopping AI Content Agent services..."
    
    # Kill processes by port
    kill_port 5173 "Frontend (Vite)"
    kill_port 3001 "Backend (Express)"
    
    # Kill any remaining Node.js processes related to our project
    kill_node_processes "vite.*frontend" "Frontend Vite"
    kill_node_processes "node.*backend.*dev" "Backend Dev Server"
    kill_node_processes "npm run dev" "NPM Dev Processes"
    
    # Clean up any remaining processes that might be related
    if command -v pkill &> /dev/null; then
        pkill -f "ai-content-agent" 2>/dev/null || true
    fi
    
    print_success "All AI Content Agent services stopped"
    
    # Check if logs directory exists and show cleanup option
    if [ -d "logs" ]; then
        echo ""
        echo -e "${YELLOW}📝 Log files are still available in logs/ directory${NC}"
        echo -e "${YELLOW}   To view recent logs: tail logs/backend.log logs/frontend.log${NC}"
        echo -e "${YELLOW}   To clear logs: rm -rf logs/${NC}"
    fi
    
    echo ""
    print_success "Cleanup completed successfully!"
}

# Show usage if help requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "AI Content Agent Stop Script"
    echo ""
    echo "Usage: ./stop.sh [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --force        Force kill all processes immediately"
    echo "  --clean        Also remove log files"
    echo ""
    echo "This script will:"
    echo "  1. Stop frontend server (port 5173)"
    echo "  2. Stop backend server (port 3001)"
    echo "  3. Kill any remaining Node.js processes"
    echo "  4. Clean up resources"
    exit 0
fi

# Handle force flag
if [ "$1" = "--force" ]; then
    print_warning "Force mode enabled - killing all processes immediately"
    
    # Force kill everything immediately
    lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null || true
    lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
    pkill -9 -f "vite.*frontend" 2>/dev/null || true
    pkill -9 -f "node.*backend" 2>/dev/null || true
    pkill -9 -f "npm run dev" 2>/dev/null || true
    
    print_success "All processes force killed"
    exit 0
fi

# Handle clean flag
if [ "$1" = "--clean" ]; then
    main
    
    if [ -d "logs" ]; then
        print_status "Removing log files..."
        rm -rf logs/
        print_success "Log files removed"
    fi
    
    exit 0
fi

# Run main function
main 