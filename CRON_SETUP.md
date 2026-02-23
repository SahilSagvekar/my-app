# ⏰ Decoupled Cron System (E8 Productions)

The scheduled tasks for E8 Productions are managed by two separate TypeScript scripts. This separation ensures that high-volume tasks (like AI Titling) do not clutter the logs of critical production tasks (like Activity Reports).

## 1. The Scripts

### A. `src/scripts/cron-master.ts`
Handles low-volume, critical production tasks:
*   **Monthly Task Generation**: Daily at 1 AM EST
*   **Daily Activity Report**: Daily at 7 PM EST
*   **Daily Team Summary Report**: Daily at 7:05 PM EST (emailed summary of team activity)
*   **Meta Analytics Sync**: Daily at 2 AM EST
*   **YouTube Analytics Sync**: Daily at 3 AM EST

### B. `src/scripts/cron-titling.ts`
Handles high-volume maintenance:
*   **AI Titling Check**: Every 30 mins

## 2. PM2 Management

The system is split into two PM2 processes for better isolation.

*   **Check status**: `pm2 status`
*   **Restart Cron Master**: `pm2 restart cron-master`
*   **Restart Cron Titling**: `pm2 restart cron-titling`
*   **View Master Logs**: `pm2 logs cron-master`
*   **View Titling Logs**: `pm2 logs cron-titling`

## 3. Advanced Debugging (Separate Logs)

Instead of one long log file, every job now has its own dedicated log file for easy debugging. No more scrolling!

Find logs at:
*   `logs/jobs/ai-titling-check.log`
*   `logs/jobs/daily-activity-report.log`
*   `logs/jobs/daily-team-summary.log`
*   `logs/jobs/meta-daily-sync.log`
*   `logs/jobs/youtube-daily-sync.log`

To watch a specific job in real-time:
```bash
tail -f logs/jobs/daily-activity-report.log
```

## 4. Manual Triggers

If you need to force a job to run manually, you can use the API endpoints with your `CRON_SECRET` in the `x-cron-secret` header:

*   **Activity Report**: `POST /api/reports/activity`
*   **Team Summary**: `POST /api/reports/daily-summary`
*   **Recurring Tasks**: `POST /api/tasks/recurring/run`
*   **YouTube Sync**: `POST /api/cron/youtube-sync`
