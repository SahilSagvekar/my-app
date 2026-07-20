import cron from 'node-cron';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import {
    getEnabledSlackScheduledJobs,
    runSlackScheduledJob,
    SLACK_SCHEDULED_TIMEZONE,
} from "@/lib/slack-scheduled-jobs";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const CRON_SECRET = process.env.CRON_SECRET || '';

/**
 * 📝 Helper for job-specific logging
 */
function logToJobFile(jobName: string, message: string, isError: boolean = false) {
    const logDir = path.join(process.cwd(), 'logs', 'jobs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    const fileName = `${jobName.toLowerCase().replace(/\s+/g, '-')}.log`;
    const logPath = path.join(logDir, fileName);
    const timestamp = new Date().toLocaleString();
    const prefix = isError ? '❌ ERROR' : '✅ INFO';
    const logMessage = `[${timestamp}] [${prefix}] ${message}\n`;

    // 1. Log to console for PM2 visibility
    if (isError) {
        console.error(`[${jobName}] ${message}`);
    } else {
        console.log(`[${jobName}] ${message}`);
    }

    // 2. Append to its own dedicated file
    try {
        fs.appendFileSync(logPath, logMessage);
    } catch (err) {
        console.error(`Failed to write to log file: ${logPath}`, err);
    }
}

console.log('🚀 [Cron Master] Starting centralized cron service...');
console.log(`🔗 Target API: ${BASE_URL}`);
registerScheduledSlackReminderJobs();

// ── Upload background worker ──────────────────────────────────────────────────
// Processes upload completion jobs every 3 seconds:
// DB writes, storage update, Drive mirror, Slack, audit log.
// This runs after /api/upload/complete has already returned success to the browser.
import { runUploadWorkerTick } from '@/lib/upload-worker';

console.log('📬 [Upload Worker] Starting background job processor...');
setInterval(async () => {
  try {
    await runUploadWorkerTick();
  } catch (err: any) {
    console.error('[Upload Worker] Uncaught error in tick:', err.message);
  }
}, 3000); // every 3 seconds


// ── NAS mirror background worker ────────────────────────────────────────────
// Processes NasMirrorJob rows every 10 seconds: copies R2 -> NAS MinIO,
// verifies, deletes verified files from R2, updates File records.
// Triggered by POST /api/nas/mirror-and-cleanup from the NAS Backup admin panel.
import { runNasMirrorWorkerTick } from '@/lib/nas-mirror-worker';

console.log('📦 [NAS Mirror Worker] Starting background job processor...');
setInterval(async () => {
  try {
    await runNasMirrorWorkerTick();
  } catch (err: any) {
    console.error('[NAS Mirror Worker] Uncaught error in tick:', err.message);
  }
}, 10000); // every 10 seconds — jobs are large, no need to poll as often as uploads

/**
 * Utility to trigger a local API endpoint
 */
async function triggerJob(name: string, endpoint: string, method: 'GET' | 'POST' = 'GET', data: any = {}) {
    const start = Date.now();
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

    logToJobFile(name, `Starting Job: ${name} (Target: ${url})`);

    try {
        // Set up headers with CRON_SECRET if available
        const config = {
            headers: {
                'x-cron-secret': CRON_SECRET,
                'Content-Type': 'application/json'
            }
        };

        let response;
        if (method === 'POST') {
            response = await axios.post(url, data, config);
        } else {
            response = await axios.get(url, config);
        }

        const duration = Date.now() - start;
        const msg = response.data.message || 'Job completed';
        logToJobFile(name, `Success (${duration}ms): ${msg}`);
        return response.data;
    } catch (error: any) {
        const duration = Date.now() - start;
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;

        logToJobFile(name, `Failed (${duration}ms) [${status || 'No Status'} ${statusText || ''}]: ${errorMsg}`, true);

        if (status === 502) {
            logToJobFile(name, `Got 502 Bad Gateway. This usually means the Next.js app is down or restarting.`, true);
        }
        return null;
    }
}

function registerScheduledSlackReminderJobs() {
    const slackJobs = getEnabledSlackScheduledJobs();

    if (slackJobs.length === 0) {
        console.log('⚪ [Cron Master] No scheduled Slack reminder jobs are enabled.');
        return;
    }

    console.log(`💬 [Cron Master] Registering ${slackJobs.length} scheduled Slack reminder jobs...`);

    for (const job of slackJobs) {
        cron.schedule(job.schedule, async () => {
            logToJobFile(job.name, `Starting scheduled Slack reminder for "${job.channel}" group`);

            try {
                const result = await runSlackScheduledJob(job.key);

                if (result.skipped) {
                    logToJobFile(job.name, `Skipped: ${result.reason || 'job disabled'}`);
                    return;
                }

                const delivery = result.delivery;
                if (!delivery || delivery.missing || delivery.attempted === 0) {
                    logToJobFile(
                        job.name,
                        `Completed with no delivery targets. Channel group "${job.channel}" has no configured webhooks.`,
                    );
                    return;
                }

                const summary = `Delivered to ${delivery.succeeded}/${delivery.attempted} webhook(s) for "${job.channel}"`;
                if (delivery.failed > 0) {
                    logToJobFile(job.name, `${summary}; ${delivery.failed} failed`, true);
                } else {
                    logToJobFile(job.name, summary);
                }
            } catch (error: any) {
                logToJobFile(
                    job.name,
                    `Failed to run scheduled Slack reminder: ${error?.message || error}`,
                    true,
                );
            }
        }, { timezone: SLACK_SCHEDULED_TIMEZONE });
    }
}


// ==========================================
// 2. Monthly Task Generation (Daily at 1 AM)
// ==========================================
cron.schedule('0 1 * * *', async () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    // Calculate last day of current month
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Check if we're in the last 3 days of the month
    const isEndOfMonth = currentDay >= lastDayOfMonth - 2; // 29th, 30th, 31st (or 26th, 27th, 28th for Feb)

    console.log(`\n📦 [Cron Master] Starting Monthly Task Generation cycle...`);
    console.log(`   📅 Current: ${currentYear}-${currentMonth + 1}-${currentDay}`);
    console.log(`   📅 Last day of month: ${lastDayOfMonth}`);
    console.log(`   📅 Is end of month (last 3 days): ${isEndOfMonth}`);

    // 1. Safety run for CURRENT month (always runs to catch any missed tasks)
    // This ensures if tasks weren't created, they get created now
    const currentResult = await triggerJob('Current Month Tasks', '/api/tasks/recurring/run', 'POST', {
        year: currentYear,
        month: currentMonth,
        dryRun: false
    });

    // 2. Generate NEXT month's tasks - ONLY in the LAST 3 days of the month
    // This gives time for next month's tasks to be ready before the new month starts
    let nextResult: any = null;
    if (isEndOfMonth) {
        console.log(`   🎉 End of month (${currentDay}/${lastDayOfMonth}) - pre-generating next month's tasks...`);

        // Calculate next month
        let nextMonth = currentMonth + 1;
        let nextYear = currentYear;
        if (nextMonth > 11) {
            nextMonth = 0;
            nextYear++;
        }

        await new Promise((resolve) => {
            setTimeout(async () => {
                nextResult = await triggerJob('Next Month Tasks', '/api/tasks/recurring/run', 'POST', {
                    year: nextYear,
                    month: nextMonth,
                    dryRun: false
                });
                resolve(true);
            }, 5000);
        });
    } else {
        console.log(`   ⏭️ Not end of month yet (day ${currentDay}/${lastDayOfMonth}) - skipping next month task generation`);
    }

    // 3. Send Child-Friendly Report to Sahil
    if (currentResult || nextResult) {
        console.log(`📤 [Cron Master] Sending summary report to Sahil...`);

        const summaryResults: any[] = [];
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        const processResult = (res: any, monthName: string) => {
            if (!res) return;

            // Total tasks created for this month
            if (res.created > 0) {
                summaryResults.push({
                    name: `${monthName} Tasks`,
                    created: res.created,
                    skipped: 0
                });
            }

            // Specific skip reasons
            if (res.details?.skippedReasons) {
                res.details.skippedReasons.forEach((skip: any) => {
                    summaryResults.push({
                        name: `${skip.clientName} (${monthName})`,
                        created: 0,
                        skipped: 1,
                        skippedReason: skip.reason
                    });
                });
            }
        };

        // Always process current month
        processResult(currentResult, monthNames[currentMonth]);

        // Only process next month if it was run (last 3 days of month)
        if (nextResult) {
            const nextMonthIndex = currentMonth === 11 ? 0 : currentMonth + 1;
            processResult(nextResult, monthNames[nextMonthIndex]);
        }

        await triggerJob('Email Cron Report', '/api/reports/cron-email', 'POST', {
            results: summaryResults,
            timestamp: now.toISOString()
        });
    }
}, { timezone: 'America/New_York' });

