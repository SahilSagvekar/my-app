#!/bin/bash
#
# Setup Spot AMI for Video Compression
# Run this ONCE to create an AMI that the spot instances will use
#
# Usage: ./setup-spot-ami.sh
#

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  E8 Productions - Spot AMI Setup"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Configuration
REGION="${AWS_REGION:-us-east-1}"
INSTANCE_TYPE="t3.small"  # Small instance for setup
BASE_AMI="ami-0c7217cdde317cfec"  # Ubuntu 22.04 LTS (update for your region)
AMI_NAME="e8-compression-worker-$(date +%Y%m%d)"

echo "Region: $REGION"
echo "Base AMI: $BASE_AMI"
echo "Output AMI Name: $AMI_NAME"
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI not installed"
    exit 1
fi

# Check credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "Error: AWS credentials not configured"
    exit 1
fi

echo "Step 1: Launching temporary instance..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$BASE_AMI" \
    --instance-type "$INSTANCE_TYPE" \
    --region "$REGION" \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=AMI-Builder-Temp}]' \
    --query 'Instances[0].InstanceId' \
    --output text)

echo "Instance ID: $INSTANCE_ID"
echo "Waiting for instance to be running..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --region "$REGION" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo "Instance IP: $PUBLIC_IP"
echo ""
echo "Step 2: Waiting for SSH to be available..."
sleep 60

echo "Step 3: Installing dependencies via SSM..."
# Use SSM instead of SSH for easier access
aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --region "$REGION" \
    --parameters 'commands=[
        "apt-get update",
        "apt-get install -y ffmpeg",
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
        "npm install -g pm2",
        "mkdir -p /opt/compression-worker",
        "echo Done!"
    ]' \
    --output text

echo "Waiting for installation to complete..."
sleep 120

echo "Step 4: Creating AMI..."
AMI_ID=$(aws ec2 create-image \
    --instance-id "$INSTANCE_ID" \
    --name "$AMI_NAME" \
    --description "E8 Productions Video Compression Worker" \
    --region "$REGION" \
    --query 'ImageId' \
    --output text)

echo "AMI ID: $AMI_ID"
echo "Waiting for AMI to be available..."
aws ec2 wait image-available --image-ids "$AMI_ID" --region "$REGION"

echo "Step 5: Cleaning up temporary instance..."
aws ec2 terminate-instances --instance-ids "$INSTANCE_ID" --region "$REGION"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Setup Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "AMI ID: $AMI_ID"
echo ""
echo "Add this to your .env.local:"
echo ""
echo "  COMPRESSION_AMI_ID=$AMI_ID"
echo ""
echo "═══════════════════════════════════════════════════════════"