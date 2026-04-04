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
INSTANCE_TYPE="t3.small"
BASE_AMI="ami-04eaa218f1349d88b"  # Ubuntu 22.04 LTS
AMI_NAME="e8-compression-worker-$(date +%Y%m%d%H%M)"
KEY_NAME="e8-ami-builder-key"
KEY_FILE="$HOME/.ssh/${KEY_NAME}.pem"
SECURITY_GROUP_NAME="e8-ami-builder-sg"

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

# Step 0: Create key pair if it doesn't exist
echo "Step 0: Setting up SSH key pair..."
if [ ! -f "$KEY_FILE" ]; then
    # Delete existing key pair in AWS if any
    aws ec2 delete-key-pair --key-name "$KEY_NAME" --region "$REGION" 2>/dev/null || true
    
    # Create new key pair
    aws ec2 create-key-pair \
        --key-name "$KEY_NAME" \
        --region "$REGION" \
        --query 'KeyMaterial' \
        --output text > "$KEY_FILE"
    chmod 400 "$KEY_FILE"
    echo "Created key pair: $KEY_FILE"
else
    echo "Using existing key: $KEY_FILE"
fi

# Create security group for SSH access
echo "Setting up security group..."
SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=$SECURITY_GROUP_NAME" \
    --region "$REGION" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null || echo "None")

if [ "$SG_ID" == "None" ] || [ -z "$SG_ID" ]; then
    SG_ID=$(aws ec2 create-security-group \
        --group-name "$SECURITY_GROUP_NAME" \
        --description "Temporary SG for AMI builder SSH access" \
        --region "$REGION" \
        --query 'GroupId' \
        --output text)
    
    # Allow SSH from anywhere (temporary, will be deleted)
    aws ec2 authorize-security-group-ingress \
        --group-id "$SG_ID" \
        --protocol tcp \
        --port 22 \
        --cidr 0.0.0.0/0 \
        --region "$REGION"
    echo "Created security group: $SG_ID"
else
    echo "Using existing security group: $SG_ID"
fi

echo ""
echo "Step 1: Launching temporary instance..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$BASE_AMI" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SG_ID" \
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
# Wait for SSH to be ready
for i in {1..30}; do
    if ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no -o ConnectTimeout=5 ubuntu@"$PUBLIC_IP" "echo SSH ready" 2>/dev/null; then
        echo "SSH is ready!"
        break
    fi
    echo "  Waiting for SSH... ($i/30)"
    sleep 10
done

echo ""
echo "Step 3: Installing dependencies via SSH..."
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no ubuntu@"$PUBLIC_IP" << 'EOF'
    set -e
    echo "Updating packages..."
    sudo apt-get update
    
    echo "Installing FFmpeg..."
    sudo apt-get install -y ffmpeg
    
    echo "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt-get install -y nodejs
    
    echo "Installing PM2..."
    sudo npm install -g pm2
    
    echo "Creating worker directory..."
    sudo mkdir -p /opt/compression-worker
    sudo chown ubuntu:ubuntu /opt/compression-worker
    
    echo "Verifying installations..."
    ffmpeg -version | head -1
    node --version
    pm2 --version
    
    echo "Done!"
EOF

echo ""
echo "Step 4: Creating AMI..."
AMI_ID=$(aws ec2 create-image \
    --instance-id "$INSTANCE_ID" \
    --name "$AMI_NAME" \
    --description "E8 Productions Video Compression Worker" \
    --region "$REGION" \
    --query 'ImageId' \
    --output text)

echo "AMI ID: $AMI_ID"
echo "Waiting for AMI to be available (this may take 5-10 minutes)..."
aws ec2 wait image-available --image-ids "$AMI_ID" --region "$REGION"

echo ""
echo "Step 5: Cleaning up..."
echo "Terminating temporary instance..."
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