export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, getJwtUserId } from '@/lib/auth-helpers';
import { getFeedForUser } from '@/lib/announcements';

// GET /api/announcements — announcements aimed at the signed-in user (bell + popup).
export async function GET(req: NextRequest) {
  const user = getUserFromToken(req);
  const userId = getJwtUserId(user);
  if (!user || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const roles = [user.role, ...(Array.isArray(user.roles) ? user.roles : [])].filter(Boolean) as string[];
    const items = await getFeedForUser(userId, roles);
    return NextResponse.json({
      items,
      unreadCount: items.filter((i) => !i.read).length,
      // Important ones the user hasn't dismissed yet -> shown once as a popup.
      popup: items.filter((i) => i.showPopup && !i.dismissed),
    });
  } catch (err: any) {
    console.error('[announcements] feed error:', err);
    return NextResponse.json({ error: 'Failed to load announcements' }, { status: 500 });
  }
}
