#!/bin/bash

# Build and push multi-platform Docker images to Docker Hub
# This creates images that work on both ARM64 (Apple Silicon) and AMD64 (Intel) platforms
# Usage: ./scripts/build-multiplatform.sh [version]
# Example: ./scripts/build-multiplatform.sh v1.0.0

set -e

VERSION=${1:-latest}
REGISTRY=${REGISTRY:-debasisj}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

echo_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Create or use existing buildx builder for multi-platform builds
echo_step "Setting up Docker Buildx builder..."
if ! docker buildx inspect multiplatform-builder > /dev/null 2>&1; then
    echo_info "Creating new buildx builder 'multiplatform-builder'..."
    docker buildx create --name multiplatform-builder --use --bootstrap
else
    echo_info "Using existing buildx builder 'multiplatform-builder'..."
    docker buildx use multiplatform-builder
fi

# Verify builder supports required platforms
echo_info "Verifying builder supports linux/amd64 and linux/arm64..."
docker buildx inspect --bootstrap

echo_info ""
echo_info "🚀 Building multi-platform images for version: $VERSION"
echo_info "   Registry: $REGISTRY"
echo_info "   Platforms: linux/amd64, linux/arm64"
echo_info ""

# Build and push API image
echo_step "Building API image for multiple platforms..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${REGISTRY}/wndr-dashboard-api:${VERSION} \
    --tag ${REGISTRY}/wndr-dashboard-api:latest \
    --file ./api/Dockerfile \
    --push \
    ./api

if [ $? -eq 0 ]; then
    echo_info "✅ API image built and pushed successfully!"
else
    echo_error "❌ API image build failed!"
    exit 1
fi

# Build and push Web image
echo_step "Building Web image for multiple platforms..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${REGISTRY}/wndr-dashboard-web:${VERSION} \
    --tag ${REGISTRY}/wndr-dashboard-web:latest \
    --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 \
    --file ./web/Dockerfile \
    --push \
    ./web

if [ $? -eq 0 ]; then
    echo_info "✅ Web image built and pushed successfully!"
else
    echo_error "❌ Web image build failed!"
    exit 1
fi

echo_info ""
echo_info "🎉 Multi-platform build complete!"
echo_info ""
echo_info "Images pushed:"
echo_info "  ${REGISTRY}/wndr-dashboard-api:${VERSION}"
echo_info "  ${REGISTRY}/wndr-dashboard-api:latest"
echo_info "  ${REGISTRY}/wndr-dashboard-web:${VERSION}"
echo_info "  ${REGISTRY}/wndr-dashboard-web:latest"
echo_info ""
echo_info "These images will work on:"
echo_info "  ✅ Apple Silicon Macs (ARM64)"
echo_info "  ✅ Intel/AMD Macs (AMD64)"
echo_info "  ✅ AWS EC2 (AMD64)"
echo_info "  ✅ Most cloud platforms (AMD64)"
echo_info ""
echo_info "To verify the images:"
echo_info "  docker buildx imagetools inspect ${REGISTRY}/wndr-dashboard-api:latest"
echo_info "  docker buildx imagetools inspect ${REGISTRY}/wndr-dashboard-web:latest"
