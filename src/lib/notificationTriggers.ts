import { createNotification } from './notificationService';

// Task Notifications
export async function notifyTaskAssigned(userId: number, taskTitle: string, taskId: string, assignedByName: string) {
  await createNotification(
    userId,
    'task_assigned',
    'New Task Assigned',
    `${assignedByName} assigned you to: ${taskTitle}`,
    { taskId, link: `/tasks/${taskId}` }
  );
}

export async function notifyTaskStatusChanged(userId: number, taskTitle: string, newStatus: string, taskId: string) {
  await createNotification(
    userId,
    'task_update',
    'Task Status Updated',
    `${taskTitle} status changed to: ${newStatus}`,
    { taskId, status: newStatus, link: `/tasks/${taskId}` }
  );
}

export async function notifyTaskDeadline(userId: number, taskTitle: string, taskId: string, hoursLeft: number) {
  await createNotification(
    userId,
    'task_deadline',
    'Task Deadline Approaching',
    `${taskTitle} is due in ${hoursLeft} hours`,
    { taskId, link: `/tasks/${taskId}` }
  );
}

// Client Review Notifications
export async function notifyClientReviewSubmitted(userIds: number[], clientName: string, projectName: string, reviewId: string) {
  for (const userId of userIds) {
    await createNotification(
      userId,
      'client_feedback',
      'Client Review Submitted',
      `${clientName} submitted a review for ${projectName}`,
      { reviewId, link: `/reviews/${reviewId}` }
    );
  }
}

export async function notifyClientReviewApproved(userId: number, projectName: string) {
  await createNotification(
    userId,
    'qc_approval',
    'Content Approved',
    `Your work on ${projectName} has been approved by the client`,
    { project: projectName }
  );
}

// QC Notifications
export async function notifyQCApproved(userId: number, taskTitle: string, taskId: string, qcName: string) {
  await createNotification(
    userId,
    'qc_approval',
    'QC Approved',
    `${qcName} approved your work on: ${taskTitle}`,
    { taskId, link: `/tasks/${taskId}` }
  );
}

export async function notifyQCRejected(userId: number, taskTitle: string, taskId: string, qcName: string, reason: string) {
  await createNotification(
    userId,
    'system_alert',
    'QC Rejected - Revisions Needed',
    `${qcName} requested revisions for ${taskTitle}: ${reason}`,
    { taskId, reason, link: `/tasks/${taskId}` }
  );
}

export async function notifyReadyForQC(qcUserId: number, taskTitle: string, taskId: string, editorName: string) {
  await createNotification(
    qcUserId,
    'review_queue',
    'New Task Ready for QC',
    `${editorName} submitted ${taskTitle} for quality check`,
    { taskId, link: `/tasks/${taskId}` }
  );
}

// File Upload Notifications
export async function notifyFileUploaded(userIds: number[], fileName: string, taskTitle: string, taskId: string, uploaderName: string) {
  for (const userId of userIds) {
    await createNotification(
      userId,
      'content_ready',
      'New File Uploaded',
      `${uploaderName} uploaded ${fileName} to ${taskTitle}`,
      { taskId, fileName, link: `/tasks/${taskId}` }
    );
  }
}

// Leave Request Notifications
export async function notifyLeaveRequestSubmitted(adminUserIds: number[], employeeName: string, leaveId: number, startDate: string, endDate: string) {
  for (const userId of adminUserIds) {
    await createNotification(
      userId,
      'approval_request',
      'New Leave Request',
      `${employeeName} requested leave from ${startDate} to ${endDate}`,
      { leaveId, link: `/admin/leaves` }
    );
  }
}

export async function notifyLeaveRequestApproved(userId: number, startDate: string, endDate: string) {
  await createNotification(
    userId,
    'qc_approval',
    'Leave Request Approved',
    `Your leave request from ${startDate} to ${endDate} has been approved`,
    { link: `/profile/leaves` }
  );
}

export async function notifyLeaveRequestRejected(userId: number, startDate: string, endDate: string, reason?: string) {
  await createNotification(
    userId,
    'system_alert',
    'Leave Request Rejected',
    `Your leave request from ${startDate} to ${endDate} was rejected${reason ? `: ${reason}` : ''}`,
    { link: `/profile/leaves` }
  );
}

// Schedule Notifications
export async function notifyScheduleConflict(userIds: number[], taskTitle: string, conflictReason: string) {
  for (const userId of userIds) {
    await createNotification(
      userId,
      'schedule_conflict',
      'Schedule Conflict',
      `${taskTitle}: ${conflictReason}`,
      { }
    );
  }
}

// Mention Notifications
export async function notifyMentioned(userId: number, mentionedBy: string, context: string, link: string) {
  await createNotification(
    userId,
    'mention',
    'You Were Mentioned',
    `${mentionedBy} mentioned you in ${context}`,
    { link }
  );
}

// Team Update Notifications
export async function notifyTeamUpdate(userIds: number[], title: string, message: string) {
  for (const userId of userIds) {
    await createNotification(
      userId,
      'team_update',
      title,
      message,
      { }
    );
  }
}

// Employee Management Notifications
export async function notifyRoleChanged(userId: number, newRole: string, changedBy: string) {
  await createNotification(
    userId,
    'user_management',
    'Role Updated',
    `${changedBy} updated your role to: ${newRole}`,
    { role: newRole }
  );
}

export async function notifyEmployeeStatusChanged(userId: number, newStatus: string) {
  await createNotification(
    userId,
    'user_management',
    'Employment Status Updated',
    `Your employment status has been changed to: ${newStatus}`,
    { status: newStatus }
  );
}