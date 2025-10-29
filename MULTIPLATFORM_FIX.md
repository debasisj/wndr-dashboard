# Quick Fix: ARM64 Platform Issue

## Problem
When trying to pull Docker images on ARM64 (Apple Silicon) Macs:
```
Error: no matching manifest for linux/arm64/v8 in the manifest list entries
```

## Root Cause
The images were built only for the platform they were created on (either ARM64 or AMD64), not for both.

## Solution
Build **multi-platform images** using Docker Buildx that work on both ARM64 and AMD64.

## Quick Steps

### 1. Build Multi-Platform Images

```bash
# One command to build for both platforms and push to Docker Hub
cd /path/to/wndr-dashboard
./scripts/build-multiplatform.sh
```

This creates images that work on:
- ✅ Apple Silicon Macs (ARM64)
- ✅ Intel/AMD Macs (AMD64)  
- ✅ AWS EC2 (AMD64)
- ✅ All cloud platforms

### 2. Verify Multi-Platform Support

```bash
# Check API image
docker buildx imagetools inspect debasisj/wndr-dashboard-api:latest

# Check Web image
docker buildx imagetools inspect debasisj/wndr-dashboard-web:latest
```

You should see both platforms listed:
```
Manifests:
  Platform:  linux/amd64
  Platform:  linux/arm64
```

### 3. Deploy

Now the deployment instructions work on any platform:

```bash
# Download files
curl -O https://raw.githubusercontent.com/debasisj/wndr-dashboard/main/docker-compose.deploy.yml
curl -O https://raw.githubusercontent.com/debasisj/wndr-dashboard/main/.env.deploy.template
curl -LO --create-dirs --output-dir scripts https://raw.githubusercontent.com/debasisj/wndr-dashboard/main/scripts/deploy-docker.sh

# Deploy
cp .env.deploy.template .env.deploy
chmod +x scripts/deploy-docker.sh
./scripts/deploy-docker.sh .env.deploy
```

Docker will automatically pull the correct image for your platform!

## Manual Build (if needed)

If the script doesn't work, you can build manually:

```bash
# Create buildx builder (one-time)
docker buildx create --name multiplatform-builder --use --bootstrap

# Build API for both platforms
cd api
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag debasisj/wndr-dashboard-api:latest \
  --push \
  .

# Build Web for both platforms
cd ../web
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag debasisj/wndr-dashboard-web:latest \
  --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 \
  --push \
  .
```

## Notes

- **Build time:** Multi-platform builds take 5-15 minutes (vs 2-5 for single platform)
- **Size:** Image size is the same - Docker only downloads the platform you need
- **Compatibility:** Works everywhere - AWS, GCP, Azure, local machines

## Next Steps

After rebuilding:
1. Old single-platform images will be replaced
2. Anyone can pull and run on any platform
3. No more "no matching manifest" errors!

For more details, see [DOCKER_HUB_MULTIPLATFORM.md](DOCKER_HUB_MULTIPLATFORM.md)
