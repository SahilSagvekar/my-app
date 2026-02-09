// lib/activity-report.ts
import { prisma } from './prisma';
import { format, startOfDay, addHours, subSeconds } from 'date-fns';
import { uploadBufferToS3 } from './s3';

interface ReportOptions {
    targetDate?: Date;
    sendEmail?: boolean; // Only send email when triggered by cron job
}

/**
 * Generates a daily activity report for employees and an executive summary for management.
 * Period: Start of day to 7 PM USA Time (EST/EDT)
 * @param options.targetDate - The date to generate the report for (default: today)
 * @param options.sendEmail - Whether to send the email notification (default: false)
 */
export async function generateDailyActivityReport(options: ReportOptions = {}) {
    // 🔥 FIX: If this runs exactly at 7 PM EST (which is midnight UTC next day), 
    // we need to make sure we target the day that just finished.
    let { targetDate = subSeconds(new Date(), 60), sendEmail = false } = options;

    try {
        // 1. Calculate the time range in EST (UTC-5)
        const estOffset = 5;
        const estStartOfDay = startOfDay(targetDate);
        const utcStartRange = addHours(estStartOfDay, estOffset);

        // 7 PM EST on target date converted to UTC
        const estEndTime = addHours(estStartOfDay, 19);
        const utcEndRange = addHours(estEndTime, estOffset);

        console.log(`📊 Generating report for range (UTC): ${utcStartRange.toISOString()} to ${utcEndRange.toISOString()}`);

        // 2. Fetch ALL relevant Audit Logs for the summary and detailed report
        // We include clients now because the boss wants to see their approvals/rejections
        const auditLogs = await prisma.auditLog.findMany({
            where: {
                timestamp: {
                    gte: utcStartRange,
                    lte: utcEndRange,
                },
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

        // 3. Separate logs for Employee Detailed Report (Excluding Admin and Client as per original requirement)
        const employeeLogs = auditLogs.filter(log =>
            log.User && !['admin'].includes(log.User.role as string)
        );

        // 4. Aggregate stats for the "Executive Summary" (Simplified)
        const userStats: Record<number, any> = {};

        auditLogs.forEach(log => {
            if (!log.userId || !log.User) return;

            // We want to track Editor work, QC work, and Client work
            const userId = log.userId;
            if (!userStats[userId]) {
                userStats[userId] = {
                    userName: log.User.name || 'Unknown',
                    role: log.User.role || 'N/A',
                    inProgress: 0,
                    readyForQc: 0,
                    approved: 0,
                    rejected: 0,
                    clientApproved: 0,
                    clientRejected: 0
                };
            }

            const stats = userStats[userId];
            const metadata = log.metadata as any;
            const newStatus = metadata?.newStatus;
            const role = log.User.role?.toLowerCase();

            // Logic to catch status changes
            if (log.action === 'TASK_UPDATED' || log.action === 'TASK_STATUS_CHANGED') {
                if (newStatus === 'IN_PROGRESS') stats.inProgress++;
                if (newStatus === 'READY_FOR_QC') stats.readyForQc++;

                // QC Role actions
                if (role === 'qc') {
                    if (newStatus === 'COMPLETED' || newStatus === 'CLIENT_REVIEW') stats.approved++;
                    if (newStatus === 'REJECTED') stats.rejected++;
                }

                // Client Role actions
                if (role === 'client') {
                    if (newStatus === 'COMPLETED') stats.clientApproved++;
                    if (newStatus === 'REJECTED') stats.clientRejected++;
                }
            }
        });

        // Filter out users who didn't actually do any of the tracked "Executive" actions
        const statsArray = Object.values(userStats).filter((u: any) =>
            (u.inProgress + u.readyForQc + u.approved + u.rejected + u.clientApproved + u.clientRejected) > 0
        );

        // 5. Transform detailed employee logs to CSV
        const headers = ["Timestamp (UTC)", "Employee Name", "Role", "Action", "Details", "Entity", "Entity ID"];
        const rows = employeeLogs.map(log => [
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

        // 6. Generate Executive Summary CSV
        const summaryHeaders = ["Name", "Role", "Started Tasks", "Sent to QC", "QC Approved", "QC Rejected", "Client Approved", "Client Revisions"];
        const summaryRows = statsArray.map(u => [
            u.userName,
            u.role,
            u.inProgress,
            u.readyForQc,
            u.approved,
            u.rejected,
            u.clientApproved,
            u.clientRejected
        ]);

        const summaryCsvContent = [
            summaryHeaders.join(","),
            ...summaryRows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const summaryFileName = `Executive_Summary_${format(targetDate, 'yyyy-MM-dd')}.csv`;
        const summaryBuffer = Buffer.from(summaryCsvContent);

        const summaryUpload = await uploadBufferToS3({
            buffer: summaryBuffer,
            filename: summaryFileName,
            folderPrefix: 'reports/executive-summaries/',
            mimeType: 'text/csv'
        });

        // 7. Save detailed report to S3
        const fileName = `Detailed_Activity_Report_${format(targetDate, 'yyyy-MM-dd')}_7PM_EST.csv`;
        const buffer = Buffer.from(csvContent);

        const uploadResult = await uploadBufferToS3({
            buffer,
            filename: fileName,
            folderPrefix: 'reports/daily-activity/',
            mimeType: 'text/csv'
        });

        // 8. Record in database (linking both)
        const report = await prisma.activityReport.create({
            data: {
                fileName,
                fileUrl: uploadResult.url,
                reportDate: targetDate,
                metadata: {
                    logCount: auditLogs.length,
                    employeeLogCount: employeeLogs.length,
                    summary: statsArray,
                    summaryFileUrl: summaryUpload.url
                }
            }
        });

        // 9. Only send email if triggered by cron job (sendEmail = true)
        if (sendEmail) {
            // Generate a SIGNED long-lasting URL for the email (so its one-click for the boss)
            const { generateSignedUrl } = await import('./s3');
            const longLastingSignedUrl = await generateSignedUrl(summaryUpload.key, 604800); // 7 days

            // Send Email with Summary Attachment Link
            const { sendExecutiveSummaryReportEmail } = await import('./email');
            await sendExecutiveSummaryReportEmail({
                date: targetDate,
                stats: statsArray,
                summaryUrl: longLastingSignedUrl // Now its a one-click signed link
            });
            console.log(`📧 Email sent to Eric@e8productions.com`);
        } else {
            console.log(`📧 Email skipped (manual generation)`);
        }

        console.log(`✅ Reports generated. Detailed: ${fileName}, Summary: ${summaryFileName}`);
        return report;

    } catch (error) {
        console.error("❌ Failed to generate activity report:", error);
        throw error;
    }
}
