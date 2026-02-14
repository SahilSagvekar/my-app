// lib/daily-summary-report.ts
// Generates a daily summary of what each team member did (12 AM – 7 PM EST)
// Includes: task status changes, login/logout times, client activity
import { prisma } from './prisma';
import { format, subSeconds } from 'date-fns';

interface DailySummaryOptions {
    targetDate?: Date;
    sendEmail?: boolean;
}

interface LoginLogoutEvent {
    action: 'login' | 'logout';
    time: Date;
    location?: string;
}

interface UserDailySummary {
    userId: number;
    userName: string;
    role: string;
    // Editor metrics
    tasksMovedToInProgress: number;
    tasksMovedToReadyForQC: number;
    // QC metrics
    tasksQCApproved: number;       // QC moved to COMPLETED or CLIENT_REVIEW
    tasksQCRejected: number;       // QC moved to REJECTED
    // Scheduler metrics
    tasksScheduled: number;        // Moved to SCHEDULED
    // Client metrics
    tasksClientApproved: number;   // Client moved to COMPLETED
    tasksClientRejected: number;   // Client moved to REJECTED
    // Other metrics
    filesUploaded: number;
    tasksCreated: number;
    // Login/Logout
    loginLogoutEvents: LoginLogoutEvent[];
    // General
    totalActions: number;
    taskDetails: {
        action: string;
        taskTitle: string;
        taskId: string;
        previousStatus?: string;
        newStatus?: string;
        timestamp: Date;
    }[];
}

export interface DailySummaryReport {
    date: string;
    periodStart: string;
    periodEnd: string;
    users: UserDailySummary[];
    totalTasksMoved: number;
    totalTeamMembers: number;
}

/**
 * Generates the Daily Summary Report
 * Period: 12:00 AM to 7:00 PM EST on the given day
 */