// ==========================================
// 2.5 S3 to NAS Monthly Archive (1st of every month at 4 AM EST)
// Sweeps output-folder files whose task month is >2 months old: verifies
// each file is really present on the NAS mount, then deletes it from R2.
// ==========================================
cron.schedule('0 4 1 * *', () => {
    triggerJob('S3 to NAS Monthly Archive', '/api/cron/s3-to-nas', 'POST', { dryRun: false });
}, { timezone: 'America/New_York' });

// ==========================================
// 3. Daily Activity Report (Daily at 7 PM EST)
// ==========================================
// cron.schedule('0 19 * * *', () => {
//     triggerJob('Daily Activity Report', '/api/reports/activity', 'POST');
// }, { timezone: 'America/New_York' });

// ==========================================
// 3b. Daily Team Summary Report (Daily at 7:05 PM EST)
// Sends a formatted summary email to admin showing
// what each editor, QC, scheduler, etc. did today.
// ==========================================
cron.schedule('5 19 * * *', () => {
    triggerJob('Daily Team Summary', '/api/reports/daily-summary', 'POST');
}, { timezone: 'America/New_York' });

// ==========================================
// 4. Meta Analytics Sync (Daily at 2 AM)
// ==========================================
cron.schedule('0 2 * * *', () => {
    triggerJob('Meta Daily Sync', '/api/cron/meta-sync', 'GET');
}, { timezone: 'America/New_York' });

