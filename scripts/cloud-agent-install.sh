#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

"$(dirname "$0")/cloud-agent-start.sh"

if [ ! -f .env ]; then
  cat > .env <<'EOF'
DATABASE_URL="postgresql://e8dev:e8dev@localhost:5432/e8dev"
AUTH_SECRET="dev-auth-secret-change-in-production"
NEXTAUTH_SECRET="dev-auth-secret-change-in-production"
JWT_SECRET="dev-jwt-secret-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
MASTER_PASSWORD="dev-master-password"
MASTER_OTP="000000"
GOOGLE_CLIENT_ID="disabled"
GOOGLE_CLIENT_SECRET="disabled"
SLACK_CLIENT_ID="disabled"
SLACK_CLIENT_SECRET="disabled"
NODE_ENV="development"
EOF
fi

npm ci
npx prisma db push --accept-data-loss
npx tsx prisma/seed.ts
