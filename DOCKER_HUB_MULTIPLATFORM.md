# Multi-Platform Docker Image Deployment

This guide explains how to build and deploy Docker images that work on multiple CPU architectures (ARM64 and AMD64).

## Why Multi-Platform Images?

**Problem:** Docker images built on Apple Silicon Macs (ARM64) won't work on Intel servers (AMD64) and vice versa.

**Solution:** Build multi-platform images using Docker Buildx that contain binaries for both architectures.

## Prerequisites

- Docker Desktop (includes buildx by default)
- Docker Hub account
- Logged in to Docker Hub: `docker login`

## Quick Start

### 1. Build and Push Multi-Platform Images

```bash
# Build for both ARM64 and AMD64 platforms
./scripts/build-multiplatform.sh

# Or build with a specific version tag
./scripts/build-multiplatform.sh v1.0.0
```

This will:
- Create images for both `linux/amd64` (Intel) and `linux/arm64` (Apple Silicon)
- Push both images to Docker Hub as a single manifest
- Tag with both the specified version and `latest`

### 2. Verify the Images

```bash
# Check that both platforms are included
docker buildx imagetools inspect debasisj/wndr-dashboard-api:latest
docker buildx imagetools inspect debasisj/wndr-dashboard-web:latest
```

You should see output like:
```
Name:      debasisj/wndr-dashboard-api:latest
MediaType: application/vnd.oci.image.index.v1+json
Digest:    sha256:abc123...

Manifests:
  Name:      debasisj/wndr-dashboard-api:latest@sha256:xyz789...
  MediaType: application/vnd.oci.image.manifest.v1+json
  Platform:  linux/amd64

  Name:      debasisj/wndr-dashboard-api:latest@sha256:def456...
  MediaType: application/vnd.oci.image.manifest.v1+json
  Platform:  linux/arm64
```

### 3. Deploy Anywhere

Once pushed, the images will automatically pull the correct version for the platform:

```bash
# On Apple Silicon Mac
docker pull debasisj/wndr-dashboard-api:latest  # Gets ARM64 version

# On Intel/AMD server
docker pull debasisj/wndr-dashboard-api:latest  # Gets AMD64 version

# On EC2 (typically AMD64)
docker pull debasisj/wndr-dashboard-api:latest  # Gets AMD64 version
```

## Manual Build (Advanced)

If you prefer to build manually or customize the process:

### Setup Buildx Builder

```bash
# Create a new builder (one-time setup)
docker buildx create --name multiplatform-builder --use --bootstrap

# Verify it supports the platforms you need
docker buildx inspect --bootstrap
```

### Build API Image

```bash
cd api

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag debasisj/wndr-dashboard-api:latest \
  --tag debasisj/wndr-dashboard-api:v1.0.0 \
  --push \
  .
```

### Build Web Image

```bash
cd web

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag debasisj/wndr-dashboard-web:latest \
  --tag debasisj/wndr-dashboard-web:v1.0.0 \
  --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 \
  --push \
  .
```

## Supported Platforms

The images are built for:
- ✅ `linux/amd64` - Intel/AMD processors (most servers, EC2, GCP, Azure)
- ✅ `linux/arm64` - ARM processors (Apple Silicon, AWS Graviton, Raspberry Pi)

## Build Time Considerations

**Important:** Multi-platform builds take longer than single-platform builds because:
- Docker builds for each platform separately
- Cross-compilation or QEMU emulation is used for non-native platforms
- Images are pushed after building all platforms

**Typical build times:**
- Single platform: 2-5 minutes
- Multi-platform: 5-15 minutes (depending on your machine)

## Troubleshooting

### Error: "multiple platforms feature is currently not supported"

**Solution:** Make sure you're using `docker buildx build` not `docker build`:
```bash
docker buildx build --platform linux/amd64,linux/arm64 ...
```

### Error: "no builder available"

**Solution:** Create a buildx builder:
```bash
docker buildx create --name multiplatform-builder --use
docker buildx inspect --bootstrap
```

### Build is very slow

This is normal for multi-platform builds. Docker may be emulating the non-native platform using QEMU.

**Tips to speed up:**
- Use a faster machine
- Build during off-hours
- Consider building only for your primary platform and adding others later
- Use Docker layer caching effectively

### Images are larger than expected

Multi-platform manifest lists don't make images larger. Each platform gets only the image for its architecture. The "manifest list" is just a pointer to the platform-specific images.

## CI/CD Integration

For automated builds (GitHub Actions, GitLab CI, etc.):

```yaml
# Example GitHub Actions workflow
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v2

- name: Login to Docker Hub
  uses: docker/login-action@v2
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}

- name: Build and push
  uses: docker/build-push-action@v4
  with:
    context: ./api
    platforms: linux/amd64,linux/arm64
    push: true
    tags: |
      debasisj/wndr-dashboard-api:latest
      debasisj/wndr-dashboard-api:${{ github.sha }}
```

## Local Testing

After building multi-platform images, you can test them locally:

```bash
# Pull the image (gets the right platform automatically)
docker pull debasisj/wndr-dashboard-api:latest

# Run locally
docker-compose -f docker-compose.deploy.yml up -d
```

## Best Practices

1. **Always tag with both version and latest:**
   - Allows users to pin to specific versions
   - Provides a rolling `latest` for easy updates

2. **Test on both platforms if possible:**
   - Use EC2 (AMD64) for production testing
   - Use local Mac (ARM64) for development testing

3. **Document platform requirements:**
   - Be clear about which platforms are supported
   - Update README with architecture information

4. **Use consistent base images:**
   - `node:20-alpine` works on both platforms
   - Avoid platform-specific base images

5. **Monitor build times:**
   - Multi-platform builds are slower
   - Consider building on schedule vs. every commit

## Resources

- [Docker Buildx Documentation](https://docs.docker.com/buildx/working-with-buildx/)
- [Multi-platform Images Guide](https://docs.docker.com/build/building/multi-platform/)
- [Docker Hub Multi-arch](https://www.docker.com/blog/multi-arch-build-and-images-the-simple-way/)
