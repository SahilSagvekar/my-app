// POST /api/contracts/upload-completed — Upload an already-signed document
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';
import { uploadContractToS3, generateSignToken } from '@/lib/contracts';

export async function POST(req: NextRequest) {
    try {
        const jwtUser = getUserFromToken(req);
        if (!jwtUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findFirst({
            where: { id: jwtUser.userId || jwtUser.id },
        });
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const title = formData.get('title') as string;
        const description = formData.get('description') as string | null;
        const clientId = formData.get('clientId') as string | null;
        const signersJson = formData.get('signers') as string | null;
        const signedDateStr = formData.get('signedDate') as string | null;

        if (!title?.trim()) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }
        if (!file) {
            return NextResponse.json({ error: 'PDF file is required' }, { status: 400 });
        }

        // Upload file to S3
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await uploadContractToS3(buffer, file.name);

        // Parse signers (optional — for record-keeping)
        let signers: Array<{ name: string; email: string; role?: string }> = [];
        if (signersJson) {
            try {
                signers = JSON.parse(signersJson);
            } catch {
                return NextResponse.json({ error: 'Invalid signers JSON' }, { status: 400 });
            }
        }

        const completedAt = signedDateStr ? new Date(signedDateStr) : new Date();

        // Create contract as COMPLETED with the uploaded file as BOTH
        // the original and the signed copy (since it's already signed)
        const contract = await prisma.contract.create({
            data: {
                title: title.trim(),
                description: description?.trim() || null,
                status: 'COMPLETED',
                s3Key: result.s3Key,
                signedS3Key: result.s3Key, // Same file — it's already signed
                fileName: file.name,
                fileSize: BigInt(result.fileSize),
                createdById: user.id,
                clientId: clientId || null,
                completedAt,
                signers: {
                    create: signers
                        .filter(s => s.name?.trim() && s.email?.trim())
                        .map((s, index) => ({
                            name: s.name.trim(),
                            email: s.email.trim(),
                            role: s.role || 'signer',
                            order: index,
                            status: 'SIGNED' as const,
                            signedAt: completedAt,
                            signToken: generateSignToken(),
                        })),
                },
                auditLogs: {
                    create: {
                        action: 'uploaded_completed',
                        performedBy: user.name || user.email,
                        details: JSON.stringify({
                            title: title.trim(),
                            fileName: file.name,
                            signerCount: signers.length,
                            message: 'Already-signed document uploaded directly',
                        }),
                    },
                },
            },
            include: {
                signers: true,
            },
        });

        return NextResponse.json({
            ...contract,
            fileSize: contract.fileSize.toString(),
        });
    } catch (error: any) {
        console.error('POST /api/contracts/upload-completed error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
