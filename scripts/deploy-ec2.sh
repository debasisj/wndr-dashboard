#!/bin/bash

# Deploy to EC2 instance using Docker images
# Usage: ./scripts/deploy-ec2.sh [host] [key-path] [environment-file]
# Example: ./scripts/deploy-ec2.sh ubuntu@3.27.131.191 ~/.ssh/my-key.pem .env.deploy

set -e

HOST=${1:-}
KEY_PATH=${2:-}
ENV_FILE=${3:-.env.deploy}

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

# Validate inputs
if [ -z "$HOST" ] || [ -z "$KEY_PATH" ]; then
    echo_error "Usage: $0 <host> <key-path> [environment-file]"
    echo_info "Example: $0 ubuntu@3.27.131.191 ~/.ssh/my-key.pem .env.deploy"
    exit 1
fi

if [ ! -f "$KEY_PATH" ]; then
    echo_error "SSH key file '$KEY_PATH' not found!"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo_error "Environment file '$ENV_FILE' not found!"
    echo_info "Please create it from the template:"
    echo_info "  cp .env.deploy.template $ENV_FILE"
    exit 1
fi

echo_info "🚀 Deploying to EC2 instance: $HOST"

# Test SSH connection
echo_info "Testing SSH connection..."
if ! ssh -i "$KEY_PATH" -o ConnectTimeout=10 "$HOST" "echo 'SSH connection successful'"; then
    echo_error "SSH connection failed!"
    exit 1
fi

# Create deployment directory on EC2
DEPLOY_DIR="/home/ubuntu/wndr-dashboard-deploy"
echo_info "Creating deployment directory..."
ssh -i "$KEY_PATH" "$HOST" "mkdir -p $DEPLOY_DIR"

# Copy deployment files
echo_info "Copying deployment files..."
scp -i "$KEY_PATH" docker-compose.deploy.yml "$HOST:$DEPLOY_DIR/"
scp -i "$KEY_PATH" "$ENV_FILE" "$HOST:$DEPLOY_DIR/.env"
scp -i "$KEY_PATH" scripts/deploy-docker.sh "$HOST:$DEPLOY_DIR/"

# Install Docker and Docker Compose if needed
echo_info "Ensuring Docker is installed..."
ssh -i "$KEY_PATH" "$HOST" << 'EOF'
# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y docker.io
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi
EOF

# Run deployment on EC2
echo_info "Running deployment on EC2..."
ssh -i "$KEY_PATH" "$HOST" << EOF
cd $DEPLOY_DIR
chmod +x deploy-docker.sh
./deploy-docker.sh .env
EOF

echo_info ""
echo_info "🎉 EC2 deployment complete!"
echo_info ""
echo_info "Your application should be available at:"
# Extract host IP from HOST variable
HOST_IP=$(echo "$HOST" | cut -d'@' -f2)
echo_info "  Web: http://$HOST_IP:3000"
echo_info "  API: http://$HOST_IP:4000"
echo_info ""
echo_info "To check status:"
echo_info "  ssh -i $KEY_PATH $HOST 'cd $DEPLOY_DIR && docker-compose -f docker-compose.deploy.yml ps'"
echo_info ""
echo_info "To view logs:"
echo_info "  ssh -i $KEY_PATH $HOST 'cd $DEPLOY_DIR && docker-compose -f docker-compose.deploy.yml logs -f'"