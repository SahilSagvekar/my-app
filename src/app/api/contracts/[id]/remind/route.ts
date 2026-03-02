// src/app/api/contracts/[id]/remind/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';
import { generateSigningUrl } from '@/lib/contracts';
import { sendContractReminderEmail } from '@/lib/email';

// POST /api/contracts/[id]/remind - Send reminders to pending signers
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

        if (contract.status === 'COMPLETED' || contract.status === 'CANCELLED') {
            return NextResponse.json({ error: 'Contract is not in a signable state' }, { status: 400 });
        }

        const pendingSigners = contract.signers.filter(
            (s: any) => s.status === 'PENDING' || s.status === 'VIEWED'
        );

        if (pendingSigners.length === 0) {
            return NextResponse.json({ message: 'No pending signers' });
        }

        const emailResults = [];
        for (const signer of pendingSigners) {
            const signingUrl = generateSigningUrl(signer.signToken);
            try {
                await sendContractReminderEmail({
                    signerName: signer.name,
                    signerEmail: signer.email,
                    contractTitle: contract.title,
                    senderName: user.name || user.email,
                    signingUrl,
                });
                emailResults.push({ email: signer.email, sent: true });
            } catch (err: any) {
                console.error(`Failed to send reminder to ${signer.email}:`, err);
                emailResults.push({ email: signer.email, sent: false, error: err.message });
            }
        }

        await prisma.contractAuditLog.create({
            data: {
                contractId: id,
                action: 'reminder_sent',
                performedBy: user.name || user.email,
                details: JSON.stringify({ reminderCount: pendingSigners.length, emailResults }),
            },
        });

        return NextResponse.json({ success: true, emailResults });
    } catch (error: any) {
        console.error('POST /api/contracts/[id]/remind error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
