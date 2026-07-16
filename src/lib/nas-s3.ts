// src/lib/nas-s3.ts
// S3 client pointed at the NAS's MinIO instance (reached over Tailscale).
// Mirrors the pattern in src/lib/s3.ts but targets a completely separate
// bucket/endpoint — the NAS is not R2, it's a self-hosted S3-compatible
// server running on the UGREEN NAS.
//
// env vars:
//   NAS_S3_ENDPOINT    = http://<nas-tailscale-ip>:9000
//   NAS_S3_ACCESS_KEY  = MinIO access key (root user for now — see note below)
//   NAS_S3_SECRET_KEY  = MinIO secret key
//   NAS_S3_BUCKET      = bucket name on the NAS, e.g. e8-nas-backup
//
// NOTE: currently configured with MinIO root credentials as a stopgap.
// Swap NAS_S3_ACCESS_KEY / NAS_S3_SECRET_KEY for a dedicated scoped
// access key once `mc admin accesskey create` is working — root creds
// in an app env var is not the long-term setup.

import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { S3ClientConfig } from '@aws-sdk/client-s3';

function getNasS3Config(): S3ClientConfig {
  return {
    region: 'us-east-1', // MinIO ignores region but the SDK requires one
    endpoint: process.env.NAS_S3_ENDPOINT!,
    forcePathStyle: true, // required for MinIO / any non-AWS S3-compatible endpoint
    credentials: {
      accessKeyId: process.env.NAS_S3_ACCESS_KEY!,
      secretAccessKey: process.env.NAS_S3_SECRET_KEY!,
    },
  };
}

let _nasS3: S3Client | null = null;

export function getNasS3(): S3Client {
  if (!_nasS3) {
    if (!process.env.NAS_S3_ENDPOINT) {
      throw new Error('NAS_S3_ENDPOINT is not set — cannot reach NAS MinIO instance');
    }
    _nasS3 = new S3Client(getNasS3Config());
  }
  return _nasS3;
}

export const NAS_BUCKET = process.env.NAS_S3_BUCKET || 'e8-nas-backup';

export interface NasHeadResult {
  ok: boolean;
  sizeBytes?: number;
  reason?: string;
}

/**
 * Real per-file check against the NAS's MinIO instance — a live API call,
 * not a self-reported flag. Replaces the old fs.existsSync() check that
 * required an NFS mount on the EC2 host.
 */
export async function headObjectOnNas(key: string): Promise<NasHeadResult> {
  try {
    const client = getNasS3();
    const result = await client.send(new HeadObjectCommand({
      Bucket: NAS_BUCKET,
      Key: key,
    }));
    return { ok: true, sizeBytes: result.ContentLength };
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return { ok: false, reason: 'not present on NAS' };
    }
    return { ok: false, reason: `NAS check failed: ${err.message || err.name}` };
  }
}

/**
 * Upload a buffer/stream directly to the NAS's MinIO instance.
 * Used by the selective copy step — e8-app decides what gets archived,
 * instead of the NAS blindly mirroring the whole R2 bucket nightly.
 */
export async function uploadToNas(key: string, body: Buffer | Uint8Array | NodeJS.ReadableStream, contentLength?: number): Promise<void> {
  const client = getNasS3();
  await client.send(new PutObjectCommand({
    Bucket: NAS_BUCKET,
    Key: key,
    Body: body as any,
    ContentLength: contentLength,
  }));
}