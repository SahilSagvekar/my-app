export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, getCurrentUser2 } from '@/lib/auth';
import { uploadBufferToS3 } from '@/lib/s3';

// GET /api/employee/[employeeId]/documents
// Accessible by admins (for any employee) or the employee themself (their
// own documents only).
export async function GET(
  req: Request,
  context: { params: { employeeId: string } },
) {
  const params = await context.params;
  const { employeeId } = params;
  const id = Number(employeeId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid employee id' }, { status: 400 });
  }

  const user = await getCurrentUser2(req as any);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin' && user.id !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const documents = await prisma.employeeDocument.findMany({
    where: { employeeId: id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      fileName: true,
      fileSize: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
    },
  });

  return NextResponse.json({ documents });
}

// POST /api/employee/[employeeId]/documents
// Admin-only. multipart/form-data: { file, title? }
export async function POST(
  req: Request,
  context: { params: { employeeId: string } },
) {
  try {
    const admin = await requireAdmin(req as any);

    const params = await context.params;
    const { employeeId } = params;
    const id = Number(employeeId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid employee id' }, { status: 400 });
    }

    const employee = await prisma.user.findUnique({ where: { id } });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get('file') as File | null;
    const title = (form.get('title') as string) || file?.name || 'Document';

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }
    const MAX_SIZE = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folderPrefix = `employee-documents/${id}/`;

    const upload = await uploadBufferToS3({
      buffer,
      folderPrefix,
      filename: `${Date.now()}_${safeName}`,
      mimeType: file.type,
    });

    const document = await prisma.employeeDocument.create({
      data: {
        employeeId: id,
        title,
        s3Key: upload.key,
        fileName: file.name,
        fileSize: file.size,
        uploadedById: admin.id,
      },
    });

    return NextResponse.json({ document });
  } catch (err: any) {
    console.error('[employee/documents POST]', err);
    const status = err?.status || 500;
    const msg = err?.message || 'Upload failed';
    return NextResponse.json({ error: msg }, { status });
  }
}