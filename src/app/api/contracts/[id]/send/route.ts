// src/app/api/contracts/[id]/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';
import { generateSigningUrl } from '@/lib/contracts';
import { sendContractSigningInvite } from '@/lib/email';

// POST /api/contracts/[id]/send - Send contract for signing
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;

        const contract = await prisma.contract.findUnique({
            where: { id },
            include: { signers: true },
        });

        if (!contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        if (contract.status !== 'DRAFT') {
            return NextResponse.json({ error: 'Contract has already been sent' }, { status: 400 });
        }

        if (contract.signers.length === 0) {
            return NextResponse.json({ error: 'At least one signer is required' }, { status: 400 });
        }

        const emailResults = [];
        for (const signer of contract.signers) {
            if (signer.status === 'PENDING') {
                const signingUrl = generateSigningUrl(signer.signToken);
                try {
                    await sendContractSigningInvite({
                        signerName: signer.name,
                        signerEmail: signer.email,
                        contractTitle: contract.title,
                        senderName: user.name || user.email,
                        signingUrl,
                        message: contract.message || undefined,
                    });
                    emailResults.push({ email: signer.email, sent: true });
                } catch (err: any) {
                    console.error(`Failed to send to ${signer.email}:`, err);
                    emailResults.push({ email: signer.email, sent: false, error: err.message });
                }
            }
        }

        await prisma.contract.update({
            where: { id },
            data: { status: 'SENT' },
        });

        await prisma.contractAuditLog.create({
            data: {
                contractId: id,
                action: 'sent',
                performedBy: user.name || user.email,
                details: JSON.stringify({ signerCount: contract.signers.length, emailResults }),
            },
        });

        return NextResponse.json({ success: true, emailResults });
    } catch (error: any) {
        console.error('POST /api/contracts/[id]/send error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
