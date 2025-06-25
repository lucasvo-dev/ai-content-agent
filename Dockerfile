# Stage 1: Build the React application
FROM node:18-alpine AS build

WORKDIR /app

# Copy frontend package.json and package-lock.json
COPY frontend/package*.json ./frontend/

# Install dependencies for frontend
WORKDIR /app/frontend
RUN npm install

# Copy the rest of the frontend source code
COPY frontend/ ./

# Build the frontend
RUN npm run build

# Stage 2: Serve the static files with a lightweight server
FROM node:18-alpine

WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Copy the build output from the build stage
COPY --from=build /app/frontend/dist ./dist

# Expose the port the app will run on
EXPOSE 5173

# Command to run the app
CMD ["serve", "-s", "dist", "-l", "5173"] 