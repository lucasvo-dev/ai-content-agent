# syntax=docker.io/docker/dockerfile:1

# Stage 1: Build the React application
FROM node:18-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies for frontend
RUN npm install

# Copy the rest of the frontend source code
COPY . ./

# Build the frontend
RUN npm run build

# Stage 2: Serve the static files with a lightweight server
FROM node:18-alpine

WORKDIR /app

# Copy the build output from the build stage
COPY --from=build /app/dist ./dist

# Copy package.json to install 'serve'
COPY package.json ./package.json
RUN npm install --omit=dev && npm cache clean --force && mv node_modules /app/node_modules

# Expose the port the app will run on
EXPOSE 5173

# Command to run the app
CMD [ "npx", "serve", "-s", "dist", "-l", "5173" ]
