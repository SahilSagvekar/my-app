# 🧪 YouTube Analytics - Step-by-Step Testing Guide

## Prerequisites Checklist

Before testing, ensure:

- [ ] Dev server is running (`npm run dev`)
- [ ] You have at least ONE client with YouTube connected
- [ ] You know the `clientId` of that client
- [ ] You have your `authToken` from browser cookies

---

## Quick Start: Run the Testing Script

### Option 1: PowerShell Script (Recommended for Windows)

```powershell
# Navigate to project directory
cd "d:\E8 Productions\my-app"

# Run the testing script
.\scripts\test-youtube-analytics.ps1
```

The script will guide you through all tests interactively!

---

## Manual Testing (If Script Doesn't Work)

### Step 1: Check Database for YouTube Channels

Open your database and run:

```sql
SELECT id, clientId, channelId, channelTitle, subscriberCount, lastSyncedAt, syncStatus
FROM "YouTubeChannel"
WHERE isActive = true;
```

**Expected Result:**
- At least 1 row showing a connected YouTube channel
- Note the `clientId` for testing

**If no results:**
- Go to client dashboard
- Connect YouTube account via OAuth
- Come back and run query again

---

### Step 2: Run Manual Sync

#### Option A: Via API (Easiest)

1. Get your `CRON_SECRET` from `.env` file
2. Open PowerShell and run:

```powershell
$CRON_SECRET = "YOUR_CRON_SECRET_HERE"
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/cron/youtube-sync" -Method POST -Headers @{"Authorization"="Bearer $CRON_SECRET"}
$response | ConvertTo-Json
```

#### Option B: Via Bash Script (if you have Git Bash)

```bash
./scripts/cron-master.sh youtube
```

**Expected Result:**
```json
{
  "success": true,
  "total": 1,
  "successful": 1,
  "failed": 0,
  "results": [...]
}
```

**If it fails:**
- Check YouTube API is enabled in Google Cloud Console
- Check `GOOGLE_YOUTUBE_CLIENT_ID` and `GOOGLE_YOUTUBE_CLIENT_SECRET` in `.env`
- Check client's YouTube connection hasn't expired

---

### Step 3: Verify Data in Database

After sync, check for snapshot data:

```sql
SELECT 
  clientId, 
  subscriberCount, 
  views, 
  watchTimeHours, 
  estimatedRevenue, 
  snapshotDate
FROM "YouTubeSnapshot"
WHERE clientId = 'YOUR_CLIENT_ID_HERE'
ORDER BY snapshotDate DESC
LIMIT 5;
```

**Expected Result:**
- At least 1 row with recent `snapshotDate`
- All metrics should have values (not null)

**If no results:**
- Sync failed - check logs
- Check `YouTubeChannel.syncStatus` and `syncError` columns

---

### Step 4: Get Your Auth Token

1. Open browser and go to `http://localhost:3000`
2. Log in to your account
3. Open DevTools (F12)
4. Go to **Application** tab > **Cookies** > `http://localhost:3000`
5. Find `authToken` and copy its value

---

### Step 5: Test Dashboard Stats API

Replace `YOUR_AUTH_TOKEN` and `YOUR_CLIENT_ID`:

```powershell
$AUTH_TOKEN = "YOUR_AUTH_TOKEN_HERE"
$CLIENT_ID = "YOUR_CLIENT_ID_HERE"

$response = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/youtube/dashboard-stats?clientId=$CLIENT_ID&period=28" `
  -Method GET `
  -Headers @{"Cookie"="authToken=$AUTH_TOKEN"}

$response | ConvertTo-Json -Depth 5
```

**Expected Result:**
```json
{
  "success": true,
  "connected": true,
  "channel": {
    "id": "UCxxxxxxxxxxxxxx",
    "title": "Channel Name"
  },
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
    },
    "lastSyncedAt": "2026-02-03T11:20:00.000Z"
  },
  "period": 28
}
```

---

### Step 6: Test Performance Chart API

```powershell
$response = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/youtube/performance-chart?clientId=$CLIENT_ID&metric=views&period=28" `
  -Method GET `
  -Headers @{"Cookie"="authToken=$AUTH_TOKEN"}

$response.data | Select-Object -First 10 | Format-Table
```

