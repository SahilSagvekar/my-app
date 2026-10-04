export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { parseAnnouncementInput } from '@/lib/announcement-input';
import { sendTestEmail } from '@/lib/announcements';

// POST /api/admin/announcements/test — emails a preview to the admin's own address only.
export async function POST(req: NextRequest) {
  const user = getUserFromToken(req);
  const denied = requireAdmin(user);
  if (denied || !user?.email) return NextResponse.json({ error: denied?.error || 'Unauthorized' }, { status: denied?.status || 401 });
  try {
    const { data, error } = parseAnnouncementInput(await req.json());
    if (!data) return NextResponse.json({ error }, { status: 400 });
    await sendTestEmail(data as any, user.email);
    return NextResponse.json({ ok: true, sentTo: user.email });
  } catch (err: any) {
    console.error('[admin/announcements] test error:', err);
    return NextResponse.json({ error: 'Failed to send test email' }, { status: 500 });
  }
}
