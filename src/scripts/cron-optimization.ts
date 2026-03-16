import cron from 'node-cron';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';

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

console.log('🚀 [Cron Optimization] Starting standalone Video Optimization recovery cron service...');
console.log(`🔗 Target API: ${BASE_URL}`);

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

// ==========================================
// Video Optimization Recovery (Every 30 mins)
// ==========================================
cron.schedule('0,30 * * * *', () => {
    triggerJob('Video Optimization Recovery', '/api/cron/check-optimization-jobs');
}, { timezone: 'America/New_York' });

// System Heartbeat
cron.schedule('0 * * * *', () => {
    console.log(`💓 [Heartbeat] Cron Optimization is alive.`);
}, { timezone: 'America/New_York' });
