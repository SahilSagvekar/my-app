#!/bin/bash

# ==============================================================================
# YouTube Analytics Backend Testing Script
# ==============================================================================
# This script helps you test all YouTube Analytics endpoints
# ==============================================================================

echo "=================================="
echo "YouTube Analytics Backend Testing"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="http://localhost:3000"
CRON_SECRET="${CRON_SECRET}"

# Function to print section header
print_header() {
    echo ""
    echo "=================================="
    echo "$1"
    echo "=================================="
    echo ""
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to print info
print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# ==============================================================================
# Test 1: Check if server is running
# ==============================================================================
print_header "Test 1: Server Health Check"

HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health")

if [ "$HEALTH_CHECK" = "200" ]; then
    print_success "Server is running on $API_URL"
else
    print_error "Server is not responding. Please start the dev server with 'npm run dev'"
    exit 1
fi

# ==============================================================================
# Test 2: Check Database Connection
# ==============================================================================
print_header "Test 2: Database Connection"

print_info "Checking for YouTube channels in database..."
echo "Run this SQL query in your database:"
echo ""
echo "SELECT id, clientId, channelId, channelTitle, subscriberCount, lastSyncedAt, syncStatus"
echo "FROM \"YouTubeChannel\""
echo "WHERE isActive = true;"
echo ""
read -p "Press Enter after checking the database..."

read -p "How many active YouTube channels do you have? " CHANNEL_COUNT

if [ "$CHANNEL_COUNT" -gt 0 ]; then
    print_success "Found $CHANNEL_COUNT active YouTube channel(s)"
    read -p "Enter a clientId to test with: " TEST_CLIENT_ID
else
    print_error "No YouTube channels found. Please connect a YouTube account first."
    print_info "Go to your client dashboard and connect YouTube via OAuth"
    exit 1
fi

# ==============================================================================
# Test 3: Manual Sync via Script
# ==============================================================================
print_header "Test 3: Manual Sync via Script"

print_info "Testing cron script..."
if [ -f "./scripts/cron-master.sh" ]; then
    print_info "Running: ./scripts/cron-master.sh youtube"
    ./scripts/cron-master.sh youtube
    
    if [ $? -eq 0 ]; then
        print_success "Cron script executed successfully"
    else
        print_error "Cron script failed"
    fi
else
    print_error "Cron script not found at ./scripts/cron-master.sh"
fi

echo ""
read -p "Did the sync complete successfully? (y/n) " SYNC_SUCCESS

if [ "$SYNC_SUCCESS" != "y" ]; then
    print_error "Sync failed. Check logs for errors."
    exit 1
fi

# ==============================================================================
# Test 4: Check YouTubeSnapshot Table
# ==============================================================================
print_header "Test 4: Check YouTubeSnapshot Data"

print_info "Checking for snapshot data in database..."
echo "Run this SQL query:"
echo ""
echo "SELECT clientId, subscriberCount, views, watchTimeHours, estimatedRevenue, snapshotDate"
echo "FROM \"YouTubeSnapshot\""
echo "WHERE clientId = '$TEST_CLIENT_ID'"
echo "ORDER BY snapshotDate DESC"
echo "LIMIT 5;"
echo ""
read -p "Press Enter after checking the database..."

read -p "Do you see snapshot data? (y/n) " HAS_SNAPSHOTS

if [ "$HAS_SNAPSHOTS" != "y" ]; then
    print_error "No snapshot data found. Sync may have failed."
    exit 1
fi

print_success "Snapshot data exists in database"

# ==============================================================================
# Test 5: Test Dashboard Stats API
# ==============================================================================
print_header "Test 5: Dashboard Stats API"

print_info "Testing: GET /api/youtube/dashboard-stats"
print_info "Note: You need to be logged in. Copy your authToken from browser cookies."
echo ""
read -p "Enter your authToken from browser: " AUTH_TOKEN

STATS_RESPONSE=$(curl -s "$API_URL/api/youtube/dashboard-stats?clientId=$TEST_CLIENT_ID&period=28" \
    -H "Cookie: authToken=$AUTH_TOKEN")

echo ""
echo "Response:"
echo "$STATS_RESPONSE" | python -m json.tool 2>/dev/null || echo "$STATS_RESPONSE"
echo ""

if echo "$STATS_RESPONSE" | grep -q "success"; then
    print_success "Dashboard stats API working"
else
    print_error "Dashboard stats API failed"
fi

# ==============================================================================
# Test 6: Test Performance Chart API
# ==============================================================================
print_header "Test 6: Performance Chart API"

print_info "Testing: GET /api/youtube/performance-chart"

CHART_RESPONSE=$(curl -s "$API_URL/api/youtube/performance-chart?clientId=$TEST_CLIENT_ID&metric=views&period=28" \
    -H "Cookie: authToken=$AUTH_TOKEN")

echo ""
echo "Response (first 500 chars):"
echo "$CHART_RESPONSE" | cut -c1-500
echo ""

if echo "$CHART_RESPONSE" | grep -q "success"; then
    print_success "Performance chart API working"
else
    print_error "Performance chart API failed"
fi

# ==============================================================================
# Test 7: Test Admin Clients API (if admin)
# ==============================================================================
print_header "Test 7: Admin Clients API"

read -p "Are you logged in as admin? (y/n) " IS_ADMIN

if [ "$IS_ADMIN" = "y" ]; then
    print_info "Testing: GET /api/youtube/admin/clients"
    
    CLIENTS_RESPONSE=$(curl -s "$API_URL/api/youtube/admin/clients" \
        -H "Cookie: authToken=$AUTH_TOKEN")
    
    echo ""
    echo "Response (first 500 chars):"
    echo "$CLIENTS_RESPONSE" | cut -c1-500
    echo ""
    
    if echo "$CLIENTS_RESPONSE" | grep -q "success"; then
        print_success "Admin clients API working"
    else
        print_error "Admin clients API failed"
    fi
else
    print_info "Skipping admin API test (not logged in as admin)"
fi

# ==============================================================================
# Test 8: Test Manual Sync API
# ==============================================================================
print_header "Test 8: Manual Sync API"

print_info "Testing: POST /api/youtube/manual-sync"
print_info "Note: This has a 5-minute rate limit"

read -p "Do you want to test manual sync? (y/n) " TEST_MANUAL_SYNC

if [ "$TEST_MANUAL_SYNC" = "y" ]; then
    SYNC_RESPONSE=$(curl -s -X POST "$API_URL/api/youtube/manual-sync" \
        -H "Content-Type: application/json" \
        -H "Cookie: authToken=$AUTH_TOKEN" \
        -d "{\"clientId\":\"$TEST_CLIENT_ID\"}")
    
    echo ""
    echo "Response:"
    echo "$SYNC_RESPONSE" | python -m json.tool 2>/dev/null || echo "$SYNC_RESPONSE"
    echo ""
    
    if echo "$SYNC_RESPONSE" | grep -q "success"; then
        print_success "Manual sync API working"
    elif echo "$SYNC_RESPONSE" | grep -q "wait"; then
        print_info "Rate limited (expected if you just synced)"
    else
        print_error "Manual sync API failed"
    fi
else
    print_info "Skipping manual sync test"
fi

# ==============================================================================
# Test 9: Test Cron Endpoint
# ==============================================================================
print_header "Test 9: Cron Endpoint"

if [ -z "$CRON_SECRET" ]; then
    print_error "CRON_SECRET not set in environment"
    print_info "Set it in your .env file"
else
    print_info "Testing: POST /api/cron/youtube-sync"
    
    CRON_RESPONSE=$(curl -s -X POST "$API_URL/api/cron/youtube-sync" \
        -H "Authorization: Bearer $CRON_SECRET")
    
    echo ""
    echo "Response:"
    echo "$CRON_RESPONSE" | python -m json.tool 2>/dev/null || echo "$CRON_RESPONSE"
    echo ""
    
    if echo "$CRON_RESPONSE" | grep -q "success"; then
        print_success "Cron endpoint working"
    else
        print_error "Cron endpoint failed"
    fi
fi

# ==============================================================================
# Summary
# ==============================================================================
print_header "Testing Summary"

echo "✓ Tests completed!"
echo ""
echo "Next steps:"
echo "1. Review the test results above"
echo "2. If all tests passed, backend is ready!"
echo "3. If any tests failed, check the error messages"
echo "4. Check logs/cron.log for detailed error messages"
echo ""
echo "Once all tests pass, we can proceed to build the UI!"
echo ""