export async function generateDailySummaryReport(options: DailySummaryOptions = {}): Promise<DailySummaryReport | null> {
    const { targetDate = subSeconds(new Date(), 60), sendEmail = false } = options;

    console.log(`\n📊 [Daily Summary] Generating report for ${format(targetDate, 'yyyy-MM-dd')}`);

    try {
        // === Calculate EST time window (timezone-safe) ===
        // Step 1: Get today's date in America/New_York timezone (works on any server timezone)
        const estDateStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD

        // Step 2: Determine if EST (-05:00) or EDT (-04:00) is active
        // Create a reference UTC date at noon on this day, then check what hour it is in EST
        const refDate = new Date(`${estDateStr}T12:00:00Z`);
        const estHourStr = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            hour12: false,
        }).format(refDate);
        const estHour = parseInt(estHourStr === '24' ? '0' : estHourStr);
        const offsetHours = 12 - estHour; // 5 for EST, 4 for EDT
        const offsetStr = `-${String(offsetHours).padStart(2, '0')}:00`; // "-05:00" or "-04:00"

        // Step 3: Construct exact UTC boundaries using ISO 8601 with timezone offset
        // JS Date constructor correctly converts these to UTC internally
        const utcStartRange = new Date(`${estDateStr}T00:00:00${offsetStr}`); // 12 AM EST/EDT
        const utcEndRange = new Date(`${estDateStr}T19:00:00${offsetStr}`);   // 7 PM EST/EDT

        console.log(`⏰ Report Date (EST): ${estDateStr}, Offset: UTC${offsetStr}`);
        console.log(`⏰ Report Window (EST): 12:00 AM → 7:00 PM`);
        console.log(`⏰ Report Window (UTC): ${utcStartRange.toISOString()} → ${utcEndRange.toISOString()}`);

        // === 1. Fetch task-related audit logs (broad query to catch everything) ===
        const taskAuditLogs = await prisma.auditLog.findMany({
            where: {
                timestamp: {
                    gte: utcStartRange,
                    lte: utcEndRange,
                },
                action: {
                    in: ['TASK_UPDATED', 'TASK_STATUS_CHANGED', 'TASK_COMPLETED', 'TASK_QC_APPROVED', 'TASK_QC_REJECTED', 'TASK_CREATED', 'TASK_ASSIGNED', 'FILE_UPLOADED']
                }
            },
            include: {
                User: true
            },
            orderBy: {
                timestamp: 'asc'
            }
        });

        console.log(`🔍 Found ${taskAuditLogs.length} task-related audit logs`);

        // === 2. Fetch login/logout audit logs ===
        const loginLogoutLogs = await prisma.auditLog.findMany({
            where: {
                timestamp: {
                    gte: utcStartRange,
                    lte: utcEndRange,
                },
                action: {
                    in: ['USER_LOGIN', 'USER_LOGOUT']
                }
            },
            include: {
                User: true
            },
            orderBy: {
                timestamp: 'asc'
            }
        });

        console.log(`🔐 Found ${loginLogoutLogs.length} login/logout logs`);

        // === 3. Also fetch tasks that were marked as SCHEDULED in this window ===
        // (fallback in case audit log wasn't created by older code)
        const scheduledTasks = await prisma.task.findMany({
            where: {
                status: 'SCHEDULED',
                updatedAt: {
                    gte: utcStartRange,
                    lte: utcEndRange,
                }
            },
            include: {
                user: true, // assignedTo user
            }
        });

        console.log(`📅 Found ${scheduledTasks.length} tasks scheduled in this window`);

        // === 4. Build per-user summary ===
        const userMap: Record<number, UserDailySummary> = {};

        const getOrCreateUser = (userId: number, userName: string, role: string): UserDailySummary => {
            if (!userMap[userId]) {
                userMap[userId] = {
                    userId,
                    userName,
                    role,
                    tasksMovedToInProgress: 0,
                    tasksMovedToReadyForQC: 0,
                    tasksQCApproved: 0,
                    tasksQCRejected: 0,
                    tasksScheduled: 0,
                    tasksClientApproved: 0,
                    tasksClientRejected: 0,
                    filesUploaded: 0,
                    tasksCreated: 0,
                    loginLogoutEvents: [],
                    totalActions: 0,
                    taskDetails: [],
                };
            }
            return userMap[userId];
        };

        // === Process login/logout logs ===
        for (const log of loginLogoutLogs) {
            if (!log.userId || !log.User) continue;

            const userSummary = getOrCreateUser(log.userId, log.User.name || 'Unknown', log.User.role || 'N/A');
            const metadata = log.metadata as any;

            userSummary.loginLogoutEvents.push({
                action: log.action === 'USER_LOGIN' ? 'login' : 'logout',
                time: log.timestamp,
                location: metadata?.location
                    ? `${metadata.location.city || ''}, ${metadata.location.region || ''}, ${metadata.location.country || ''}`
                    : log.details || undefined,
            });
        }

        // === Process task audit logs ===
        for (const log of taskAuditLogs) {
            if (!log.userId || !log.User) continue;

            const metadata = log.metadata as any;
            const newStatus = metadata?.newStatus;
            const previousStatus = metadata?.previousStatus;
            const role = log.User.role?.toLowerCase() || '';
            const userSummary = getOrCreateUser(log.userId, log.User.name || 'Unknown', log.User.role || 'N/A');

            userSummary.totalActions++;

            // Track task details
            const taskDetail = {
                action: log.action,
                taskTitle: metadata?.taskTitle || log.details || `Task ${log.entityId}`,
                taskId: log.entityId || '',
                previousStatus,
                newStatus,
                timestamp: log.timestamp,
            };

            // === Editor actions ===
            if (newStatus === 'IN_PROGRESS') {
                userSummary.tasksMovedToInProgress++;
                taskDetail.action = 'Moved to In Progress';
            }

            if (newStatus === 'READY_FOR_QC') {
                userSummary.tasksMovedToReadyForQC++;
                taskDetail.action = 'Sent to QC';
            }

            // === QC actions ===
            if (role === 'qc') {
                if (newStatus === 'COMPLETED' || newStatus === 'CLIENT_REVIEW') {
                    userSummary.tasksQCApproved++;
                    taskDetail.action = 'QC Approved';
                }
                if (newStatus === 'REJECTED') {
                    userSummary.tasksQCRejected++;
                    taskDetail.action = 'QC Rejected';
                }
            }

            // === Client actions ===
            if (role === 'client') {
                if (newStatus === 'COMPLETED') {
                    userSummary.tasksClientApproved++;
                    taskDetail.action = 'Client Approved';
                }
                if (newStatus === 'REJECTED') {
                    userSummary.tasksClientRejected++;
                    taskDetail.action = 'Client Rejected';
                }
            }

            // === Scheduler actions (via audit log) ===
            if (newStatus === 'SCHEDULED' && (role === 'scheduler' || role === 'admin' || role === 'manager')) {
                userSummary.tasksScheduled++;
                taskDetail.action = 'Scheduled/Posted';
            }

            // === File uploads ===
            if (log.action === 'FILE_UPLOADED') {
                userSummary.filesUploaded++;
                taskDetail.action = 'Uploaded File';
            }

            // === Task creation ===
            if (log.action === 'TASK_CREATED') {
                userSummary.tasksCreated++;
                taskDetail.action = 'Created Task';
            }

            userSummary.taskDetails.push(taskDetail);
        }

        // Process scheduled tasks (catch the ones done via mark-scheduled endpoint before audit log was added)
        for (const task of scheduledTasks) {
            if (task.scheduler) {
                const schedulerUser = await prisma.user.findUnique({
                    where: { id: task.scheduler }
                });

                if (schedulerUser) {
                    const userSummary = getOrCreateUser(
                        schedulerUser.id,
                        schedulerUser.name || 'Unknown',
                        schedulerUser.role || 'scheduler'
                    );

                    // Only count if not already counted via audit log
                    const alreadyCounted = userSummary.taskDetails.some(
                        d => d.taskId === task.id && d.action === 'Scheduled/Posted'
                    );

                    if (!alreadyCounted) {
                        userSummary.tasksScheduled++;
                        userSummary.totalActions++;
                        userSummary.taskDetails.push({
                            action: 'Scheduled/Posted',
                            taskTitle: task.title || task.description || `Task ${task.id}`,
                            taskId: task.id,
                            previousStatus: undefined,
                            newStatus: 'SCHEDULED',
                            timestamp: task.updatedAt,
                        });
                    }
                }
            }
        }

        // Filter users — include if they have any task activity OR login/logout events
        const activeUsers = Object.values(userMap).filter(u =>
            u.tasksMovedToInProgress > 0 ||
            u.tasksMovedToReadyForQC > 0 ||
            u.tasksQCApproved > 0 ||
            u.tasksQCRejected > 0 ||
            u.tasksScheduled > 0 ||
            u.tasksClientApproved > 0 ||
            u.tasksClientRejected > 0 ||
            u.filesUploaded > 0 ||
            u.tasksCreated > 0 ||
            u.loginLogoutEvents.length > 0
        );

        if (activeUsers.length === 0) {
            console.log('ℹ️ No task activity found for this period.');
            return null;
        }

        // === 5. Build the report ===
        const reportDate = format(targetDate, 'yyyy-MM-dd');
        const report: DailySummaryReport = {
            date: reportDate,
            periodStart: '12:00 AM EST',
            periodEnd: '7:00 PM EST',
            users: activeUsers,
            totalTasksMoved: activeUsers.reduce((acc, u) =>
                acc + u.tasksMovedToInProgress + u.tasksMovedToReadyForQC +
                u.tasksQCApproved + u.tasksQCRejected + u.tasksScheduled +
                u.tasksClientApproved + u.tasksClientRejected
                , 0),
            totalTeamMembers: activeUsers.length,
        };

        console.log(`✅ [Daily Summary] Report generated: ${report.totalTeamMembers} team members, ${report.totalTasksMoved} total actions`);

        // === 6. Generate CSV and upload to S3 ===
        let csvDownloadUrl: string | undefined;

        try {
            // --- CSV Section 1: Team Summary ---
            const summaryHeaders = ['Name', 'Role', 'Started / In Progress', 'Sent to QC', 'QC Approved', 'QC Rejected', 'Scheduled / Posted', 'Client Approved', 'Client Revisions', 'Files Uploaded', 'Tasks Created', 'Total Actions'];
            const summaryRows = activeUsers.map(u => [
                u.userName,
                u.role,
                u.tasksMovedToInProgress,
                u.tasksMovedToReadyForQC,
                u.tasksQCApproved,
                u.tasksQCRejected,
                u.tasksScheduled,
                u.tasksClientApproved,
                u.tasksClientRejected,
                u.filesUploaded,
                u.tasksCreated,
                u.totalActions,
            ]);

            // --- CSV Section 2: Login/Logout Activity ---
            const loginHeaders = ['Name', 'Role', 'Action', 'Time (EST)', 'Location'];
            const loginRows: any[][] = [];
            for (const u of activeUsers) {
                for (const evt of u.loginLogoutEvents) {
                    const timeStr = new Date(evt.time).toLocaleString('en-US', {
                        timeZone: 'America/New_York',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                    });
                    loginRows.push([
                        u.userName,
                        u.role,
                        evt.action === 'login' ? 'Logged In' : 'Logged Out',
                        timeStr + ' EST',
                        evt.location || '',
                    ]);
                }
            }

            // --- CSV Section 3: Detailed Task Activity ---
            const detailHeaders = ['Name', 'Role', 'Action', 'Task', 'Previous Status', 'New Status', 'Time (EST)'];
            const detailRows: any[][] = [];
            for (const u of activeUsers) {
                for (const d of u.taskDetails) {
                    const timeStr = new Date(d.timestamp).toLocaleString('en-US', {
                        timeZone: 'America/New_York',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                    });
                    detailRows.push([
                        u.userName,
                        u.role,
                        d.action,
                        d.taskTitle,
                        d.previousStatus || '',
                        d.newStatus || '',
                        timeStr + ' EST',
                    ]);
                }
            }

            // Helper to escape CSV values
            const escCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

            // Combine all sections into one CSV
            const csvLines: string[] = [];

            csvLines.push(`"Daily Team Summary Report - ${reportDate}"`);
            csvLines.push(`"Report Period: 12:00 AM to 7:00 PM EST"`);
            csvLines.push(`"Generated: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST"`);
            csvLines.push('');

            csvLines.push('"=== TEAM SUMMARY ==="');
            csvLines.push(summaryHeaders.map(escCsv).join(','));
            summaryRows.forEach(row => csvLines.push(row.map(escCsv).join(',')));
            csvLines.push('');

            if (loginRows.length > 0) {
                csvLines.push('"=== LOGIN / LOGOUT ACTIVITY ==="');
                csvLines.push(loginHeaders.map(escCsv).join(','));
                loginRows.forEach(row => csvLines.push(row.map(escCsv).join(',')));
                csvLines.push('');
            }

            if (detailRows.length > 0) {
                csvLines.push('"=== DETAILED TASK ACTIVITY ==="');
                csvLines.push(detailHeaders.map(escCsv).join(','));
                detailRows.forEach(row => csvLines.push(row.map(escCsv).join(',')));
            }

            const csvContent = csvLines.join('\n');
            const csvBuffer = Buffer.from(csvContent, 'utf-8');
            const csvFileName = `Daily_Team_Summary_${reportDate}.csv`;

            // Upload to S3
            const { uploadBufferToS3, generateSignedUrl } = await import('./s3');

            const uploadResult = await uploadBufferToS3({
                buffer: csvBuffer,
                filename: csvFileName,
                folderPrefix: 'reports/daily-summary/',
                mimeType: 'text/csv',
            });

            console.log(`📊 CSV uploaded to S3: ${uploadResult.url}`);

            // Generate a signed download URL (valid for 7 days)
            csvDownloadUrl = await generateSignedUrl(uploadResult.key, 604800);
            console.log(`🔗 Signed download URL generated (7-day expiry)`);

        } catch (s3Error) {
            console.error('⚠️ Failed to upload CSV to S3 (email will still be sent without download link):', s3Error);
        }

        // === 7. Send email if requested ===
        if (sendEmail) {
            console.log('📧 Sending daily summary email...');
            const { sendDailySummaryReportEmail } = await import('./email');
            await sendDailySummaryReportEmail(report, csvDownloadUrl);
            console.log('📧 Daily summary email sent!');
        }

        return report;

    } catch (error) {
        console.error('❌ [Daily Summary] Failed to generate report:', error);
        throw error;
    }
}
