# Stage 1: Build the NestJS application
FROM node:18-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies for backend
RUN npm install

# Copy the rest of the backend source code
COPY . ./

# Build the backend
RUN npm run build:prod

# Stage 2: Create the production image
FROM node:18-alpine

WORKDIR /app

# Copy the build output from the build stage
COPY --from=build /app/dist ./dist

# Copy production dependencies
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json

# Install only production dependencies
RUN npm ci --omit=dev

# Expose the port the app will run on
EXPOSE 3001

# Command to run the app
CMD ["node", "dist/production-server.js"] 