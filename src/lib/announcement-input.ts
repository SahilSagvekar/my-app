// Validation/normalisation of admin-submitted announcement fields.
import { ANNOUNCEMENT_ROLES, ANNOUNCEMENT_TYPES } from '@/lib/announcements';

export type AnnouncementInput = {
  title: string;
  body: string;
  type: string;
  linkUrl: string | null;
  linkLabel: string | null;
  audienceAll: boolean;
  audienceRoles: string[];
  audienceUserIds: number[];
  sendEmail: boolean;
  sendSlack: boolean;
  showPopup: boolean;
  publishAt: string | null;
  expiresAt: string | null;
};

function parseDate(v: any, field: string): string | null {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) throw new Error(`Invalid ${field}`);
  return d.toISOString();
}

export function parseAnnouncementInput(b: any): { data?: AnnouncementInput; error?: string } {
  try {
    const title = String(b?.title ?? '').trim();
    const body = String(b?.body ?? '').trim();
    if (!title) return { error: 'Title is required' };
    if (title.length > 140) return { error: 'Title must be 140 characters or fewer' };
    if (!body) return { error: 'Message is required' };
    if (body.length > 5000) return { error: 'Message must be 5000 characters or fewer' };

    const type = ANNOUNCEMENT_TYPES.includes(b?.type) ? b.type : 'NEW_FEATURE';

    let linkUrl: string | null = String(b?.linkUrl ?? '').trim() || null;
    // Only relative app links or http(s) — never javascript:/data: URLs.
    if (linkUrl && !/^(\/(?!\/)|https?:\/\/)/i.test(linkUrl)) {
      return { error: 'Link must start with / or https://' };
    }
    const linkLabel = linkUrl ? String(b?.linkLabel ?? '').trim().slice(0, 40) || null : null;

    const audienceAll = b?.audienceAll === true;
    const audienceRoles: string[] = Array.isArray(b?.audienceRoles)
      ? Array.from(new Set<string>(b.audienceRoles.map((r: any) => String(r).toLowerCase()))).filter((r) =>
          (ANNOUNCEMENT_ROLES as readonly string[]).includes(r),
        )
      : [];
    const audienceUserIds: number[] = Array.isArray(b?.audienceUserIds)
      ? Array.from(new Set<number>(b.audienceUserIds.map(Number))).filter((n) => Number.isInteger(n) && n > 0)
      : [];
    if (!audienceAll && !audienceRoles.length && !audienceUserIds.length) {
      return { error: 'Choose who should receive this (everyone, one or more roles, or specific people)' };
    }

    const publishAt = parseDate(b?.publishAt, 'publish time');
    const expiresAt = parseDate(b?.expiresAt, 'expiry time');
    if (publishAt && expiresAt && new Date(expiresAt) <= new Date(publishAt)) {
      return { error: 'Expiry must be after the publish time' };
    }

    return {
      data: {
        title, body, type, linkUrl, linkLabel,
        audienceAll,
        audienceRoles: audienceAll ? [] : audienceRoles,
        audienceUserIds: audienceAll ? [] : audienceUserIds,
        sendEmail: b?.sendEmail === true,
        sendSlack: b?.sendSlack === true,
        showPopup: b?.showPopup === true || type === 'IMPORTANT' ? b?.showPopup !== false : false,
        publishAt, expiresAt,
      },
    };
  } catch (e: any) {
    return { error: e?.message || 'Invalid input' };
  }
}
