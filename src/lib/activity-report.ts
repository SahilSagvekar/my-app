// lib/activity-report.ts
import { prisma } from './prisma';
import { format, startOfDay, endOfDay, addHours, subHours } from 'date-fns';
import { uploadBufferToS3 } from './s3';

/**
 * Generates a daily activity report for employees (excluding Admin and Client roles)
 * Period: Start of day to 7 PM USA Time (EST/EDT)
 */
export async function generateDailyActivityReport(targetDate: Date = new Date()) {
    try {
        // 1. Calculate the time range in EST (UTC-5)
        // 7 PM EST on targetDate
        // Start of day EST = 05:00 UTC (assuming no DST for simplicity, or 04:00 if DST)
        // To be precise, we should assume the server runs in UTC and we offsets.

        // USA Eastern Time is typically UTC-5 (EST) or UTC-4 (EDT)
        // Let's assume EST (UTC-5) for now as a baseline.
        const estOffset = 5;

        // Target date start of day in EST converted to UTC
        const estStartOfDay = startOfDay(targetDate);
        const utcStartRange = addHours(estStartOfDay, estOffset);

        // 7 PM EST on target date converted to UTC
        const estEndTime = addHours(estStartOfDay, 19);
        const utcEndRange = addHours(estEndTime, estOffset);

        console.log(`📊 Generating report for range (UTC): ${utcStartRange.toISOString()} to ${utcEndRange.toISOString()}`);

        // 2. Fetch Audit Logs
        const auditLogs = await prisma.auditLog.findMany({
            where: {
                timestamp: {
                    gte: utcStartRange,
                    lte: utcEndRange,
                },
                User: {
                    role: {
                        notIn: ['admin', 'client']
                    }
                }
            },
            include: {
                User: true
            },
            orderBy: {
                timestamp: 'asc'
            }
        });

        if (auditLogs.length === 0) {
            console.log("ℹ️ No activity logs found for this period.");
            return null;
        }

        // 3. Transform to CSV
        const headers = ["Timestamp (UTC)", "Employee Name", "Role", "Action", "Details", "Entity", "Entity ID"];
        const rows = auditLogs.map(log => [
            log.timestamp.toISOString(),
            log.User?.name || 'Unknown',
            log.User?.role || 'N/A',
            log.action,
            log.details || '',
            log.entity || '',
            log.entityId || ''
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        // 4. Save report
        const fileName = `Daily_Activity_Report_${format(targetDate, 'yyyy-MM-dd')}_7PM_EST.csv`;
        const buffer = Buffer.from(csvContent);

        // Upload to S3
        const uploadResult = await uploadBufferToS3({
            buffer,
            filename: fileName,
            folderPrefix: 'reports/daily-activity/',
            mimeType: 'text/csv'
        });

        // 5. Record in database
        const report = await prisma.activityReport.create({
            data: {
                fileName,
                fileUrl: uploadResult.url,
                reportDate: targetDate,
                metadata: {
                    logCount: auditLogs.length,
                    startTimeRange: utcStartRange.toISOString(),
                    endTimeRange: utcEndRange.toISOString()
                }
            }
        });

        // 6. Send Email Notification to Eric
        const { sendActivityReportEmail } = await import('./email');
        await sendActivityReportEmail(uploadResult.url, targetDate, auditLogs.length);

        console.log(`✅ Report generated successfully: ${fileName}`);
        return report;

    } catch (error) {
        console.error("❌ Failed to generate activity report:", error);
        throw error;
    }
}
