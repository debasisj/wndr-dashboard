#!/bin/bash

# Build and push Docker images for distribution
# Usage: ./scripts/build-images.sh [version] [registry]
# Example: ./scripts/build-images.sh v1.0.0 your-dockerhub-username
# Example: ./scripts/build-images.sh v1.0.0 123456789012.dkr.ecr.us-east-1.amazonaws.com

set -e

VERSION=${1:-latest}
REGISTRY=${2:-""}
PROJECT_NAME="wndr-dashboard"

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

# Set image names
if [ -n "$REGISTRY" ]; then
    API_IMAGE="${REGISTRY}/${PROJECT_NAME}-api:${VERSION}"
    WEB_IMAGE="${REGISTRY}/${PROJECT_NAME}-web:${VERSION}"
    API_IMAGE_LATEST="${REGISTRY}/${PROJECT_NAME}-api:latest"
    WEB_IMAGE_LATEST="${REGISTRY}/${PROJECT_NAME}-web:latest"
else
    API_IMAGE="${PROJECT_NAME}-api:${VERSION}"
    WEB_IMAGE="${PROJECT_NAME}-web:${VERSION}"
    API_IMAGE_LATEST="${PROJECT_NAME}-api:latest"
    WEB_IMAGE_LATEST="${PROJECT_NAME}-web:latest"
fi

echo_info "Building Docker images..."
echo_info "API Image: $API_IMAGE"
echo_info "Web Image: $WEB_IMAGE"

# Build API image
echo_info "Building API image..."
docker build -t "$API_IMAGE" -t "$API_IMAGE_LATEST" ./api

# Build Web image
echo_info "Building Web image..."
docker build -t "$WEB_IMAGE" -t "$WEB_IMAGE_LATEST" \
    --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 \
    ./web

echo_info "✅ Images built successfully!"

# Push images if registry is provided
if [ -n "$REGISTRY" ]; then
    echo_info "Pushing images to registry..."
    
    # Push API images
    echo_info "Pushing API image..."
    docker push "$API_IMAGE"
    docker push "$API_IMAGE_LATEST"
    
    # Push Web images
    echo_info "Pushing Web image..."
    docker push "$WEB_IMAGE"
    docker push "$WEB_IMAGE_LATEST"
    
    echo_info "✅ Images pushed successfully!"
    echo_info ""
    echo_info "Images available at:"
    echo_info "  API: $API_IMAGE"
    echo_info "  Web: $WEB_IMAGE"
else
    echo_warn "No registry provided. Images built locally only."
    echo_info ""
    echo_info "Local images:"
    echo_info "  API: $API_IMAGE"
    echo_info "  Web: $WEB_IMAGE"
    echo_info ""
    echo_info "To push to a registry, run:"
    echo_info "  ./scripts/build-images.sh $VERSION your-registry"
fi

echo_info ""
echo_info "🚀 Build complete!"