// ==========================================
// 5. YouTube Analytics Sync (Daily at 3 AM)
// ==========================================
cron.schedule('0 3 * * *', () => {
    triggerJob('YouTube Daily Sync', '/api/cron/youtube-sync', 'POST');
}, { timezone: 'America/New_York' });

// ==========================================
// 6. Auto-Invoice Generation (Daily at 9 AM)
// Creates DRAFT invoices for clients whose billingDay = today,
// then emails admin to review before anything is sent to clients.
// ==========================================
cron.schedule('0 9 * * *', () => {
    triggerJob('Auto Invoice', '/api/cron/auto-invoice', 'POST');
}, { timezone: 'America/New_York' });

// ==========================================
// 7. Drive Mirror DB Sync (Every 2 minutes)
// Polls the file server's completed-mirror queue and writes Drive URLs to the DB.
// ==========================================
cron.schedule('*/30 * * * * *', () => {
    triggerJob('Drive Mirror Sync', '/api/cron/check-drive-mirrors', 'GET');
});

// ==========================================
// 5. System Heartbeat (Every hour)
// ==========================================
cron.schedule('0 * * * *', () => {
    console.log(`💓 [Heartbeat] Cron Master is alive and tracking ${cron.getTasks().size} jobs.`);
}, { timezone: 'America/New_York' });

// ==========================================
// 7. Daily Posting Target Check (Every 2 hours)
// Notifies a client's Slack channel (falls back to scheduling channel)
// once all its daily posting targets are met for today (EST).
// ==========================================
cron.schedule('0 */2 * * *', () => {
    triggerJob('Daily Target Check', '/api/cron/daily-target-check', 'GET');
}, { timezone: 'America/New_York' });

// ==========================================
// 8. Daily Posting Target Team Summaries (Scheduling channel)
// SOD 8:30 AM: how many posts are needed today
// Midday 12:00 PM: progress + what's missing
// EOD 3:00 PM: what's still missing, fix ASAP
// ==========================================
cron.schedule('30 8 * * *', () => {
    triggerJob('Daily Target Summary (SOD)', '/api/cron/daily-target-summary?stage=sod', 'GET');
}, { timezone: 'America/New_York' });

cron.schedule('0 12 * * *', () => {
    triggerJob('Daily Target Summary (Midday)', '/api/cron/daily-target-summary?stage=midday', 'GET');
}, { timezone: 'America/New_York' });

cron.schedule('0 15 * * *', () => {
    triggerJob('Daily Target Summary (EOD)', '/api/cron/daily-target-summary?stage=eod', 'GET');
}, { timezone: 'America/New_York' });

// ==========================================
// 9. Weekly Commission Payout Batch (Fridays at 5 PM EST)
// Sends Stripe transfers for every APPROVED commission past its hold window
// and above the configured minimum threshold. See src/lib/stripe-payouts.ts.
// ==========================================
cron.schedule('0 17 * * 5', () => {
    triggerJob('Commission Payout Batch', '/api/cron/commission-payouts', 'POST');
}, { timezone: 'America/New_York' });

// ==========================================
// 10. Commission Payout Reconciliation (Every 2 hours)
// Catches payouts stuck in SENT because the stripe-connect webhook never
// arrived — asks Stripe directly for transfer status.
// ==========================================
cron.schedule('0 */2 * * *', () => {
    triggerJob('Commission Payout Reconcile', '/api/cron/commission-payouts-reconcile', 'POST');
}, { timezone: 'America/New_York' });

// Log initialized jobs
console.log('📦 Jobs Scheduled:');
console.log(' - Monthly Tasks: Daily at 1 AM');
console.log(' - Meta Sync: Daily at 2 AM');
console.log(' - YouTube Sync: Daily at 3 AM');
console.log(' - Auto Invoice: Daily at 9 AM (drafts → admin review)');
console.log(' - Billing Warnings: Daily at 10 AM');
console.log(' - Activity Report: Daily at 7 PM');
console.log(' - Team Summary Report: Daily at 7:05 PM');
console.log(' - Maintenance: Every 2 hours');
console.log(' - Heartbeat: Every hour');
console.log(' - Daily Target Check: Every 2 hours (per-client 100% Slack ping)');
console.log(' - Daily Target Summaries: 8:30 AM / 12:00 PM / 3:00 PM (scheduling channel)');
console.log(' - Commission Payout Batch: Fridays at 5 PM');
console.log('---------------------------------------------');