**Expected Result:**
```
date         value
----         -----
2026-01-07   4500
2026-01-08   5200
2026-01-09   4800
...
```

---

### Step 7: Test Manual Sync API

```powershell
$body = @{
  clientId = $CLIENT_ID
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/youtube/manual-sync" `
  -Method POST `
  -Headers @{
    "Cookie"="authToken=$AUTH_TOKEN"
    "Content-Type"="application/json"
  } `
  -Body $body

$response | ConvertTo-Json
```

**Expected Result (Success):**
```json
{
  "success": true,
  "message": "YouTube data synced successfully",
  "channelId": "UCxxxxxxxxxxxxxx",
  "timestamp": "2026-02-03T11:25:00.000Z"
}
```

**Expected Result (Rate Limited):**
```json
{
  "error": "Please wait 3 minute(s) before syncing again",
  "waitTime": 3
}
```

---

### Step 8: Test Admin Clients API (Admin Only)

If you're logged in as admin:

```powershell
$response = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/youtube/admin/clients" `
  -Method GET `
  -Headers @{"Cookie"="authToken=$AUTH_TOKEN"}

$response.connectedClients | Format-Table clientName, channel
```

**Expected Result:**
- List of all clients
- Shows which have YouTube connected
- Shows subscriber counts

---

## ✅ Success Criteria

All tests should pass with these results:

- [x] Database has at least 1 active YouTubeChannel
- [x] Manual sync completes successfully
- [x] YouTubeSnapshot table has data
- [x] Dashboard stats API returns metrics with trends
- [x] Performance chart API returns time-series data
- [x] Manual sync API works (or rate limits correctly)
- [x] Admin clients API lists all clients (if admin)

---

## 🐛 Common Issues & Solutions

### Issue: "No YouTube channel connected"
**Solution:** Client needs to connect YouTube via OAuth first

### Issue: "Token expired" or "Invalid credentials"
**Solution:** 
- Check `GOOGLE_YOUTUBE_CLIENT_ID` and `GOOGLE_YOUTUBE_CLIENT_SECRET` in `.env`
- Client may need to reconnect YouTube

### Issue: "Quota exceeded"
**Solution:** 
- You've hit YouTube API daily limit (10,000 units)
- Wait 24 hours or request quota increase from Google

### Issue: No data in YouTubeSnapshot
**Solution:**
- Check `YouTubeChannel.syncStatus` - should be "COMPLETED"
- Check `YouTubeChannel.syncError` for error message
- Run sync again

### Issue: "Unauthorized" on API calls
**Solution:**
- Your authToken may be expired
- Log out and log in again
- Get fresh authToken from browser cookies

---

## 📊 What to Look For

### Good Signs ✅
- Sync completes in 5-10 seconds
- All 4 metrics have values
- Trends show "up", "down", or "neutral"
- Chart data has 28 data points
- No errors in console

### Bad Signs ❌
- Sync takes >30 seconds
- Metrics are all 0
- API returns errors
- No data in database
- Sync status is "FAILED"

---

## 🚀 Next Steps

Once all tests pass:

1. ✅ Backend is working correctly!
2. ✅ Data is syncing from YouTube
3. ✅ APIs are returning correct data
4. ✅ Ready to build the UI!

**Let me know when all tests pass, and I'll start building the dashboard UI!**

---

## 📝 Testing Checklist

Copy this checklist and mark items as you test:

```
Backend Testing Checklist:

Database:
[ ] YouTubeChannel table has active channels
[ ] YouTubeSnapshot table has recent data
[ ] Sync status is "COMPLETED"

Sync:
[ ] Manual sync via API works
[ ] Cron endpoint works
[ ] Data appears in database after sync

APIs:
[ ] Dashboard stats returns 4 metrics
[ ] Performance chart returns time-series data
[ ] Admin clients lists all clients
[ ] Manual sync has rate limiting

Data Quality:
[ ] Subscribers count is correct
[ ] Views count is reasonable
[ ] Watch time is in hours
[ ] Revenue is in dollars
[ ] Trends are calculated correctly

Ready for UI:
[ ] All tests passed
[ ] No errors in console
[ ] Data looks accurate
```

---

**Status:** Ready for testing!
**Next:** Run tests and report results
