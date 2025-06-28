#!/bin/bash

# AI Content Agent - Production Deployment Script

set -e  # Exit on error

echo "🚀 Starting AI Content Agent Production Deployment..."

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

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root!"
   exit 1
fi

# 1. Pull latest code
print_warning "Pulling latest code..."
git pull origin main

# 2. Backend deployment
print_warning "Deploying backend..."
cd backend

# Install dependencies
print_warning "Installing backend dependencies..."
npm ci --production

# Build backend
print_warning "Building backend..."
chmod +x build-prod.sh
./build-prod.sh

# Check if .env exists
if [ ! -f .env ]; then
    print_error ".env file not found! Please create it from .env.example"
    exit 1
fi

# Run migrations
print_warning "Running database migrations..."
npm run migrate || print_warning "Migration failed or already up to date"

# 3. Frontend deployment
print_warning "Deploying frontend..."
cd ../frontend

# Install dependencies
print_warning "Installing frontend dependencies..."
npm ci

# Build frontend
print_warning "Building frontend..."
npm run build

# 4. Restart services
print_warning "Restarting services..."
cd ..

# Stop existing services
pm2 stop ai-content-backend || true

# Start backend with PM2
cd backend
pm2 start ecosystem.config.js --env production
pm2 save

print_success "Deployment completed successfully!"

# 5. Health check
print_warning "Running health check..."
sleep 5
curl -f http://localhost:3001/api/v1/health || print_error "Backend health check failed!"

print_success "AI Content Agent deployed successfully!"
print_warning "Don't forget to:"
echo "  - Update Nginx configuration if needed"
echo "  - Check logs: pm2 logs ai-content-backend"
echo "  - Monitor the application" 