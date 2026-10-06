// lib/portfolio-auth.ts
// Shared gate for portfolio-management write routes and admin-only reads.
// The portfolio page itself is public, but anything that changes (or lists
// hidden) portfolio content must come from a logged-in admin/manager —
// the middleware matcher only covers pages, never /api routes.

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, hasRole } from '@/lib/auth-helpers';

export function requirePortfolioAdmin(req: NextRequest): NextResponse | null {
  const user = getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }
  const allowed = ['admin', 'manager'].some(
    (r) => hasRole({ ...user, role: String(user.role || '').toLowerCase() }, r)
  );
  if (!allowed) {
    return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
  }
  return null;
}
