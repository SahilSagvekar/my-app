// src/lib/storage-overview.ts — account-wide storage totals for the admin page
//
// Two completely different data sources, on purpose:
//  - NAS: a real physical disk with a hard capacity. We ask MinIO itself
//    (via `mc admin info`) rather than summing object sizes, because that's
//    the actual disk usage — not just "sum of what we know we put there".
//  - R2: no hard cap on a pay-as-you-go plan, so there's no meaningful
//    "available" number. We pull total stored bytes from Cloudflare's
//    GraphQL Analytics API instead of listing the bucket, because a full
//    listing of 31k+ objects is the exact thing /structure already refuses
//    to do on demand (blocks the event loop for 20+ seconds).
//
// Both external calls are done live, per the "live/real-time is fine" call —
// note Cloudflare's own analytics aggregation typically lags by up to ~1
// hour behind actual writes (that's a Cloudflare-side limitation, not
// something we can make more real-time from our end).

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface StorageOverview {
  used: number;
  total: number | null; // null when there's no meaningful cap (R2)
  available: number | null;
  percentage: number | null;
  objectCount: number | null;
  asOf: string | null; // ISO timestamp the underlying source reports, if any
  error: string | null;
}

function errored(message: string): StorageOverview {
  return { used: 0, total: null, available: null, percentage: null, objectCount: null, asOf: null, error: message };
}

// ─── NAS ────────────────────────────────────────────────────────────────────
// Requires `mc` (MinIO Client) installed on this box, with an alias already
// configured against the NAS's admin credentials:
//   mc alias set <NAS_MC_ALIAS> <NAS_S3_ENDPOINT> <admin-access-key> <admin-secret-key>
// (one-time setup — see the README note added alongside this file)
export async function getNasStorageOverview(): Promise<StorageOverview> {
  const alias = process.env.NAS_MC_ALIAS;
  if (!alias) {
    return errored('NAS_MC_ALIAS is not set — run `mc alias set` once, then set this env var to that alias name');
  }

  let stdout: string;
  try {
    const result = await execFileAsync('mc', ['admin', 'info', alias, '--json'], { timeout: 15000 });
    stdout = result.stdout;
  } catch (err: any) {
    return errored(`Failed to run \`mc admin info ${alias}\`: ${err.message}`);
  }

  let data: any;
  try {
    data = JSON.parse(stdout);
  } catch {
    return errored('mc admin info returned non-JSON output — check `mc` version/output format');
  }

  // mc's JSON shape has varied across versions. Try the newer aggregated
  // `info.usage` field first; fall back to summing per-disk figures.
  // If your output doesn't match either shape, log `data` on the server
  // and adjust the field names below to match.
  const info = data.info || data;

  let total: number | null = null;
  let used: number | null = null;

  if (info.usage?.total != null && info.usage?.used != null) {
    total = Number(info.usage.total);
    used = Number(info.usage.used);
  } else if (Array.isArray(info.servers)) {
    let sumTotal = 0;
    let sumUsed = 0;
    let foundDisk = false;
    for (const server of info.servers) {
      for (const disk of server.disks || []) {
        if (disk.totalspace != null && disk.usedspace != null) {
          sumTotal += Number(disk.totalspace);
          sumUsed += Number(disk.usedspace);
          foundDisk = true;
        }
      }
    }
    if (foundDisk) {
      total = sumTotal;
      used = sumUsed;
    }
  }

  if (total == null || used == null) {
    return errored('Could not find usage figures in `mc admin info` output — schema may differ from what this code expects. Check the raw output on the server.');
  }

  return {
    used,
    total,
    available: total - used,
    percentage: total > 0 ? (used / total) * 100 : 0,
    objectCount: null,
    asOf: new Date().toISOString(),
    error: null,
  };
}

// ─── CLOUDFLARE R2 ──────────────────────────────────────────────────────────
// Uses Cloudflare's GraphQL Analytics API — one call, no object listing.
// NOTE: verify these exact field names against Cloudflare's GraphQL schema
// explorer (developers.cloudflare.com/analytics/graphql-api) — the R2
// analytics schema has shifted before and this hasn't been tested against
// a live account from here.
export async function getR2StorageOverview(): Promise<StorageOverview> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.AWS_S3_BUCKET;

  if (!accountId || !apiToken) {
    return errored('CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN are not set');
  }

  const query = `
    query R2Storage($accountTag: string!, $bucketName: string) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          r2StorageAdaptiveGroups(
            limit: 1
            filter: { bucketName: $bucketName }
            orderBy: [date_DESC]
          ) {
            max {
              payloadSize
              metadataSize
              objectCount
            }
            dimensions {
              date
            }
          }
        }
      }
    }
  `;

  let json: any;
  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        query,
        variables: { accountTag: accountId, bucketName },
      }),
    });
    json = await res.json();
  } catch (err: any) {
    return errored(`Cloudflare GraphQL request failed: ${err.message}`);
  }

  if (json.errors?.length) {
    return errored(`Cloudflare GraphQL error: ${json.errors[0].message}`);
  }

  const group = json?.data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups?.[0];
  if (!group) {
    return errored('No R2 storage data returned — check bucket name / token scope, or the field names above may need updating');
  }

  const payloadSize = Number(group.max?.payloadSize || 0);
  const metadataSize = Number(group.max?.metadataSize || 0);
  const used = payloadSize + metadataSize;

  return {
    used,
    total: null, // no fixed cap on pay-as-you-go R2
    available: null,
    percentage: null,
    objectCount: group.max?.objectCount != null ? Number(group.max.objectCount) : null,
    asOf: group.dimensions?.date || null,
    error: null,
  };
}