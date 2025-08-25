# WNDR Dashboard - Docker Deployment Guide

This guide explains how to deploy the WNDR Dashboard using Docker images for easy distribution and deployment.

## Overview

The application consists of two Docker images:
- **API**: Node.js backend with Prisma ORM and SQLite database
- **Web**: Next.js frontend application

## Quick Start

### 1. Build and Push Images

```bash
# Build and push to debasisj Docker Hub registry (default)
./scripts/build-images.sh latest

# Build specific version
./scripts/build-images.sh v1.0.0

# Build with specific environment file for production
./scripts/build-images.sh latest debasisj .env.production
```

**Note**: Images are automatically pushed to the `debasisj` Docker Hub registry. Only maintainers with access can push new images.

**Important**: When building for production deployment, always provide the environment file as the third parameter to ensure the web image is built with the correct `NEXT_PUBLIC_API_BASE_URL`.

### 2. Deploy Locally

```bash
# Create environment file
cp .env.deploy.template .env.deploy
# Edit .env.deploy with your configuration
# REGISTRY is pre-configured to use debasisj/ Docker Hub registry

# Deploy using Docker Compose (pulls images from Docker Hub)
./scripts/deploy-docker.sh .env.deploy
```

### 3. Deploy to EC2

```bash
# Create environment file for production
cp .env.deploy.template .env.production
# Edit .env.production with production settings:
# - Set NEXT_PUBLIC_API_BASE_URL=http://your-ec2-ip:4000
# - REGISTRY is pre-configured to use debasisj/ Docker Hub registry

# Images are automatically pulled from debasisj Docker Hub registry
# No need to build locally - just deploy

# Deploy to EC2
./scripts/deploy-ec2.sh ubuntu@your-ec2-ip ~/.ssh/your-key.pem .env.production
```

**Critical**: The `NEXT_PUBLIC_API_BASE_URL` must be set to your EC2 public IP before building images, as this is a build-time variable in Next.js.

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REGISTRY` | Docker registry URL | - | No |
| `VERSION` | Image version tag | `latest` | No |
| `API_PORT` | API port mapping | `4000` | No |
| `WEB_PORT` | Web port mapping | `3000` | No |
| `NEXT_PUBLIC_API_BASE_URL` | API URL for frontend | `http://localhost:4000` | Yes (build-time) |
| `REPORTS_STORAGE` | Storage type (`local` or `s3`) | `local` | No |
| `AWS_REGION` | AWS region for S3 | - | If using S3 |
| `AWS_ACCESS_KEY_ID` | AWS access key | - | If using S3 |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | - | If using S3 |
| `AWS_S3_BUCKET` | S3 bucket name | - | If using S3 |
| `ADMIN_ENABLED` | Enable admin features | `true` | No |
| `ADMIN_TOKEN` | Admin authentication token | - | If admin enabled |

### Storage Options

#### Local Storage (Default)
```env
REPORTS_STORAGE=local
```
Reports are stored in Docker volumes on the host machine.

#### S3 Storage
```env
REPORTS_STORAGE=s3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
```

## Docker Registry Options

### Docker Hub
```bash
# Images are automatically available from debasisj Docker Hub registry
# No need to build - just configure and deploy

# In .env.deploy/.env.production
REGISTRY=debasisj/
```

### AWS ECR
```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Images are automatically available from debasisj Docker Hub registry
# Configure your environment file with ECR settings if needed

# In .env.deploy/.env.production (if using ECR instead of Docker Hub)
REGISTRY=123456789012.dkr.ecr.us-east-1.amazonaws.com/
```

### Private Registry
```bash
# Images are automatically available from debasisj Docker Hub registry
# Update REGISTRY in your environment file if using a different registry

# In .env.deploy/.env.production (if using custom registry)
REGISTRY=your-registry.com/
```

## Deployment Scenarios

