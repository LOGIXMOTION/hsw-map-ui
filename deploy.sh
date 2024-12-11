#!/bin/bash

echo "Starting deployment..."

# Make sure .env.dev exists
if [ ! -f .env.dev ]; then
    echo "Error: .env.dev file not found!"
    exit 1
fi

# Export environment variables
export $(cat .env.dev | xargs)

# Verify environment variable
echo "API_BASE_URL is set to: $API_BASE_URL"

# Install dependencies
npm install

# Rebuild and restart container
docker-compose down
# Clean up any dangling images
docker system prune -f

docker-compose up -d --build

echo "Waiting for container to start..."
sleep 2

# Check container status
echo "Container logs:"
docker logs asset-tracking-frontend-dev

# Quick verification
if docker ps | grep -q asset-tracking-frontend-dev; then
    echo "Deployment successful! Application is running on port 8090"
    echo "Checking environment variable..."
    docker exec asset-tracking-frontend-dev cat /usr/share/nginx/html/env.js
else
    echo "Deployment failed! Container is not running"
    echo "Container logs:"
    docker logs asset-tracking-frontend-dev
    exit 1
fi
