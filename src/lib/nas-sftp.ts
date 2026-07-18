// src/lib/nas-sftp.ts
// Writes files to the NAS as genuine, directly-playable files via SFTP —
// replaces the MinIO/nas-s3.ts approach. MinIO stored objects in its own
// internal chunked format (not browsable/playable as normal video files),
// which didn't meet the actual requirement: real video files sitting in
// real NAS folders.
//
// One SFTP connection is opened per job/sweep run and reused across all
// files in that run (SFTP is a stateful, connection-based protocol, unlike
// the S3 API — reconnecting per file would be slow and wasteful).
//
// env vars:
//   NAS_SFTP_HOST      = NAS's current Tailscale IP (e.g. 100.108.125.54)
//   NAS_SFTP_PORT      = 22 (default)
//   NAS_SFTP_USER      = NAS SSH username (e.g. sahil)
//   NAS_SFTP_PASSWORD  = NAS SSH password
//     (or, preferably: NAS_SFTP_PRIVATE_KEY_PATH pointing to a key file on
//      EC2, with the matching public key added to the NAS's authorized_keys
//      — avoids storing a plaintext password. Either works; password is
//      simpler to set up now, key-based is the recommended upgrade later.)
//   NAS_SFTP_ROOT_PATH = /volume2/Backup (root folder on the NAS; the same
//                        R2 key, e.g. "CompanyName/outputs/May-2026/x.mp4",
//                        is written at <root>/<key> — same layout the old
//                        rclone setup used, so files land exactly where
//                        you'd expect: /volume2/Backup/outputs/... etc.)

import SftpClient from 'ssh2-sftp-client';
import path from 'path';
import { Readable } from 'stream';
import fs from 'fs';

const ROOT_PATH = process.env.NAS_SFTP_ROOT_PATH || '/volume2/Backup';

function remotePath(key: string): string {
  // posix join — NAS is Linux, always use forward slashes regardless of host OS
  return path.posix.join(ROOT_PATH, key);
}

function connectionConfig() {
  const config: any = {
    host: process.env.NAS_SFTP_HOST,
    port: Number(process.env.NAS_SFTP_PORT) || 22,
    username: process.env.NAS_SFTP_USER,
  };
  if (process.env.NAS_SFTP_PRIVATE_KEY_PATH) {
    config.privateKey = fs.readFileSync(process.env.NAS_SFTP_PRIVATE_KEY_PATH);
  } else {
    config.password = process.env.NAS_SFTP_PASSWORD;
  }
  return config;
}

export class NasSftpSession {
  private client: SftpClient;
  private connected = false;

  constructor() {
    this.client = new SftpClient();
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (!process.env.NAS_SFTP_HOST) {
      throw new Error('NAS_SFTP_HOST is not set — cannot reach the NAS');
    }
    await this.client.connect(connectionConfig());
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.client.end().catch(() => {});
    this.connected = false;
  }

  // Real per-file check — a live SFTP stat call, not a self-reported flag.
  async existsWithSize(key: string, expectedSize: number): Promise<boolean> {
    const remote = remotePath(key);
    try {
      const stat = await this.client.stat(remote);
      return stat.size === expectedSize;
    } catch {
      return false; // doesn't exist, or stat failed — treat as not present
    }
  }

  // Uploads a stream/buffer to the NAS as a plain file, creating any
  // missing parent directories first (SFTP put fails if they don't exist).
  async upload(key: string, body: Readable | Buffer): Promise<void> {
    const remote = remotePath(key);
    const dir = path.posix.dirname(remote);
    await this.client.mkdir(dir, true).catch(() => {
      // mkdir throws if the dir already exists on some SFTP servers — safe to ignore
    });
    await this.client.put(body as any, remote);
  }
}

// Convenience one-shot helpers for callers that only need a single
// operation and don't want to manage a session themselves (e.g. quick
// scripts). Prefer NasSftpSession directly for anything doing many files.
export async function withNasSftp<T>(fn: (session: NasSftpSession) => Promise<T>): Promise<T> {
  const session = new NasSftpSession();
  await session.connect();
  try {
    return await fn(session);
  } finally {
    await session.disconnect();
  }
}