// src/lib/contracts.ts
// Shared utilities for the contracts feature

import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { s3, generateSignedUrl } from './s3';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.AWS_S3_BUCKET!;

/**
 * Generate a cryptographically secure token for signing URLs
 */
export function generateSignToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Upload a buffer to S3 and return the key
 */
export async function uploadContractToS3(
    buffer: Buffer,
    fileName: string,
    prefix: string = 'contracts'
): Promise<{ s3Key: string; fileSize: number }> {
    const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${prefix}/${Date.now()}-${sanitized}`;

    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: buffer,
            ContentType: 'application/pdf',
        })
    );

    return { s3Key: key, fileSize: buffer.length };
}

/**
 * Upload a signature image (data URL -> S3)
 */
export async function uploadSignatureToS3(
    dataUrl: string,
    signerId: string
): Promise<string> {
    // data:image/png;base64,iVBORw0...
    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) throw new Error('Invalid signature data URL');

    const ext = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const key = `contracts/signatures/${signerId}-${Date.now()}.${ext}`;

    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: buffer,
            ContentType: `image/${ext}`,
        })
    );

    return key;
}

/**
 * Download a PDF from S3 as a buffer
 */
export async function downloadPdfFromS3(s3Key: string): Promise<Buffer> {
    const response = await s3.send(
        new GetObjectCommand({
            Bucket: BUCKET,
            Key: s3Key,
        })
    );

    const stream = response.Body as any;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

/**
 * Download a signature image from S3 as a buffer
 */
async function downloadSignatureFromS3(s3Key: string): Promise<Buffer> {
    return downloadPdfFromS3(s3Key); // Same logic, just a different content type
}

/**
 * Apply signatures to a PDF and upload the signed version
 */
export async function applySignaturesToPdf(
    originalS3Key: string,
    signatures: Array<{
        signatureS3Key: string;
        signerName: string;
        pageIndex?: number; // default 0 (last page)
    }>
): Promise<string> {
    // Download the original PDF
    const pdfBuffer = await downloadPdfFromS3(originalS3Key);
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];

    // Place each signature on the document
    let yOffset = 80;
    for (const sig of signatures) {
        try {
            const sigBuffer = await downloadSignatureFromS3(sig.signatureS3Key);
            const sigImage = await pdfDoc.embedPng(sigBuffer).catch(async () => {
                // Try JPEG if PNG fails
                return pdfDoc.embedJpg(sigBuffer);
            });

            const targetPage = sig.pageIndex !== undefined ? pages[sig.pageIndex] : lastPage;
            const { width } = targetPage.getSize();

            // Place signature: 150x60px, right-aligned with signer name below
            const sigWidth = 150;
            const sigHeight = 60;
            const xPos = width - sigWidth - 50;

            targetPage.drawImage(sigImage, {
                x: xPos,
                y: yOffset,
                width: sigWidth,
                height: sigHeight,
            });

            // Add signer name text below the signature
            targetPage.drawText(sig.signerName, {
                x: xPos,
                y: yOffset - 15,
                size: 9,
            });

            yOffset += 90;
        } catch (err) {
            console.error(`Failed to apply signature for ${sig.signerName}:`, err);
        }
    }

    // Save and upload the signed PDF
    const signedPdfBytes = await pdfDoc.save();
    const signedBuffer = Buffer.from(signedPdfBytes);
    const signedKey = originalS3Key.replace('.pdf', '-signed.pdf').replace(
        'contracts/',
        'contracts/signed/'
    );

    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: signedKey,
            Body: signedBuffer,
            ContentType: 'application/pdf',
        })
    );

    return signedKey;
}

/**
 * Generate a public signing URL
 */
export function generateSigningUrl(signToken: string): string {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}/contracts/sign/${signToken}`;
}

/**
 * Check if a contract has been fully signed and finalize it
 */
export async function checkAndFinalizeContract(
    contractId: string,
    prisma: any
): Promise<boolean> {
    const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: { signers: true },
    });

    if (!contract) return false;

    const allSigned = contract.signers.every(
        (s: any) => s.status === 'SIGNED'
    );

    if (allSigned && contract.signers.length > 0) {
        // Build signed PDF
        const signaturesData = contract.signers
            .filter((s: any) => s.signatureS3Key)
            .map((s: any) => ({
                signatureS3Key: s.signatureS3Key,
                signerName: s.name,
            }));

        let signedS3Key = null;
        try {
            signedS3Key = await applySignaturesToPdf(contract.s3Key, signaturesData);
        } catch (err) {
            console.error('Failed to generate signed PDF:', err);
        }

        await prisma.contract.update({
            where: { id: contractId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                signedS3Key,
            },
        });

        // Audit log
        await prisma.contractAuditLog.create({
            data: {
                contractId,
                action: 'completed',
                performedBy: 'system',
                details: JSON.stringify({
                    message: 'All signers have signed. Contract completed.',
                    signedPdfKey: signedS3Key,
                }),
            },
        });

        return true;
    }

    // Check if at least one signer signed -> PARTIALLY_SIGNED
    const anySigned = contract.signers.some((s: any) => s.status === 'SIGNED');
    if (anySigned && contract.status === 'SENT') {
        await prisma.contract.update({
            where: { id: contractId },
            data: { status: 'PARTIALLY_SIGNED' },
        });
    }

    return false;
}
