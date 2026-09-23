// src/lib/drive/r2.ts
//
// Minimal typing for the Worker's R2 binding (wrangler.toml: R2_VIDEOS ->
// e8-app-r2-prod) plus a getter. The repo doesn't pull in
// @cloudflare/workers-types, so only the members Drive actually uses are
// declared here. Reading through the binding needs no SigV4 signing at all,
// which is why thumbnails, HLS segments and the index sync use it instead of
// presigned URLs.

import { getCloudflareContext } from '@opennextjs/cloudflare';

export interface R2ObjectLike {
  key: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: { contentType?: string; cacheControl?: string };
}

export interface R2ObjectBodyLike extends R2ObjectLike {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

export interface R2ListResultLike {
  objects: R2ObjectLike[];
  truncated: boolean;
  cursor?: string;
}

export interface R2BucketLike {
  get(key: string, options?: { range?: { offset: number; length?: number } | { suffix: number } }): Promise<R2ObjectBodyLike | null>;
  head(key: string): Promise<R2ObjectLike | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<R2ObjectLike | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: { prefix?: string; cursor?: string; limit?: number; delimiter?: string }): Promise<R2ListResultLike>;
}

export function getR2Bucket(env?: any): R2BucketLike {
  const e = env ?? getCloudflareContext().env;
  const bucket = (e as any)?.R2_VIDEOS as R2BucketLike | undefined;
  if (!bucket) throw new Error('R2_VIDEOS binding is not available (check wrangler.toml [[r2_buckets]])');
  return bucket;
}

/** Strip the quotes some APIs wrap etags in, so values from events, the binding and S3 compare equal. */
export function normalizeEtag(etag?: string | null): string | null {
  if (!etag) return null;
  return etag.replace(/^W\//, '').replace(/"/g, '') || null;
}

/** Delete every object under a prefix via the binding (1000 per call). Best-effort. */
export async function deletePrefix(bucket: R2BucketLike, prefix: string): Promise<number> {
  if (!prefix || prefix === '/' || !prefix.endsWith('/')) throw new Error(`Refusing to delete unsafe prefix "${prefix}"`);
  let cursor: string | undefined;
  let deleted = 0;
  do {
    const page = await bucket.list({ prefix, cursor, limit: 1000 });
    const keys = page.objects.map((o) => o.key);
    if (keys.length) {
      await bucket.delete(keys);
      deleted += keys.length;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}
