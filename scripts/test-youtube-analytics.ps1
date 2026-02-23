# YouTube Analytics Backend Testing Script (PowerShell)
# Run this script to test all YouTube Analytics endpoints

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "YouTube Analytics Backend Testing" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$API_URL = "http://localhost:3000"
$CRON_SECRET = $env:CRON_SECRET

function Print-Header {
    param($Message)
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Print-Success {
    param($Message)
    Write-Host "Success: $Message" -ForegroundColor Green
}

function Print-Error {
    param($Message)
    Write-Host "Error: $Message" -ForegroundColor Red
}

function Print-Info {
    param($Message)
    Write-Host "Info: $Message" -ForegroundColor Yellow
}

# Test 1: Check if server is running
Print-Header "Test 1: Server Health Check"

try {
    $response = Invoke-WebRequest -Uri "$API_URL" -Method GET -UseBasicParsing -TimeoutSec 5
    Print-Success "Server is running on $API_URL"
} catch {
    Print-Error "Server is not responding. Please start the dev server with 'npm run dev'"
    exit 1
}

# Test 2: Check Database Connection
Print-Header "Test 2: Database Connection"

Print-Info "Please check your database for YouTube channels"
Write-Host ""
Write-Host "Run this SQL query in your database:" -ForegroundColor White
Write-Host ""
Write-Host "SELECT id, clientId, channelId, channelTitle FROM YouTubeChannel WHERE isActive = true;" -ForegroundColor Gray
Write-Host ""

$CHANNEL_COUNT = Read-Host "How many active YouTube channels do you have"

if ([int]$CHANNEL_COUNT -gt 0) {
    Print-Success "Found $CHANNEL_COUNT active YouTube channels"
    $TEST_CLIENT_ID = Read-Host "Enter a clientId to test with"
} else {
    Print-Error "No YouTube channels found. Please connect a YouTube account first"
    Print-Info "Go to your client dashboard and connect YouTube via OAuth"
    exit 1
}

# Test 3: Manual Sync via API
Print-Header "Test 3: Manual Sync via API"

Print-Info "Testing: POST /api/cron/youtube-sync"

if ([string]::IsNullOrEmpty($CRON_SECRET)) {
    Print-Info "Loading CRON_SECRET from .env file..."
    
    if (Test-Path ".\.env") {
        $envContent = Get-Content ".\.env"
        foreach ($line in $envContent) {
            if ($line -match "^CRON_SECRET=(.+)$") {
                $CRON_SECRET = $matches[1].Trim('"')
                break
            }
        }
    }
}

if (![string]::IsNullOrEmpty($CRON_SECRET)) {
    try {
        $headers = @{
            "Authorization" = "Bearer $CRON_SECRET"
        }
        
        Print-Info "Running sync... (this may take 10-30 seconds)"
        $response = Invoke-RestMethod -Uri "$API_URL/api/cron/youtube-sync" -Method POST -Headers $headers
        
        Write-Host ""
        Write-Host "Response:" -ForegroundColor White
        $response | ConvertTo-Json -Depth 5
        Write-Host ""
        
        if ($response.success) {
            Print-Success "Sync completed successfully"
            Print-Info "Successful: $($response.successful), Failed: $($response.failed)"
        } else {
            Print-Error "Sync failed: $($response.error)"
        }
    } catch {
        Print-Error "API call failed: $($_.Exception.Message)"
    }
} else {
    Print-Error "CRON_SECRET not found in .env file"
}

# Test 4: Get Auth Token
Print-Header "Test 4: Get Auth Token"

Print-Info "You need to be logged in to test the remaining endpoints"
Write-Host ""
Write-Host "To get your authToken:" -ForegroundColor Yellow
Write-Host "1. Open your browser and go to http://localhost:3000" -ForegroundColor Yellow
Write-Host "2. Log in to your account" -ForegroundColor Yellow
Write-Host "3. Open DevTools (F12)" -ForegroundColor Yellow
Write-Host "4. Go to Application > Cookies > http://localhost:3000" -ForegroundColor Yellow
Write-Host "5. Copy the value of 'authToken'" -ForegroundColor Yellow
Write-Host ""

$AUTH_TOKEN = Read-Host "Enter your authToken from browser (or press Enter to skip remaining tests)"

if ([string]::IsNullOrEmpty($AUTH_TOKEN)) {
    Print-Info "Skipping remaining tests (no auth token provided)"
    Print-Header "Testing Summary"
    Write-Host "Partial tests completed" -ForegroundColor Yellow
    Write-Host "To complete all tests, run the script again with your auth token" -ForegroundColor Yellow
    exit 0
}

# Test 5: Dashboard Stats API
Print-Header "Test 5: Dashboard Stats API"

Print-Info "Testing: GET /api/youtube/dashboard-stats"

try {
    $headers = @{
        "Cookie" = "authToken=$AUTH_TOKEN"
    }
    
    $response = Invoke-RestMethod -Uri "$API_URL/api/youtube/dashboard-stats?clientId=$TEST_CLIENT_ID&period=28" -Method GET -Headers $headers
    
    Write-Host ""
    Write-Host "Response:" -ForegroundColor White
    $response | ConvertTo-Json -Depth 5
    Write-Host ""
    
    if ($response.success) {
        Print-Success "Dashboard stats API working"
        Write-Host ""
        Write-Host "Stats:" -ForegroundColor Cyan
        Write-Host "  Subscribers: $($response.stats.subscribers.current) ($($response.stats.subscribers.change)% $($response.stats.subscribers.trend))" -ForegroundColor White
        Write-Host "  Views: $($response.stats.views.current) ($($response.stats.views.change)% $($response.stats.views.trend))" -ForegroundColor White
        Write-Host "  Watch Time: $($response.stats.watchTime.current) hrs ($($response.stats.watchTime.change)% $($response.stats.watchTime.trend))" -ForegroundColor White
        Write-Host "  Revenue: $($response.stats.revenue.current) ($($response.stats.revenue.change)% $($response.stats.revenue.trend))" -ForegroundColor White
        Write-Host "  Last Synced: $($response.stats.lastSyncedAt)" -ForegroundColor White
    } else {
        Print-Error "Dashboard stats API failed"
    }
} catch {
    Print-Error "API call failed: $($_.Exception.Message)"
}

# Test 6: Performance Chart API
Print-Header "Test 6: Performance Chart API"

Print-Info "Testing: GET /api/youtube/performance-chart"

try {
    $headers = @{
        "Cookie" = "authToken=$AUTH_TOKEN"
    }
    
    $response = Invoke-RestMethod -Uri "$API_URL/api/youtube/performance-chart?clientId=$TEST_CLIENT_ID&metric=views&period=28" -Method GET -Headers $headers
    
    Write-Host ""
    Write-Host "Response (first 10 data points):" -ForegroundColor White
    $response.data | Select-Object -First 10 | Format-Table
    Write-Host ""
    
    if ($response.success) {
        Print-Success "Performance chart API working"
        Print-Info "Data points: $($response.data.Count)"
    } else {
        Print-Error "Performance chart API failed"
    }
} catch {
    Print-Error "API call failed: $($_.Exception.Message)"
}

# Summary
Print-Header "Testing Summary"

Write-Host "Tests completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Review the test results above" -ForegroundColor White
Write-Host "2. If all tests passed, backend is ready!" -ForegroundColor White
Write-Host "3. If any tests failed, check the error messages" -ForegroundColor White
Write-Host ""
Write-Host "Once all tests pass, we can proceed to build the UI!" -ForegroundColor Green
Write-Host ""
