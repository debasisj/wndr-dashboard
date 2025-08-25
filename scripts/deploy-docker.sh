#!/bin/bash

# Deploy using Docker Compose with pre-built images
# Usage: ./scripts/deploy-docker.sh [environment-file]
# Example: ./scripts/deploy-docker.sh .env.deploy

set -e

ENV_FILE=${1:-.env.deploy}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo_error "Environment file '$ENV_FILE' not found!"
    echo_info "Please create it from the template:"
    echo_info "  cp .env.deploy.template $ENV_FILE"
    echo_info "  # Edit $ENV_FILE with your configuration"
    exit 1
fi

echo_info "🚀 Starting deployment with environment file: $ENV_FILE"

# Load environment variables
export $(grep -v '^#' "$ENV_FILE" | xargs)

# Pull latest images if registry is specified
if [ -n "$REGISTRY" ]; then
    echo_info "Pulling latest images from registry..."
    docker-compose -f docker-compose.deploy.yml --env-file "$ENV_FILE" pull
fi

# Stop existing containers
echo_info "Stopping existing containers..."
docker-compose -f docker-compose.deploy.yml --env-file "$ENV_FILE" down

# Start services
echo_info "Starting services..."
docker-compose -f docker-compose.deploy.yml --env-file "$ENV_FILE" up -d

# Wait for services to be healthy
echo_info "Waiting for services to be ready..."
sleep 10

# Check service status
echo_info "Checking service status..."
docker-compose -f docker-compose.deploy.yml --env-file "$ENV_FILE" ps

# Test API health
API_PORT=${API_PORT:-4000}
echo_info "Testing API health..."
if curl -f -s "http://localhost:$API_PORT/health" > /dev/null; then
    echo_info "✅ API is healthy!"
else
    echo_error "❌ API health check failed"
    echo_info "Check logs with: docker-compose -f docker-compose.deploy.yml logs api"
fi

# Test Web health
WEB_PORT=${WEB_PORT:-3000}
echo_info "Testing Web health..."
if curl -f -s "http://localhost:$WEB_PORT" > /dev/null; then
    echo_info "✅ Web is healthy!"
else
    echo_error "❌ Web health check failed"
    echo_info "Check logs with: docker-compose -f docker-compose.deploy.yml logs web"
fi

echo_info ""
echo_info "🎉 Deployment complete!"
echo_info "Services available at:"
echo_info "  Web: http://localhost:$WEB_PORT"
echo_info "  API: http://localhost:$API_PORT"
echo_info ""
echo_info "Useful commands:"
echo_info "  View logs: docker-compose -f docker-compose.deploy.yml logs -f"
echo_info "  Stop services: docker-compose -f docker-compose.deploy.yml down"
echo_info "  Restart services: docker-compose -f docker-compose.deploy.yml restart"