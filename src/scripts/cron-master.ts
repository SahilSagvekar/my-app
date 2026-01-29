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
    console.log(`\n⏰ [${new Date().toLocaleString()}] Starting Job: ${name}`);

    try {
        const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

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
    } catch (error: any) {
        const duration = Date.now() - start;
        console.error(`❌ [${name}] Failed (${duration}ms):`, error.response?.data?.error || error.message);
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
cron.schedule('0 1 * * *', () => {
    // Bulk monthly generation for all clients
    triggerJob('Monthly Task Generation', '/api/tasks/recurring/run', 'POST', {
        year: new Date().getFullYear(),
        month: new Date().getMonth(),
        dryRun: false
    });
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
