# WNDR Dashboard - Docker Deployment Guide

This guide explains how to deploy the WNDR Dashboard using Docker images for easy distribution and deployment.

## Overview

The application consists of two Docker images:
- **API**: Node.js backend with Prisma ORM and SQLite database
- **Web**: Next.js frontend application

## Quick Start

### 1. Build and Push Images

```bash
# Build images locally
./scripts/build-images.sh v1.0.0

# Build and push to Docker Hub
./scripts/build-images.sh v1.0.0 your-dockerhub-username

# Build and push to AWS ECR
./scripts/build-images.sh v1.0.0 123456789012.dkr.ecr.us-east-1.amazonaws.com
```

### 2. Deploy Locally

```bash
# Create environment file
cp .env.deploy.template .env.deploy
# Edit .env.deploy with your configuration

# Deploy using Docker Compose
./scripts/deploy-docker.sh .env.deploy
```

### 3. Deploy to EC2

```bash
# Create environment file for production
cp .env.deploy.template .env.production
# Edit .env.production with production settings

# Deploy to EC2
./scripts/deploy-ec2.sh ubuntu@your-ec2-ip ~/.ssh/your-key.pem .env.production
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REGISTRY` | Docker registry URL | - | No |
| `VERSION` | Image version tag | `latest` | No |
| `API_PORT` | API port mapping | `4000` | No |
| `WEB_PORT` | Web port mapping | `3000` | No |
| `NEXT_PUBLIC_API_BASE_URL` | API URL for frontend | `http://localhost:4000` | Yes |
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
# Build and push
./scripts/build-images.sh v1.0.0 your-username

# In .env.deploy
REGISTRY=your-username
```

### AWS ECR
```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Build and push
./scripts/build-images.sh v1.0.0 123456789012.dkr.ecr.us-east-1.amazonaws.com

# In .env.deploy
REGISTRY=123456789012.dkr.ecr.us-east-1.amazonaws.com
```

### Private Registry
```bash
# Build and push
./scripts/build-images.sh v1.0.0 your-registry.com

# In .env.deploy
REGISTRY=your-registry.com
```

## Deployment Scenarios

### Development/Testing
```bash
# Local deployment with local storage
cp .env.deploy.template .env.local
# Edit .env.local:
# REGISTRY=your-username
# VERSION=latest
# REPORTS_STORAGE=local

./scripts/deploy-docker.sh .env.local
```

### Production with S3
```bash
# Production deployment with S3 storage
cp .env.deploy.template .env.production
# Edit .env.production:
# REGISTRY=your-username
# VERSION=v1.0.0
# NEXT_PUBLIC_API_BASE_URL=http://your-domain.com:4000
# REPORTS_STORAGE=s3
# AWS_* variables...

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

1. **Connection Refused**
   - Check if ports are open in security groups (EC2)
   - Verify `NEXT_PUBLIC_API_BASE_URL` matches your deployment

2. **Database Issues**
   - Database is automatically migrated on container start
   - Data persists in Docker volumes

3. **S3 Upload Issues**
   - Verify AWS credentials and permissions
   - Check S3 bucket exists and is accessible

4. **Image Pull Issues**
   - Ensure you're logged into the Docker registry
   - Verify image names and tags are correct

### Health Checks

The deployment includes health checks for both services:
- API: `GET /health`
- Web: `GET /` (homepage)

### Logs Location

- Container logs: `docker-compose logs`
- Application logs: Inside containers at `/app/logs` (if configured)

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