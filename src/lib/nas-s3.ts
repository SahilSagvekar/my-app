// src/lib/nas-s3.ts
// S3 client pointed at the NAS's MinIO instance (reached over Tailscale).

import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { S3ClientConfig } from '@aws-sdk/client-s3';

function getNasS3Config(): S3ClientConfig {
  return {
    region: 'us-east-1',
    endpoint: process.env.NAS_S3_ENDPOINT!,
    forcePathStyle: true,
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

export async function uploadToNas(key: string, body: Buffer | Uint8Array | NodeJS.ReadableStream, contentLength?: number): Promise<void> {
  const client = getNasS3();
  await client.send(new (require('@aws-sdk/client-s3').PutObjectCommand)({
    Bucket: NAS_BUCKET,
    Key: key,
    Body: body as any,
    ContentLength: contentLength,
  }));
}