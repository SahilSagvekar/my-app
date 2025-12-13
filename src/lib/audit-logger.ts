// lib/audit-logger.ts
import { prisma } from './prisma';
import type { NextRequest } from 'next/server';

export interface AuditLogData {
  userId?: number;
  action: string;
  entity?: string;
  entityId?: string | number;
  details?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(data: AuditLogData) {
  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId?.toString(),
        details: data.details,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        timestamp: new Date()
      }
    });
    
    return auditLog;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should never break the main operation
    return null;
  }
}

/**
 * Extract request metadata for audit logging
 */
export function getRequestMetadata(req: NextRequest) {
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                    req.headers.get('x-real-ip') || 
                    'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  return { ipAddress, userAgent };
}

/**
 * Audit log action types - use these constants for consistency
 */
export const AuditAction = {
  // User actions
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  
  // Task actions
  TASK_CREATED: 'TASK_CREATED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_DELETED: 'TASK_DELETED',
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_QC_APPROVED: 'TASK_QC_APPROVED',
  TASK_QC_REJECTED: 'TASK_QC_REJECTED',
  
  // Client actions
  CLIENT_CREATED: 'CLIENT_CREATED',
  CLIENT_UPDATED: 'CLIENT_UPDATED',
  CLIENT_DELETED: 'CLIENT_DELETED',
  CLIENT_APPROVED: 'CLIENT_APPROVED',
  CLIENT_REJECTED: 'CLIENT_REJECTED',
  
  // Leave actions
  LEAVE_REQUESTED: 'LEAVE_REQUESTED',
  LEAVE_APPROVED: 'LEAVE_APPROVED',
  LEAVE_REJECTED: 'LEAVE_REJECTED',
  
  // Payroll actions
  PAYROLL_GENERATED: 'PAYROLL_GENERATED',
  PAYROLL_PAID: 'PAYROLL_PAID',
  
  // File actions
  FILE_UPLOADED: 'FILE_UPLOADED',
  FILE_DELETED: 'FILE_DELETED',
  
  // System actions
  DEADLINE_APPROACHING: 'DEADLINE_APPROACHING',
  DEADLINE_OVERDUE: 'DEADLINE_OVERDUE',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
} as const;

export type AuditActionType = typeof AuditAction[keyof typeof AuditAction];