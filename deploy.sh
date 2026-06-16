#!/bin/bash
# deploy.sh — place this in /var/www/e8-app/
# Usage: ./deploy.sh
# Make executable: chmod +x deploy.sh

set -e  # exit on any error

APP_DIR="/var/www/e8-app"
MAINTENANCE_FLAG="$APP_DIR/.maintenance"

echo "🚀 Starting deploy at $(date '+%H:%M:%S')"

# ── 1. Enable maintenance mode ────────────────────────────────────
echo "🔧 Enabling maintenance mode..."
touch "$MAINTENANCE_FLAG"
echo "   ✅ Maintenance page is live"

# ── 2. Pull latest code ───────────────────────────────────────────
echo "📥 Pulling latest code..."
git pull origin main
echo "   ✅ Code updated"

# ── 3. Install dependencies (only if package.json changed) ────────
if git diff HEAD@{1} HEAD --name-only 2>/dev/null | grep -q "package.json\|package-lock.json"; then
  echo "📦 Installing new dependencies..."
  npm install
  echo "   ✅ Dependencies installed"
else
  echo "📦 No dependency changes — skipping npm install"
fi

# ── 4. Build ──────────────────────────────────────────────────────
echo "🔨 Building app..."
npm run build
echo "   ✅ Build complete"

# ── 5. Restart PM2 ───────────────────────────────────────────────
echo "♻️  Restarting app..."
pm2 restart e8-app
sleep 3  # give it a moment to boot

echo "   ✅ App restarted"

# ── 6. Disable maintenance mode ───────────────────────────────────
echo "✅ Disabling maintenance mode..."
rm -f "$MAINTENANCE_FLAG"
echo "   ✅ App is live"

echo ""
echo "🎉 Deploy complete at $(date '+%H:%M:%S')"