// src/lib/video-stream.ts
// Utility to generate streaming URLs for video files

import { isObjectStorageUrl } from "@/lib/s3";

/**
 * Determines the best streaming URL for a video file.
 * 
 * - S3/R2-hosted files → uses `/api/files/[id]/stream` proxy (supports Range requests)
 * - Google Drive / YouTube / other URLs → passes through unchanged
 * 
 * @param fileId - The TaskFile ID from the database
 * @param fileUrl - The original file URL
 * @returns The optimal URL to use for video playback
 */
export function getStreamingUrl(fileId: string | undefined, fileUrl: string): string {
    if (!fileUrl) return '';

    if (isObjectStorageUrl(fileUrl) && fileId) {
        return `/api/files/${fileId}/stream`;
    }

    return fileUrl;
}

/**
 * Checks if a URL is an S3/R2-hosted file that can benefit from streaming.
 */
export function isStreamableFile(url: string): boolean {
    if (!url) return false;
    return isObjectStorageUrl(url);
}
