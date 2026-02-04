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

    // Calculate next month
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 11) {
        nextMonth = 0;
        nextYear++;
    }

    console.log(`\n📦 [Cron Master] Starting Monthly Task Generation cycle...`);

    // 1. Safety run for current month
    const currentResult = await triggerJob('Current Month Tasks', '/api/tasks/recurring/run', 'POST', {
        year: currentYear,
        month: currentMonth,
        dryRun: false
    });

    // 2. Proactive run for next month
    let nextResult: any = null;
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

        processResult(currentResult, monthNames[currentMonth]);
        processResult(nextResult, monthNames[nextMonth]);

        await triggerJob('Email Cron Report', '/api/reports/cron-email', 'POST', {
            results: summaryResults,
            timestamp: now.toISOString()
        });
    }
});

// ==========================================
// 3. Daily Activity Report (Daily at 7 PM EST)
// ==========================================
cron.schedule('0 19 * * *', () => {
    triggerJob('Daily Activity Report', '/api/reports/activity', 'POST');
});

// ==========================================
// 4. Stuck Uploads / Drive Maintenance (Every 2 hours)
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
console.log(' - Activity Report: Daily at 7 PM');
console.log(' - Maintenance: Every 2 hours');
console.log(' - Heartbeat: Every hour');
console.log('---------------------------------------------');
