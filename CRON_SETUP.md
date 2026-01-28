# ⏰ Cron Job Setup for AWS (E8 Productions)

This guide helps you set up scheduled tasks (Cron Jobs) on your AWS server to keep the platform running smoothly.

## 1. Prerequisites

1.  **Ensure Script Permissions**:
    Run the following command to make the master script executable:
    ```bash
    chmod +x /home/ubuntu/my-app/scripts/cron-master.sh
    ```

2.  **Environment Variables**:
    Ensure your `.env` file contains a `CRON_SECRET`. This is used to prevent unauthorized access to your cron endpoints.
    ```env
    CRON_SECRET="your-random-secure-string"
    BASE_URL="http://localhost:3000"
    ```

## 2. Setting Up the Crontab

Open your server's crontab editor:
```bash
crontab -e
```

Copy and paste the following entries at the bottom of the file (adjust the path to match your actual project directory on AWS). 

**Note on Timing**: 7:00 PM EST is typically **00:00 UTC** (Standard Time) or **23:00 UTC** (Daylight Savings). The entries below are set to 7:00 PM Server Time. If your server is in UTC, use `0 0 * * *`.

```bash
# E8 Productions - Master Cron Jobs
# Format: minute hour day month day_of_week command

# 1. Check for stuck titling/transcription jobs (Every 30 minutes)
*/30 * * * * /home/ubuntu/my-app/scripts/cron-master.sh titling >> /home/ubuntu/my-app/logs/cron.log 2>&1

# 2. Recurring Task Generation (Daily at 7:00 PM EST)
0 19 * * * /home/ubuntu/my-app/scripts/cron-master.sh recurring >> /home/ubuntu/my-app/logs/cron.log 2>&1

# 3. Daily Activity Report & Email to Eric (Daily at 7:00 PM EST)
5 19 * * * /home/ubuntu/my-app/scripts/cron-master.sh report >> /home/ubuntu/my-app/logs/cron.log 2>&1
```

## 3. Available Commands

You can also run these manually at any time to test them:

| Command | Action |
| :--- | :--- |
| `./scripts/cron-master.sh titling` | Checks for stuck AI processing/transcription |
| `./scripts/cron-master.sh recurring` | Forces a check/generation of monthly tasks |
| `./scripts/cron-master.sh report` | Manually triggers the Daily Activity Report |
| `./scripts/cron-master.sh all` | Runs all jobs in sequence |

## 4. Monitoring

You can monitor the output of these jobs by checking the log file:
```bash
tail -f /home/ubuntu/my-app/logs/cron.log
```
