# Multi-stage build for Node.js backend
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && ln -sf python3 /usr/bin/python

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3001

# Start development server
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS build

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/logs ./logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S aiagent -u 1001

# Change ownership of the app directory
RUN chown -R aiagent:nodejs /app
USER aiagent

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/healthcheck.js || exit 1

# Start production server
CMD ["node", "dist/server.js"]

# Stage 1: Build the NestJS application
FROM node:18-alpine AS build

WORKDIR /app/backend

# Copy backend package.json and package-lock.json
COPY backend/package*.json ./

# Install dependencies for backend
RUN npm install

# Copy the rest of the backend source code
COPY backend/ ./

# Build the backend
RUN npm run build:prod

# Stage 2: Create the production image
FROM node:18-alpine

WORKDIR /app

# Copy the build output from the build stage
COPY --from=build /app/backend/dist ./dist

# Copy production dependencies
COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/package-lock.json ./package-lock.json

# Install only production dependencies
RUN npm ci --omit=dev

# Expose the port the app will run on
EXPOSE 3001

# Command to run the app
CMD ["node", "dist/production-server.js"] 