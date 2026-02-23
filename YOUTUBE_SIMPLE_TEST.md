# YouTube Analytics - Simple Manual Testing

## Step 1: Check Database

Run this SQL query to find a client with YouTube connected:

```sql
SELECT id, clientId, channelId, channelTitle, subscriberCount, lastSyncedAt
FROM "YouTubeChannel"
WHERE isActive = true;
```

**Copy the `clientId` value - you'll need it for testing.**

---

## Step 2: Run Manual Sync

Open PowerShell and run:

```powershell
# Get your CRON_SECRET from .env file
$CRON_SECRET = "YOUR_CRON_SECRET_HERE"

# Run sync
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/cron/youtube-sync" -Method POST -Headers @{"Authorization"="Bearer $CRON_SECRET"}

# View result
$response | ConvertTo-Json
```

**Expected output:**
```json
{
  "success": true,
  "total": 1,
  "successful": 1,
  "failed": 0
}
```

---

## Step 3: Check Snapshot Data

After sync, run this SQL query:

```sql
SELECT clientId, subscriberCount, views, watchTimeHours, estimatedRevenue, snapshotDate
FROM "YouTubeSnapshot"
WHERE clientId = 'YOUR_CLIENT_ID_HERE'
ORDER BY snapshotDate DESC
LIMIT 5;
```

**You should see at least 1 row with recent data.**

---

## Step 4: Get Your Auth Token

1. Open browser: http://localhost:3000
2. Log in
3. Press F12 (DevTools)
4. Go to: Application > Cookies > http://localhost:3000
5. Copy the value of `authToken`

---

## Step 5: Test Dashboard Stats API

```powershell
# Replace these values
$AUTH_TOKEN = "YOUR_AUTH_TOKEN_HERE"
$CLIENT_ID = "YOUR_CLIENT_ID_HERE"

# Call API
$response = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/youtube/dashboard-stats?clientId=$CLIENT_ID&period=28" `
  -Method GET `
  -Headers @{"Cookie"="authToken=$AUTH_TOKEN"}

# View result
$response | ConvertTo-Json -Depth 5
```

**Expected output:**
```json
{
  "success": true,
  "stats": {
    "subscribers": {
      "current": 10500,
      "change": 5.2,
      "trend": "up"
    },
    "views": {
      "current": 125000,
      "change": 12.3,
      "trend": "up"
    },
    "watchTime": {
      "current": 8500,
      "change": -2.1,
      "trend": "down"
    },
    "revenue": {
      "current": 450.75,
      "change": 8.9,
      "trend": "up"
    }
  }
}
```

---

## Step 6: Test Performance Chart API

```powershell
$response = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/youtube/performance-chart?clientId=$CLIENT_ID&metric=views&period=28" `
  -Method GET `
  -Headers @{"Cookie"="authToken=$AUTH_TOKEN"}

# View first 10 data points
$response.data | Select-Object -First 10 | Format-Table
```

**Expected output:**
```
date         value
----         -----
2026-01-07   4500
2026-01-08   5200
...
```

---

## ✅ Success Criteria

- [ ] Sync completes successfully
- [ ] Data appears in YouTubeSnapshot table
- [ ] Dashboard stats API returns all 4 metrics
- [ ] Chart API returns time-series data
- [ ] No errors in any step

---

## 🚀 Next Step

Once all tests pass, let me know and I'll build the UI!
