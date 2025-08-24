# AWS Setup Guide

## 1. Create S3 Bucket

1. Go to AWS S3 Console
2. Click "Create bucket"
3. Bucket name: `wndr-dashboard-reports-[your-unique-suffix]`
4. Region: Choose your preferred region (e.g., us-east-1)
5. Block all public access: ✅ Keep enabled (we'll use signed URLs)
6. Create bucket

## 2. Create IAM User for Application

1. Go to AWS IAM Console
2. Click "Users" → "Create user"
3. Username: `wndr-dashboard-app`
4. Attach policies directly:
   - Create custom policy with this JSON:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME"
        }
    ]
}
```

5. Create access keys and save them securely

## 3. Launch EC2 Instance

1. Go to AWS EC2 Console
2. Click "Launch Instance"
3. Choose AMI: Ubuntu Server 22.04 LTS
4. Instance type: t3.medium (2 vCPU, 4 GB RAM) - good for moderate load
5. Key pair: Create new or use existing
6. Security Group:
   - SSH (22): Your IP
   - HTTP (80): 0.0.0.0/0
   - Custom TCP (3000): 0.0.0.0/0 (Frontend)
   - Custom TCP (4000): 0.0.0.0/0 (API)
7. Storage: 20 GB gp3
8. Launch instance

## 4. Connect to EC2 Instance

```bash
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

## 5. Install Docker on EC2

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install -y docker.io docker-compose

# Add user to docker group
sudo usermod -aG docker ubuntu

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Logout and login again for group changes to take effect
exit
```

## 6. Set Environment Variables

Create these environment variables on your local machine before deploying:

```bash
export EC2_HOST="your-ec2-public-ip-or-domain"
export EC2_USER="ubuntu"
export KEY_PATH="path/to/your-key.pem"
export AWS_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_S3_BUCKET="your-bucket-name"
export ADMIN_TOKEN="your-secure-admin-token"
```