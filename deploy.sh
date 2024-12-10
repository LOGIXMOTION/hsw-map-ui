#!/bin/bash

echo "Starting deployment..."

# Make sure .env.dev exists
if [ ! -f .env.dev ]; then
    echo "Error: .env.dev file not found!"
    exit 1
fi

# Load environment variables
set -a
source .env.dev
set +a

# Install dependencies
npm install

# Rebuild and restart container
docker-compose down
docker-compose up -d --build

# Quick verification
if docker ps | grep -q asset-tracking-frontend-dev; then
    echo "Deployment successful! Application is running on port 8500"
    echo "Checking environment variable..."
    docker exec asset-tracking-frontend-dev cat /usr/share/nginx/html/env.js
else
    echo "Deployment failed! Container is not running"
    exit 1
fi