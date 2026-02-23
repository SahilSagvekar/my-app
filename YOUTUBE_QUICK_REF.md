# YouTube Analytics - Quick Reference

## 🚀 Quick Start

```powershell
# 1. Start dev server
npm run dev

# 2. Run testing script
.\scripts\test-youtube-analytics.ps1

# 3. Follow the prompts!
```

---

## 📋 What You Need

1. **Client ID** - Get from database:
   ```sql
   SELECT id, name FROM "Client" WHERE userId = YOUR_USER_ID;
   ```

2. **Auth Token** - Get from browser:
   - F12 > Application > Cookies > authToken

3. **Cron Secret** - Get from `.env`:
   - Look for `CRON_SECRET=...`

---

## 🔧 Quick Commands

### Manual Sync (PowerShell)
```powershell
$CRON_SECRET = "your-secret"
Invoke-RestMethod -Uri "http://localhost:3000/api/cron/youtube-sync" -Method POST -Headers @{"Authorization"="Bearer $CRON_SECRET"}
```

### Check Stats (PowerShell)
```powershell
$AUTH_TOKEN = "your-token"
$CLIENT_ID = "your-client-id"
Invoke-RestMethod -Uri "http://localhost:3000/api/youtube/dashboard-stats?clientId=$CLIENT_ID&period=28" -Headers @{"Cookie"="authToken=$AUTH_TOKEN"}
```

### Check Database
```sql
-- Active channels
SELECT * FROM "YouTubeChannel" WHERE isActive = true;

-- Recent snapshots
SELECT * FROM "YouTubeSnapshot" ORDER BY snapshotDate DESC LIMIT 5;
```

---

## ✅ Success Checklist

- [ ] Dev server running
- [ ] At least 1 YouTube channel connected
- [ ] Sync completes successfully
- [ ] Data in YouTubeSnapshot table
- [ ] Dashboard stats API works
- [ ] Chart data API works

---

## 📞 Need Help?

Check these files:
- `YOUTUBE_ANALYTICS_TESTING.md` - Full testing guide
- `YOUTUBE_ANALYTICS_PROGRESS.md` - Implementation details
- `logs/cron.log` - Error logs

---

## 🎯 Next Step

Once all tests pass, let me know and I'll build the UI!
