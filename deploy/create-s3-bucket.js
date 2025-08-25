#!/usr/bin/env node

const { S3Client, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: __dirname + '/.env' });

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

async function createBucket() {
    const bucketName = process.env.AWS_S3_BUCKET;

    if (!bucketName) {
        console.error('AWS_S3_BUCKET environment variable is required');
        process.exit(1);
    }

    try {
        // Check if bucket already exists
        console.log(`Checking if bucket ${bucketName} exists...`);
        await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        console.log(`✅ Bucket ${bucketName} already exists`);
        return;
    } catch (error) {
        if (error.name !== 'NotFound') {
            console.error('Error checking bucket:', error.message);
            process.exit(1);
        }
    }

    try {
        console.log(`Creating S3 bucket: ${bucketName}`);

        const createParams = {
            Bucket: bucketName,
        };

        // For regions other than us-east-1, we need to specify the location constraint
        if (process.env.AWS_REGION && process.env.AWS_REGION !== 'us-east-1') {
            createParams.CreateBucketConfiguration = {
                LocationConstraint: process.env.AWS_REGION,
            };
        }

        await s3Client.send(new CreateBucketCommand(createParams));
        console.log(`✅ Successfully created S3 bucket: ${bucketName}`);

    } catch (error) {
        console.error('Error creating bucket:', error.message);
        process.exit(1);
    }
}

createBucket();