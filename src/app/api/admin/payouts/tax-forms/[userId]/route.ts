export const dynamic = 'force-dynamic';
// GET /api/admin/payouts/tax-forms/[userId] — presigned download link for one rep's tax form
// admin: any rep. sales_manager: only their visible reps.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getVisibleSalesRepIds } from '@/lib/salesManagerPermissions';
import { generateDownloadUrl } from '@/lib/s3';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || (decoded.role !== 'admin' && decoded.role !== 'sales_manager')) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const { userId } = await params;
    const targetId = Number(userId);

    if (decoded.role === 'sales_manager') {
      const visible = await getVisibleSalesRepIds(Number(decoded.userId));
      if (!visible.includes(targetId)) {
        return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
      }
    }

    const profile = await prisma.salesRepPayoutProfile.findUnique({ where: { userId: targetId } });
    if (!profile?.taxFormS3Key) {
      return NextResponse.json({ ok: false, message: 'No tax form on file' }, { status: 404 });
    }

    const url = await generateDownloadUrl(
      profile.taxFormS3Key,
      `${profile.taxFormType || 'W9'}-${targetId}.pdf`,
      3600
    );

    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error('[GET /api/admin/payouts/tax-forms/[userId]]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