### Development/Testing
```bash
# Local deployment with local storage
cp .env.deploy.template .env.local
# Edit .env.local:
# REGISTRY=debasisj/ (default - pulls from Docker Hub)
# VERSION=latest
# REPORTS_STORAGE=local
# NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

./scripts/deploy-docker.sh .env.local
```

### Production with S3
```bash
# Production deployment with S3 storage
cp .env.deploy.template .env.production
# Edit .env.production:
# REGISTRY=debasisj/
# VERSION=latest
# NEXT_PUBLIC_API_BASE_URL=http://your-ec2-ip:4000  # CRITICAL: Use actual EC2 IP
# REPORTS_STORAGE=s3
# AWS_* variables...

# Images are automatically available from debasisj Docker Hub registry
# Just configure your environment and deploy

# Deploy to EC2
./scripts/deploy-ec2.sh ubuntu@your-ec2-ip ~/.ssh/key.pem .env.production
```

## Management Commands

### View Status
```bash
docker-compose -f docker-compose.deploy.yml ps
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.deploy.yml logs -f

# Specific service
docker-compose -f docker-compose.deploy.yml logs -f api
docker-compose -f docker-compose.deploy.yml logs -f web
```

### Restart Services
```bash
docker-compose -f docker-compose.deploy.yml restart
```

### Stop Services
```bash
docker-compose -f docker-compose.deploy.yml down
```

### Update Images
```bash
# Pull latest images and restart
docker-compose -f docker-compose.deploy.yml pull
docker-compose -f docker-compose.deploy.yml up -d
```

## Troubleshooting

### Common Issues

1. **Connection Refused (Frontend to API)**
   - **Root Cause**: Web image built with wrong `NEXT_PUBLIC_API_BASE_URL`
   - **Solution**: Rebuild images with correct environment file
   ```bash
   # Images are available from debasisj Docker Hub registry
   # Just redeploy with correct environment configuration
   ```
   - Check if ports are open in security groups (EC2)
   - Verify `NEXT_PUBLIC_API_BASE_URL` in environment file matches deployment IP

2. **Port Already in Use**
   - **Solution**: Stop existing containers
   ```bash
   ssh -i key.pem ubuntu@ip 'cd /home/ubuntu/wndr-dashboard-deploy && docker-compose -f docker-compose.deploy.yml down'
   ```

3. **Database Issues**
   - Database is automatically migrated on container start
   - Data persists in Docker volumes

4. **S3 Upload Issues**
   - Verify AWS credentials and permissions
   - Check S3 bucket exists and is accessible

5. **Image Pull Issues**
   - Ensure you're logged into the Docker registry
   - Verify image names and tags are correct
   - Check REGISTRY variable includes trailing slash: `REGISTRY=debasisj/`

### Health Checks

The deployment includes health checks for both services:
- API: `GET /health`
- Web: `GET /` (homepage)

### Logs Location

- Container logs: `docker-compose logs`
- Application logs: Inside containers at `/app/logs` (if configured)

## Important Notes

### Build-Time vs Runtime Variables

- `NEXT_PUBLIC_*` variables are **build-time** variables in Next.js
- They must be set during `docker build`, not just at container runtime
- Images are pre-built and available from `debasisj` Docker Hub registry
- Configure your environment file correctly before deployment
- If you change `NEXT_PUBLIC_API_BASE_URL`, you must rebuild and redeploy

### Registry Configuration

- Always include trailing slash in REGISTRY: `REGISTRY=debasisj/` not `REGISTRY=debasisj`
- This ensures proper image naming: `debasisj/wndr-dashboard-web:latest`

## Security Considerations

1. **Admin Token**: Use a strong, random admin token
2. **AWS Credentials**: Use IAM roles when possible, avoid hardcoding keys
3. **Network**: Configure security groups to restrict access
4. **HTTPS**: Use a reverse proxy (nginx, ALB) for HTTPS in production

## Scaling

For high-traffic deployments:
1. Use a load balancer for multiple web instances
2. Use external database (PostgreSQL, MySQL)
3. Use Redis for session storage
4. Use CDN for static assets