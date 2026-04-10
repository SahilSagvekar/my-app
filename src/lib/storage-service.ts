// src/lib/storage-service.ts
import { prisma } from '@/lib/prisma';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getS3, BUCKET } from '@/lib/s3';
import { sendStorageAlertEmail } from '@/lib/email';

const s3Client = getS3();

// 3 TB in bytes
export const DEFAULT_STORAGE_LIMIT = 3 * 1024 * 1024 * 1024 * 1024; // 3298534883328

// Alert thresholds
export const ALERT_THRESHOLD_90 = 0.90;
export const ALERT_THRESHOLD_95 = 0.95;

export interface StorageInfo {
  used: number;          // bytes
  limit: number;         // bytes
  usedFormatted: string;
  limitFormatted: string;
  percentage: number;
  isAtLimit: boolean;
  isNearLimit: boolean;  // 90%+
  isCritical: boolean;   // 95%+
}

/**
 * Format bytes to human readable string (GB/TB focused)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 GB';
  
  const k = 1024;
  const gb = bytes / (k * k * k);
  const tb = bytes / (k * k * k * k);
  
  // Show in TB if >= 1 TB
  if (tb >= 1) {
    return tb.toFixed(2) + ' TB';
  }
  
  // Show in GB otherwise
  return gb.toFixed(2) + ' GB';
}

/**
 * Calculate storage used by a client's raw-footage folder in S3
 */
export async function calculateClientRawFootageStorage(clientId: string): Promise<number> {
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { companyName: true, name: true }
    });

    if (!client) {
      console.error(`Client not found: ${clientId}`);
      return 0;
    }

    const folderName = client.companyName || client.name;
    const prefix = `${folderName}/raw-footage/`;
    
    let totalSize = 0;
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const response = await s3Client.send(command);
      
      if (response.Contents) {
        for (const obj of response.Contents) {
          totalSize += obj.Size || 0;
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return totalSize;
  } catch (error) {
    console.error('Error calculating storage:', error);
    return 0;
  }
}

/**
 * Get storage info for a client - always calculates from S3
 */
export async function getClientStorageInfo(clientId: string): Promise<StorageInfo> {
  try {
    // Always calculate actual storage from S3
    const actualUsed = await calculateClientRawFootageStorage(clientId);
    const limit = DEFAULT_STORAGE_LIMIT;
    const percentage = limit > 0 ? (actualUsed / limit) * 100 : 0;

    return {
      used: actualUsed,
      limit,
      usedFormatted: formatBytes(actualUsed),
      limitFormatted: formatBytes(limit),
      percentage: Math.min(percentage, 100),
      isAtLimit: percentage >= 100,
      isNearLimit: percentage >= 90,
      isCritical: percentage >= 95,
    };
  } catch (error: unknown) {
    console.error('Storage info fetch error:', error);
    return {
      used: 0,
      limit: DEFAULT_STORAGE_LIMIT,
      usedFormatted: '0 GB',
      limitFormatted: formatBytes(DEFAULT_STORAGE_LIMIT),
      percentage: 0,
      isAtLimit: false,
      isNearLimit: false,
      isCritical: false,
    };
  }
}

/**
 * Update client storage after upload
 */
