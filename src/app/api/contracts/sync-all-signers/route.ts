export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { getSignWellDocument, mapSignWellStatus, mapSignWellSignerStatus, downloadSignWellPdf } from '@/lib/signwell';
import { uploadBufferToS3 } from '@/lib/s3';

/**
 * POST /api/contracts/sync-all-signers
 *
 * Admin-only: Re-syncs signer statuses for ALL contracts that have any
 * signer still in PENDING state, regardless of the contract's own status.
 * Use this as a one-time fix for contracts that were completed in SignWell
 * but whose signers are still showing as PENDING in the database.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find ALL contracts with at least one PENDING signer and a SignWell doc ID
    const contracts = await prisma.contract.findMany({
      where: {
        signwellDocumentId: { not: null },
        signers: { some: { status: 'PENDING' } },
      },
      include: {
        signers: true,
        client: { include: { portalAccess: true } },
      },
    });

    console.log(`[sync-all-signers] Found ${contracts.length} contract(s) with pending signers`);

    let contractsFixed = 0;
    let signersFixed = 0;
    const errors: string[] = [];

    for (const contract of contracts) {
      try {
        const swDoc = await getSignWellDocument(contract.signwellDocumentId!);
        const swSigners: any[] = swDoc.signers || [];
        let anyUpdated = false;

        for (const swSigner of swSigners) {
          const dbSigner = contract.signers.find(
            (s) => s.email?.toLowerCase() === swSigner.email?.toLowerCase()
          );
          if (!dbSigner) continue;

          const newStatus = mapSignWellSignerStatus(swSigner.status);
          if (dbSigner.status !== newStatus) {
            await prisma.contractSigner.update({
              where: { id: dbSigner.id },
              data: {
                status: newStatus,
                signedAt: newStatus === 'SIGNED' ? new Date() : dbSigner.signedAt ?? undefined,
                viewedAt: newStatus === 'VIEWED' ? new Date() : dbSigner.viewedAt ?? undefined,
              },
            });
            signersFixed++;
            anyUpdated = true;
            console.log(`  ✔ ${contract.title}: signer ${swSigner.email} ${dbSigner.status} → ${newStatus}`);
          }
        }

        // Also fix the contract-level status
        const newContractStatus = mapSignWellStatus(swDoc.status);
        if (newContractStatus !== contract.status) {
          if (newContractStatus === 'COMPLETED' && contract.status !== 'COMPLETED') {
            try {
              const pdfBuffer = await downloadSignWellPdf(swDoc.id);
              const clientName =
                (contract.client as any)?.companyName ||
                (contract.client as any)?.name ||
                'client';
              const { key } = await uploadBufferToS3({
                buffer: pdfBuffer,
                folderPrefix: `${clientName}/Contracts/`,
                filename: `signed-${contract.fileName || 'contract.pdf'}`,
                mimeType: 'application/pdf',
              });
              await prisma.contract.update({
                where: { id: contract.id },
                data: { status: 'COMPLETED', completedAt: new Date(), signedS3Key: key },
              });
            } catch {
              await prisma.contract.update({
                where: { id: contract.id },
                data: { status: 'COMPLETED', completedAt: new Date() },
              });
            }
          } else {
            await prisma.contract.update({
              where: { id: contract.id },
              data: { status: newContractStatus as any },
            });
          }
          anyUpdated = true;
        }

        if (anyUpdated) contractsFixed++;
      } catch (err: any) {
        const msg = `Contract ${contract.id} (${contract.title}): ${err.message}`;
        console.error('  ✖', msg);
        errors.push(msg);
      }
    }

    return NextResponse.json({
      success: true,
      contractsChecked: contracts.length,
      contractsFixed,
      signersFixed,
      errors,
    });
  } catch (err: any) {
    console.error('[sync-all-signers] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
