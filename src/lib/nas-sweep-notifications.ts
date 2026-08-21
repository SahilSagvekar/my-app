// src/lib/nas-sweep-notifications.ts
// One Slack message once the whole Saturday NAS sweep finishes — not one
// per file. Sent to the E8 App internal channel (same channel pattern as
// upload-notifications.ts's non-client path).

import { sendToChannel, SlackNotification } from '@/lib/slack';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = -1;
  do {
    size /= 1024;
    unitIndex++;
  } while (size >= 1024 && unitIndex < units.length - 1);
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export async function sendNasSweepCompleteNotification(params: {
  total: number;
  copied: number;
  failed: number;
  totalSize: number;
}): Promise<void> {
  const { total, copied, failed, totalSize } = params;

  try {
    const title = failed > 0
      ? `⚠️ NAS backup sweep finished with ${failed} failure${failed === 1 ? '' : 's'}`
      : `✅ NAS backup sweep complete`;

    const body = `*Files:* ${copied}/${total} copied\n*Total size:* ${formatFileSize(totalSize)}` +
      (failed > 0 ? `\n*Failed:* ${failed} (see Redis nas-sweep:jobs:failed for details)` : '');

    const notification: SlackNotification = {
      type: 'nas_sweep_complete',
      title,
      body,
      payload: { total, copied, failed, totalSize },
    };

    await sendToChannel('e8app', notification);
    console.log(`[NasSweepNotification] Sent: ${copied}/${total} copied, ${failed} failed`);
  } catch (err) {
    console.error('[NasSweepNotification] Failed to send:', err);
  }
}