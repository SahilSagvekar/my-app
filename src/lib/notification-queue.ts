// src/lib/notification-queue.ts
//
// Single funnel for every Slack message and email the platform sends.
// Producers (slack.ts, mail-transport.ts) call enqueueNotification() —
// it pushes onto the `notifications` Cloudflare Queue when running on
// Workers, or delivers/logs immediately as a fallback in local dev
// (no queue binding available outside a deployed Worker / `wrangler dev`).
//
// The Worker's queue() consumer (see worker.ts, the deployed entry point
// per wrangler.toml's `main`) calls deliverSlackJobNow / deliverEmailJobNow
// for each message pulled off the queue.
//
// Email jobs are relayed to e8-file-server's POST /notify/email — a Queue
// consumer is still a Worker, so it can't open a raw SMTP socket any more
// than the fetch handler could. Slack jobs are delivered directly here,
// since Slack's webhook/Web API calls are plain HTTPS and Workers handle
// those fine.

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { WebClient } from '@slack/web-api';
import { generateFileServerToken } from '@/lib/file-server';

export type SlackWebhookJob = {
  kind: 'slack-webhook';
  url: string;
  blocks: any[];
};

export type SlackDmJob = {
  kind: 'slack-dm';
  channelId: string;
  text: string;
  blocks?: any[];
};

export type EmailJob = {
  kind: 'email';
  mailOptions: {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    // Buffer content is base64-encoded by mail-transport.ts before this
    // ever reaches the queue (Buffers don't survive JSON serialization) —
    // nodemailer accepts { content, encoding: 'base64' } natively.
    attachments?: Array<{ filename: string; content: string; contentType?: string; encoding?: string }>;
  };
};

export type NotificationJob = SlackWebhookJob | SlackDmJob | EmailJob;

// ── Producer side ─────────────────────────────────────────────────────────

export async function enqueueNotification(job: NotificationJob): Promise<boolean> {
  try {
    const { env } = getCloudflareContext();
    const queue = (env as any)?.NOTIFICATIONS_QUEUE;
    if (queue) {
      await queue.send(job);
      return true;
    }
  } catch (err: any) {
    // getCloudflareContext() throws outside a Workers request context
    // (e.g. plain `next dev` without wrangler) — fall through to a local
    // fallback below so local development doesn't hard-fail.
    console.warn('[notification-queue] No queue binding available, using local fallback:', err?.message);
  }

  // Local-dev fallback only — in production the queue binding above is
  // always present, so this branch never runs on Workers.
  try {
    if (job.kind === 'email') {
      console.log(`📧 [notification-queue:fallback] Would send email to ${job.mailOptions.to}: "${job.mailOptions.subject}"`);
      return true;
    }
    await deliverSlackJobNow(job);
    return true;
  } catch (err) {
    console.error('[notification-queue] Fallback delivery failed:', err);
    return false;
  }
}

// ── Consumer side (called from worker.ts's queue() handler) ───────────────

let _slackClient: WebClient | null = null;
function getSlackClient(): WebClient | null {
  if (!process.env.SLACK_BOT_TOKEN) return null;
  if (!_slackClient) _slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
  return _slackClient;
}

export async function deliverSlackJobNow(job: SlackWebhookJob | SlackDmJob): Promise<void> {
  if (job.kind === 'slack-webhook') {
    const res = await fetch(job.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks: job.blocks }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown');
      throw new Error(`Slack webhook failed (${res.status}): ${text}`);
    }
    return;
  }

  if (job.kind === 'slack-dm') {
    const client = getSlackClient();
    if (!client) throw new Error('SLACK_BOT_TOKEN not configured');
    await client.chat.postMessage({ channel: job.channelId, text: job.text, blocks: job.blocks, mrkdwn: true });
    return;
  }
}

// Relays to e8-file-server, which does the actual SMTP send — Workers
// cannot open raw SMTP sockets, so a Queue consumer running as a Worker
// can never send mail directly either.
export async function deliverEmailJobNow(job: EmailJob, env: any): Promise<void> {
  const token = generateFileServerToken('system', 'system');

  const res = await env.FILE_SERVER.fetch('http://internal/notify/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(job.mailOptions),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown');
    throw new Error(`Email relay failed (${res.status}): ${text}`);
  }
}
