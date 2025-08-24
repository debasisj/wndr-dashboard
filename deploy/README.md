# WNDR Dashboard - AWS EC2 Deployment Guide

## Prerequisites

1. **AWS Account** with access to EC2 and S3
2. **AWS CLI** installed (optional but recommended)
3. **SSH key pair** for EC2 access
4. **Local machine** with Docker and rsync

## Step 1: AWS Setup

### 1.1 Create S3 Bucket
```bash
# Using AWS CLI (or use AWS Console)
aws s3 mb s3://wndr-dashboard-reports-$(date +%s)
```

### 1.2 Create IAM User
1. Go to AWS IAM Console
2. Create user: `wndr-dashboard-app`
3. Attach this policy:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::YOUR_BUCKET_NAME",
                "arn:aws:s3:::YOUR_BUCKET_NAME/*"
            ]
        }
    ]
}
```
4. Create access keys and save them

### 1.3 Launch EC2 Instance
1. **AMI**: Ubuntu Server 22.04 LTS
2. **Instance Type**: t3.medium (2 vCPU, 4 GB RAM)
3. **Security Group**: Allow ports 22 (SSH), 80 (HTTP), 3000, 4000
4. **Storage**: 20 GB gp3
5. **Key Pair**: Use existing or create new

## Step 2: Prepare EC2 Instance

### 2.1 Connect to EC2
```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

### 2.2 Install Docker
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install -y docker.io docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker ubuntu

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Logout and login again
exit
```

## Step 3: Deploy Application

### 3.1 Set Environment Variables (on your local machine)
```bash
# Required variables
export EC2_HOST="YOUR_EC2_PUBLIC_IP"
export KEY_PATH="path/to/your-key.pem"
export AWS_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_S3_BUCKET="your-bucket-name"

# Optional variables
export EC2_USER="ubuntu"
export ADMIN_TOKEN="your-secure-token"
export CORS_ORIGIN="*"
```

### 3.2 Make Deploy Script Executable
```bash
chmod +x deploy/deploy.sh
```

### 3.3 Run Deployment
```bash
./deploy/deploy.sh
```

## Step 4: Verify Deployment

### 4.1 Check Application Status
```bash
# Frontend
curl http://YOUR_EC2_PUBLIC_IP:3000

# API Health
curl http://YOUR_EC2_PUBLIC_IP:4000/health

# API Runs endpoint
curl http://YOUR_EC2_PUBLIC_IP:4000/api/v1/runs
```

### 4.2 Check Container Logs
```bash
# SSH to EC2 and check logs
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP

cd /home/ubuntu/wndr-dashboard
docker-compose -f docker-compose.prod.yml logs api
docker-compose -f docker-compose.prod.yml logs web
```

## Step 5: Domain Setup (Optional)

### 5.1 Point Domain to EC2
1. Update your domain's A record to point to EC2 public IP
2. Update environment variables:
```bash
export EC2_HOST="yourdomain.com"
export CORS_ORIGIN="https://yourdomain.com"
```

### 5.2 Setup SSL with Nginx (Recommended)
```bash
# Install Nginx
sudo apt install nginx certbot python3-certbot-nginx

# Configure Nginx reverse proxy
sudo nano /etc/nginx/sites-available/wndr-dashboard

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com
```

## Troubleshooting

### Common Issues

1. **Permission denied (SSH)**
   ```bash
   chmod 400 your-key.pem
   ```

2. **Docker permission denied**
   ```bash
   # On EC2 instance
   sudo usermod -aG docker ubuntu
   # Then logout and login again
   ```

3. **Port not accessible**
   - Check EC2 Security Group allows inbound traffic on ports 3000, 4000
   - Check if containers are running: `docker-compose ps`

4. **S3 access denied**
   - Verify IAM user has correct permissions
   - Check AWS credentials are correct
   - Verify bucket name matches

### Useful Commands

```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Update deployment
./deploy/deploy.sh
```

## Cost Estimation

- **EC2 t3.medium**: ~$30/month
- **S3 Storage**: ~$0.023/GB/month
- **Data Transfer**: First 1GB free, then ~$0.09/GB

Total estimated cost: ~$35-50/month depending on usage.