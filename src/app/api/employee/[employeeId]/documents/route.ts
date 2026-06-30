export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { generateDownloadUrl } from '@/lib/s3';

// GET /api/employee/[employeeId]/documents/[docId]/download
// Accessible by admins (any employee's docs) or the employee themself.
// Returns a short-lived presigned R2 URL the browser can navigate to.
export async function GET(
  req: Request,
  context: { params: { employeeId: string; docId: string } },
) {
  const { employeeId, docId } = context.params;
  const id = Number(employeeId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid employee id' }, { status: 400 });
  }

  const user = await getCurrentUser2(req as any);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin' && user.id !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const document = await prisma.employeeDocument.findUnique({ where: { id: docId } });
  if (!document || document.employeeId !== id) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const url = await generateDownloadUrl(document.s3Key, document.fileName, 300); // 5 min
  return NextResponse.json({ url });
}

// DELETE /api/employee/[employeeId]/documents/[docId]
// Admin-only.
export async function DELETE(
  req: Request,
  context: { params: { employeeId: string; docId: string } },
) {
  const user = await getCurrentUser2(req as any);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { employeeId, docId } = context.params;
  const id = Number(employeeId);

  const document = await prisma.employeeDocument.findUnique({ where: { id: docId } });
  if (!document || document.employeeId !== id) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  await prisma.employeeDocument.delete({ where: { id: docId } });
  // Note: this only removes the DB record, not the underlying R2 object —
  // consistent with how other "soft" deletes in this app work. Add an
  // explicit deleteFromS3(document.s3Key) call here if you'd rather
  // reclaim storage immediately.

  return NextResponse.json({ ok: true });
}