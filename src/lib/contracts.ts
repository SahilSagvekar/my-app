// src/lib/contracts.ts
// Shared utilities for the contracts feature

import crypto from 'crypto';
import { PDFDocument, rgb } from 'pdf-lib';
import { s3, generateSignedUrl } from './s3';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.AWS_S3_BUCKET!;

/**
 * Apply decorations (text, highlights) to a PDF buffer from create-time annotations
 */
export async function applyAnnotationsToBuffer(
    buffer: Buffer,
    annotationsJson: string | any[]
): Promise<Buffer> {
    let annotations: any[] = [];
    if (typeof annotationsJson === 'string') {
        try {
            annotations = JSON.parse(annotationsJson);
        } catch {
            return buffer;
        }
    } else {
        annotations = annotationsJson;
    }

    if (!annotations || !Array.isArray(annotations) || annotations.length === 0) {
        return buffer;
    }

    const pdfDoc = await PDFDocument.load(buffer);
    const pages = pdfDoc.getPages();

    for (const ann of annotations) {
        // We only "bake-in" permanent edits like text and highlights
        // Signature fields are stored to be used later during the signing flow
        if (ann.type !== 'text' && ann.type !== 'rect' && ann.type !== 'signature-field') continue;

        const pageIndex = ann.page || 0;
        if (pageIndex >= pages.length) continue;

        const page = pages[pageIndex];
        const { width: pWidth, height: pHeight } = page.getSize();

        // PDF coordinates start from bottom-left
        // UI coordinates start from top-left (percentages)
        const x = (ann.x / 100) * pWidth;
        const width = (ann.width / 100) * pWidth;
        const height = (ann.height / 100) * pHeight;
        const y = ((100 - ann.y - ann.height) / 100) * pHeight;

        if (ann.type === 'text' && ann.text) {
            page.drawText(ann.text, {
                x,
                y: y + 2, // baseline adjustment
                size: 10,
                color: rgb(0.1, 0.1, 0.1),
            });
        } else if (ann.type === 'rect') {
            page.drawRectangle({
                x,
                y,
                width,
                height,
                color: rgb(1, 0.95, 0.3), // Highlighter yellow
                opacity: 0.4,
            });
        } else if (ann.type === 'signature-field') {
            // Draw a light placeholder for the signature field
            page.drawRectangle({
                x,
                y,
                width,
                height,
                borderColor: rgb(0.2, 0.5, 0.9),
                borderWidth: 1,
                color: rgb(0.9, 0.95, 1),
                opacity: 0.2,
            });
            page.drawText('Signature Field', {
                x: x + 5,
                y: y + (height / 2) - 4,
                size: 7,
                color: rgb(0.4, 0.4, 0.4),
            });
        }
    }

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
}

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
    }>,
    annotationsJson?: any
): Promise<string> {
    // Download the original PDF
    const pdfBuffer = await downloadPdfFromS3(originalS3Key);
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    const pages = pdfDoc.getPages();

    let annotations: any[] = [];
    if (annotationsJson) {
        annotations = typeof annotationsJson === 'string' ? JSON.parse(annotationsJson) : annotationsJson;
    }

    const signatureFields = annotations.filter(a => a.type === 'signature-field');

    // Place each signature on the document
    for (let i = 0; i < signatures.length; i++) {
        const sig = signatures[i];
        try {
            const sigBuffer = await downloadSignatureFromS3(sig.signatureS3Key);
            const sigImage = await pdfDoc.embedPng(sigBuffer).catch(async () => {
                // Try JPEG if PNG fails
                return pdfDoc.embedJpg(sigBuffer);
            });

            const field = signatureFields[i];
            let targetPage, x, y, width, height;

            if (field) {
                targetPage = pages[field.page || 0];
                const { width: pWidth, height: pHeight } = targetPage.getSize();
                x = (field.x / 100) * pWidth;
                width = (field.width / 100) * pWidth;
                height = (field.height / 100) * pHeight;
                y = ((100 - field.y - field.height) / 100) * pHeight;
            } else {
                // Fallback: bottom of last page
                targetPage = pages[pages.length - 1];
                const { width: pWidth } = targetPage.getSize();
                width = 150;
                height = 60;
                x = pWidth - width - 50;
                y = 80 + (i * 90);
            }

            targetPage.drawImage(sigImage, {
                x,
                y,
                width,
                height,
            });

            // Add signer name text below the signature
            targetPage.drawText(sig.signerName, {
                x,
                y: y - 15,
                size: 9,
            });
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
            signedS3Key = await applySignaturesToPdf(contract.s3Key, signaturesData, contract.annotations);
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
