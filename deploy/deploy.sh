#!/bin/bash

# AWS EC2 Deployment Script for WNDR Dashboard
# Usage: ./deploy.sh

set -e

echo "🚀 Starting deployment to AWS EC2..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root directory (parent of deploy folder)
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load environment variables from .env file in deploy folder
if [ -f "${SCRIPT_DIR}/.env" ]; then
    echo "Loading environment variables from ${SCRIPT_DIR}/.env"
    export $(grep -v '^#' "${SCRIPT_DIR}/.env" | xargs)
else
    echo "Warning: .env file not found in ${SCRIPT_DIR}"
fi

# Configuration
EC2_HOST="${EC2_HOST}"
EC2_USER="${EC2_USER:-ubuntu}"
KEY_PATH="${SCRIPT_DIR}/${KEY_PATH}"
APP_DIR="/home/ubuntu/wndr-dashboard"

# Change to project root for rsync and file operations
cd "${PROJECT_ROOT}"

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

# Check if required environment variables are set
if [ -z "$EC2_HOST" ]; then
    echo_error "EC2_HOST environment variable is required"
    echo "Example: export EC2_HOST='3.80.123.45'"
    exit 1
fi

if [ -z "$KEY_PATH" ]; then
    echo_error "KEY_PATH environment variable is required"
    echo "Example: export KEY_PATH='~/.ssh/my-key.pem'"
    exit 1
fi

if [ -z "$AWS_S3_BUCKET" ] || [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo_error "Missing required AWS environment variables. Please set:"
    echo "  - AWS_S3_BUCKET"
    echo "  - AWS_ACCESS_KEY_ID"
    echo "  - AWS_SECRET_ACCESS_KEY"
    exit 1
fi

# Test SSH connection
echo_info "Testing SSH connection..."
if ! ssh -i ${KEY_PATH} -o ConnectTimeout=10 ${EC2_USER}@${EC2_HOST} "echo 'SSH connection successful'"; then
    echo_error "Failed to connect to EC2 instance. Check your KEY_PATH and EC2_HOST."
    exit 1
fi

# Create .env file for production
echo_info "Creating production environment file..."
cat > "${PROJECT_ROOT}/.env.prod" << EOF
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
AWS_S3_BUCKET=${AWS_S3_BUCKET}
REPORTS_STORAGE=${REPORTS_STORAGE:-s3}
CORS_ORIGIN=${CORS_ORIGIN:-*}
ADMIN_TOKEN=${ADMIN_TOKEN:-$(openssl rand -hex 32)}
NEXT_PUBLIC_API_BASE_URL=http://${EC2_HOST}:4000
EOF

echo_info "Syncing files to EC2 instance..."
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '.next' --exclude 'api/dev.db' \
    -e "ssh -i ${KEY_PATH}" \
    ./ ${EC2_USER}@${EC2_HOST}:${APP_DIR}/

echo_info "Copying environment file..."
scp -i ${KEY_PATH} "${PROJECT_ROOT}/.env.prod" ${EC2_USER}@${EC2_HOST}:${APP_DIR}/.env

echo_info "Running deployment commands on EC2..."
ssh -i ${KEY_PATH} ${EC2_USER}@${EC2_HOST} << 'ENDSSH'
    cd /home/ubuntu/wndr-dashboard
    
    # Stop existing containers
    docker-compose -f docker-compose.prod.yml down || true
    
    # Build and start new containers
    docker-compose -f docker-compose.prod.yml up --build -d
    
    # Wait a moment for containers to start
    sleep 10
    
    # Show status
    echo "Container status:"
    docker-compose -f docker-compose.prod.yml ps
    
    # Test API health
    echo "Testing API health..."
    curl -f http://localhost:4000/health || echo "API health check failed"
ENDSSH

echo_info "Cleaning up local files..."
rm -f "${PROJECT_ROOT}/.env.prod"

echo_info "✅ Deployment completed!"
echo_info "Your app should be available at:"
echo_info "  Frontend: http://${EC2_HOST}:3000"
echo_info "  API: http://${EC2_HOST}:4000"
echo_info "  Health Check: http://${EC2_HOST}:4000/health"

echo_warn "Note: Make sure your EC2 security group allows inbound traffic on ports 3000 and 4000"