export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, getJwtUserId } from '@/lib/auth-helpers';
import { getFeedForUser, markRead } from '@/lib/announcements';

// POST /api/announcements/read  { ids?: string[], all?: boolean, dismiss?: boolean }
export async function POST(req: NextRequest) {
  const user = getUserFromToken(req);
  const userId = getJwtUserId(user);
  if (!user || !userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const dismiss = body.dismiss === true;
    let ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: any) => typeof x === 'string') : [];

    if (body.all === true) {
      // Only ids the user is actually in the audience for.
      const roles = [user.role, ...(Array.isArray(user.roles) ? user.roles : [])].filter(Boolean) as string[];
      const feed = await getFeedForUser(userId, roles, 100);
      ids = feed.filter((i) => !i.read).map((i) => i.id);
    } else if (ids.length) {
      const roles = [user.role, ...(Array.isArray(user.roles) ? user.roles : [])].filter(Boolean) as string[];
      const allowed = new Set((await getFeedForUser(userId, roles, 100)).map((i) => i.id));
      ids = ids.filter((id) => allowed.has(id)).slice(0, 100);
    }

    await markRead(userId, ids, dismiss);
    return NextResponse.json({ ok: true, count: ids.length });
  } catch (err: any) {
    console.error('[announcements] read error:', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
