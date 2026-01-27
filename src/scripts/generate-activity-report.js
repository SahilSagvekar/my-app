// scripts/generate-activity-report.js
/**
 * Script to trigger the daily activity report generation.
 * This should be scheduled to run daily at 7 PM EST.
 */
const API_URL = process.env.BASE_URL || 'http://localhost:3000';
// In a real production environment, you would use a secret API key or a service token.
// For now, we'll assume the internal network allows this or it's triggered via a secure method.

async function triggerReport() {
    console.log(`[${new Date().toISOString()}] 🚀 Triggering daily activity report generation...`);

    try {
        // We use the POST endpoint we created. 
        // Note: Since this is a server-side script, it might need to bypass the JWT check 
        // or use a dedicated CRON_SECRET.
        const response = await fetch(`${API_URL}/api/reports/activity`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Add a secret header if you implement manual trigger protection
                'x-cron-secret': process.env.CRON_SECRET || ''
            }
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`[${new Date().toISOString()}] ✅ Report generated successfully:`, data.fileName);
            console.log(`[${new Date().toISOString()}] 🔗 URL:`, data.fileUrl);
        } else {
            console.error(`[${new Date().toISOString()}] ❌ Failed to generate report:`, data.message);
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] 💥 Error triggering report:`, error.message);
    }
}

triggerReport();