export async function updateClientStorageAfterUpload(
  clientId: string, 
  fileSize: number
): Promise<{ allowed: boolean; storageInfo: StorageInfo; message?: string }> {
  
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      companyName: true,
      email: true,
      emails: true,
      rawFootageStorageUsed: true,
      rawFootageStorageLimit: true,
      storageAlert90Sent: true,
      storageAlert95Sent: true,
    }
  });

  if (!client) {
    return {
      allowed: false,
      storageInfo: {
        used: 0,
        limit: DEFAULT_STORAGE_LIMIT,
        usedFormatted: '0 GB',
        limitFormatted: formatBytes(DEFAULT_STORAGE_LIMIT),
        percentage: 0,
        isAtLimit: false,
        isNearLimit: false,
        isCritical: false,
      },
      message: 'Client not found'
    };
  }

  const currentUsed = Number(client.rawFootageStorageUsed || 0);
  const limit = Number(client.rawFootageStorageLimit || DEFAULT_STORAGE_LIMIT);
  const newUsed = currentUsed + fileSize;
  const newPercentage = (newUsed / limit) * 100;

  // Check if upload would exceed limit
  if (newUsed > limit) {
    return {
      allowed: false,
      storageInfo: {
        used: currentUsed,
        limit,
        usedFormatted: formatBytes(currentUsed),
        limitFormatted: formatBytes(limit),
        percentage: Math.min((currentUsed / limit) * 100, 100),
        isAtLimit: true,
        isNearLimit: true,
        isCritical: true,
      },
      message: 'Storage limit exceeded. Please upgrade your plan to continue uploading.'
    };
  }

  // Update storage used
  await prisma.client.update({
    where: { id: clientId },
    data: {
      rawFootageStorageUsed: newUsed,
    }
  });

  // Check and send alerts
  const emails = [client.email, ...(client.emails || [])].filter(Boolean);
  const clientName = client.companyName || client.name;

  // 95% alert
  if (newPercentage >= 95 && !client.storageAlert95Sent) {
    await prisma.client.update({
      where: { id: clientId },
      data: { storageAlert95Sent: true }
    });
    
    // Send 95% alert email
    await sendStorageAlertEmail({
      to: emails,
      clientName,
      percentage: 95,
      used: formatBytes(newUsed),
      limit: formatBytes(limit),
    });
    
    console.log(`📧 Sent 95% storage alert to ${clientName}`);
  }
  // 90% alert
  else if (newPercentage >= 90 && !client.storageAlert90Sent) {
    await prisma.client.update({
      where: { id: clientId },
      data: { storageAlert90Sent: true }
    });
    
    // Send 90% alert email
    await sendStorageAlertEmail({
      to: emails,
      clientName,
      percentage: 90,
      used: formatBytes(newUsed),
      limit: formatBytes(limit),
    });
    
    console.log(`📧 Sent 90% storage alert to ${clientName}`);
  }

  return {
    allowed: true,
    storageInfo: {
      used: newUsed,
      limit,
      usedFormatted: formatBytes(newUsed),
      limitFormatted: formatBytes(limit),
      percentage: Math.min(newPercentage, 100),
      isAtLimit: newPercentage >= 100,
      isNearLimit: newPercentage >= 90,
      isCritical: newPercentage >= 95,
    }
  };
}

/**
 * Update storage after file deletion
 */
export async function updateClientStorageAfterDelete(
  clientId: string, 
  fileSize: number
): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { rawFootageStorageUsed: true }
  });

  const currentUsed = Number(client?.rawFootageStorageUsed || 0);
  const newUsed = Math.max(0, currentUsed - fileSize);

  await prisma.client.update({
    where: { id: clientId },
    data: {
      rawFootageStorageUsed: newUsed,
      // Reset alerts if storage drops below thresholds
      storageAlert90Sent: newUsed >= (DEFAULT_STORAGE_LIMIT * 0.90),
      storageAlert95Sent: newUsed >= (DEFAULT_STORAGE_LIMIT * 0.95),
    }
  });
}

/**
 * Recalculate storage from S3 (for sync/correction)
 */
export async function recalculateClientStorage(clientId: string): Promise<StorageInfo> {
  try {
    const actualUsed = await calculateClientRawFootageStorage(clientId);
    
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true }
    });
    
    if (!client) {
      return {
        used: 0,
        limit: DEFAULT_STORAGE_LIMIT,
        usedFormatted: '0 GB',
        limitFormatted: formatBytes(DEFAULT_STORAGE_LIMIT),
        percentage: 0,
        isAtLimit: false,
        isNearLimit: false,
        isCritical: false,
      };
    }

    const limit = DEFAULT_STORAGE_LIMIT;
    const percentage = (actualUsed / limit) * 100;

    // Try to update storage fields if they exist
    try {
      await prisma.client.update({
        where: { id: clientId },
        data: {
          rawFootageStorageUsed: actualUsed,
          storageLastCalculated: new Date(),
          storageAlert90Sent: percentage >= 90,
          storageAlert95Sent: percentage >= 95,
        }
      });
    } catch {
      // Fields don't exist yet - that's okay, just return the calculated values
      console.warn('Could not update storage fields (they may not exist yet)');
    }

    return {
      used: actualUsed,
      limit,
      usedFormatted: formatBytes(actualUsed),
      limitFormatted: formatBytes(limit),
      percentage: Math.min(percentage, 100),
      isAtLimit: percentage >= 100,
      isNearLimit: percentage >= 90,
      isCritical: percentage >= 95,
    };
  } catch (error) {
    console.error('Error recalculating storage:', error);
    return {
      used: 0,
      limit: DEFAULT_STORAGE_LIMIT,
      usedFormatted: '0 GB',
      limitFormatted: formatBytes(DEFAULT_STORAGE_LIMIT),
      percentage: 0,
      isAtLimit: false,
      isNearLimit: false,
      isCritical: false,
    };
  }
}