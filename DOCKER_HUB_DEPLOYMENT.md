# WNDR Dashboard - Docker Hub Deployment

This guide shows how to deploy WNDR Dashboard using pre-built images from Docker Hub registry `debasisj`.

## Quick Deployment

### Local Deployment

```bash
# 1. Create environment file
cp .env.deploy.template .env.deploy

# 2. Deploy (automatically pulls from debasisj Docker Hub)
./scripts/deploy-docker.sh .env.deploy
```

### EC2 Deployment

```bash
# 1. Create production environment file
cp .env.deploy.template .env.production

# 2. Edit .env.production:
# - Set NEXT_PUBLIC_API_BASE_URL=http://YOUR_EC2_IP:4000
# - REGISTRY=debasisj/ (already configured)

# 3. Deploy to EC2
./scripts/deploy-ec2.sh ubuntu@YOUR_EC2_IP ~/.ssh/your-key.pem .env.production
```

## Available Images

The following images are available on Docker Hub under the `debasisj` registry:

- `debasisj/wndr-dashboard-api:latest` - Backend API
- `debasisj/wndr-dashboard-web:latest` - Frontend Web App

## Configuration

All deployment scripts are pre-configured to use the `debasisj` Docker Hub registry:

- `docker-compose.deploy.yml` - Uses `debasisj/` as default registry
- `.env.deploy.template` - Pre-configured with `REGISTRY=debasisj/`
- `scripts/build-images.sh` - Defaults to `debasisj` registry

## No Build Required

Users don't need to build images locally. The deployment process automatically:

1. Pulls the latest images from `debasisj` Docker Hub registry
2. Starts the containers with your configuration
3. Sets up networking and volumes

## For Maintainers Only

To build and push new images to the `debasisj` registry:

```bash
# Build and push latest version
./scripts/build-images.sh

# Build and push specific version
./scripts/build-images.sh v1.2.0

# Build with production environment
./scripts/build-images.sh latest debasisj .env.production
```

**Note**: You need Docker Hub access to the `debasisj` account to push images.