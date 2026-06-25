export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { uploadBufferToS3 } from '@/lib/s3';
import { createSignWellDocumentFromFile } from '@/lib/signwell';

// GET /api/contracts — list contracts
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const clientId = searchParams.get('clientId');

    let where: any = {};

    if (user.role === 'admin' || user.role === 'manager') {
      if (status && status !== 'all') where.status = status;
      if (clientId) where.clientId = clientId;
    } else if (user.role === 'client') {
      where.OR = [
        { clientId: user.linkedClientId },
        { signers: { some: { email: user.email } } },
      ];
      if (status && status !== 'all') where.status = status;
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (search) {
      const searchFilter = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchFilter }];
        delete where.OR;
      } else {
        where.OR = searchFilter;
      }
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        signers: {
          select: { id: true, name: true, email: true, status: true, signedAt: true, role: true },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      contracts.map((c: any) => ({ ...c, fileSize: c.fileSize?.toString() || '0' }))
    );
  } catch (err: any) {
    console.error('GET /api/contracts error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/contracts — create + send via SignWell
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string | null;
    const message = formData.get('message') as string | null;
    const clientId = formData.get('clientId') as string | null;
    const expiresInDays = Number(formData.get('expiresInDays') || 30);
    const signersJson = formData.get('signers') as string;

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!file) return NextResponse.json({ error: 'PDF file is required' }, { status: 400 });
    if (!signersJson) return NextResponse.json({ error: 'At least one signer is required' }, { status: 400 });

    let signers: Array<{ name: string; email: string }> = [];
    try { signers = JSON.parse(signersJson); } catch {
      return NextResponse.json({ error: 'Invalid signers JSON' }, { status: 400 });
    }

    if (signers.length === 0) {
      return NextResponse.json({ error: 'At least one signer is required' }, { status: 400 });
    }

    // 1. Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileBase64 = buffer.toString('base64');

    // 2. Upload original PDF to R2
    const { key: s3Key } = await uploadBufferToS3({
      buffer,
      folderPrefix: 'contracts/originals/',
      filename: file.name,
      mimeType: 'application/pdf',
    });

    // 3. Send to SignWell
    const signwellSigners = signers.map((s, i) => ({
      id: String(i + 1),
      name: s.name,
      email: s.email,
      send_email: true,
    }));

    const signwellDoc = await createSignWellDocumentFromFile({
      name: title,
      subject: `Please sign: ${title}`,
      message: message || `Hi, please review and sign the document: ${title}`,
      fileBase64,
      fileName: file.name,
      signers: signwellSigners,
      expiresInDays,
      embeddedSigning: true,
    });

    // 4. Create contract record in DB
    const contract = await prisma.contract.create({
      data: {
        title,
        description,
        message,
        s3Key,
        fileName: file.name,
        fileSize: BigInt(buffer.length),
        status: 'SENT',
        clientId,
        expiresAt: expiresInDays
          ? new Date(Date.now() + expiresInDays * 86400000)
          : null,
        signwellDocumentId: signwellDoc.id,
        signwellRequestId: signwellDoc.id,
        createdById: user.id,
        signers: {
          create: signers.map((s, i) => ({
            name: s.name,
            email: s.email,
            role: 'signer',
            order: i,
            status: 'PENDING',
            // Store SignWell signer ID so we can get embedded URL later
            signToken: signwellDoc.signers?.[i]?.id || `sw-${Date.now()}-${i}`,
          })),
        },
        auditLogs: {
          create: {
            action: 'sent_via_signwell',
            performedBy: user.name || user.email,
            details: JSON.stringify({
              signwellDocId: signwellDoc.id,
              signerCount: signers.length,
            }),
          },
        },
      },
      include: {
        signers: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      ...contract,
      fileSize: contract.fileSize.toString(),
    }, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/contracts error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
