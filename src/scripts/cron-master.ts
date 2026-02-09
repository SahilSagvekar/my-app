import cron from 'node-cron';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || '';

console.log('🚀 [Cron Master] Starting centralized cron service...');
console.log(`🔗 Target API: ${BASE_URL}`);

/**
 * Utility to trigger a local API endpoint
 */
async function triggerJob(name: string, endpoint: string, method: 'GET' | 'POST' = 'GET', data: any = {}) {
    const start = Date.now();
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

    console.log(`\n⏰ [${new Date().toLocaleString()}] Starting Job: ${name}`);
    console.log(`   Target: ${url}`);

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
        console.log(`✅ [${name}] Success (${duration}ms):`, response.data.message || 'Job completed');
        return response.data;
    } catch (error: any) {
        const duration = Date.now() - start;
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        console.error(`❌ [${name}] Failed (${duration}ms) [${status || 'No Status'} ${statusText || ''}]:`,
            error.response?.data?.error || error.response?.data?.message || error.message);

        if (status === 502) {
            console.warn(`   ⚠️  Got 502 Bad Gateway. This usually means the Next.js app is down or restarting.`);
        }
        return null;
    }
}

// ==========================================
// 1. AI Titling Maintenance (Every 30 mins)
// ==========================================
cron.schedule('0,30 * * * *', () => {
    triggerJob('AI Titling Check', '/api/cron/check-titling-jobs');
});

// ==========================================
// 2. Monthly Task Generation (Daily at 1 AM)
// ==========================================
cron.schedule('0 1 * * *', async () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    console.log(`\n📦 [Cron Master] Starting Monthly Task Generation cycle...`);
    console.log(`   📅 Current: ${currentYear}-${currentMonth + 1}-${currentDay}`);

    // 1. Safety run for current month (always runs to catch any missed tasks)
    const currentResult = await triggerJob('Current Month Tasks', '/api/tasks/recurring/run', 'POST', {
        year: currentYear,
        month: currentMonth,
        dryRun: false
    });

    // 2. Generate NEXT month's tasks - ONLY on the 1st day of each month
    let nextResult: any = null;
    if (currentDay === 1) {
        console.log(`   🎉 First of the month - generating next month's tasks...`);

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
        console.log(`   ⏭️ Not the 1st - skipping next month task generation`);
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

        // Only process next month if it was run (last 5 days of month)
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
// 3. Daily Activity Report (Daily at 7 PM EST)
// ==========================================
cron.schedule('0 19 * * *', () => {
    triggerJob('Daily Activity Report', '/api/reports/activity', 'POST');
}, { timezone: 'America/New_York' });

// ==========================================
// 4. Meta Analytics Sync (Daily at 2 AM)
// ==========================================
cron.schedule('0 2 * * *', () => {
    triggerJob('Meta Daily Sync', '/api/cron/meta-sync', 'GET');
});

// ==========================================
// 5. YouTube Analytics Sync (Daily at 3 AM)
// ==========================================
cron.schedule('0 3 * * *', () => {
    triggerJob('YouTube Daily Sync', '/api/cron/youtube-sync', 'POST');
});

// ==========================================
// 6. Stuck Uploads / Drive Maintenance (Every 2 hours)
// ==========================================
cron.schedule('0 */2 * * *', () => {
    // Placeholder - add endpoint if you have one for drive sync/cleanup
    console.log('⏳ [Maintenance] Running drive/upload health check placeholder...');
});

// ==========================================
// 5. System Heartbeat (Every hour)
// ==========================================
cron.schedule('0 * * * *', () => {
    console.log(`💓 [Heartbeat] Cron Master is alive and tracking ${cron.getTasks().size} jobs.`);
});

// Log initialized jobs
console.log('📦 Jobs Scheduled:');
console.log(' - AI Titling: Every 30 mins');
console.log(' - Monthly Tasks: Daily at 1 AM');
console.log(' - Meta Sync: Daily at 2 AM');
console.log(' - YouTube Sync: Daily at 3 AM');
console.log(' - Activity Report: Daily at 7 PM');
console.log(' - Maintenance: Every 2 hours');
console.log(' - Heartbeat: Every hour');
console.log('---------------------------------------------');
