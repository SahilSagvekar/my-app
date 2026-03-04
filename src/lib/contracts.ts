// src/lib/contracts.ts
// Shared utilities for the contracts feature

import crypto from 'crypto';
import { PDFDocument, rgb } from 'pdf-lib';
import { s3, generateSignedUrl } from './s3';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.AWS_S3_BUCKET!;

/**
 * Apply decorations (text, highlights, field placeholders) to a PDF buffer from editor annotations
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

        // Legacy: bake text with actual content
        if (ann.type === 'text' && ann.text) {
            page.drawText(ann.text, {
                x,
                y: y + 2,
                size: 10,
                color: rgb(0.1, 0.1, 0.1),
            });
            continue;
        }

        // Legacy: highlight rectangles
        if (ann.type === 'rect') {
            page.drawRectangle({
                x, y, width, height,
                color: rgb(1, 0.95, 0.3),
                opacity: 0.4,
            });
            continue;
        }

        // --- Editor field types: draw styled placeholder boxes ---
        // Determine colors and label based on field type
        let borderR = 0.31, borderG = 0.27, borderB = 0.9; // Indigo (#4f46e5)
        let bgR = 0.95, bgG = 0.96, bgB = 1.0;
        let label = ann.placeholder || ann.fieldName || ann.type || 'Field';

        if (ann.type === 'signature' || ann.type === 'initials') {
            label = ann.type === 'signature' ? 'Signature' : 'Initials';
        } else if (ann.type === 'date_signed') {
            label = 'Date Signed';
        } else if (ann.type === 'full_name') {
            label = 'Full Name';
        } else if (ann.type === 'email_address') {
            label = 'Email';
        } else if (ann.type === 'company') {
            label = 'Company';
        } else if (ann.type === 'title') {
            label = 'Title';
        } else if (ann.type === 'checkbox') {
            label = '☐';
        } else if (ann.type === 'dropdown') {
            label = 'Select...';
        }

        // Draw the placeholder box
        page.drawRectangle({
            x, y, width, height,
            borderColor: rgb(borderR, borderG, borderB),
            borderWidth: 1,
            color: rgb(bgR, bgG, bgB),
            opacity: 0.3,
        });

        // Draw the label text inside the box
        const fontSize = ann.type === 'checkbox' ? 10 : Math.min(8, height * 0.6);
        page.drawText(label, {
            x: x + 3,
            y: y + (height / 2) - (fontSize / 2),
            size: fontSize,
            color: rgb(0.2, 0.2, 0.4),
        });
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
    const pdfBuffer = await downloadPdfFromS3(originalS3Key);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    let annotations: any[] = [];
    if (annotationsJson) {
        annotations = typeof annotationsJson === 'string' ? JSON.parse(annotationsJson) : annotationsJson;
    }

    if (!Array.isArray(annotations)) annotations = [];

    // Process all annotations
    for (const ann of annotations) {
        const pageIndex = ann.page || 0;
        if (pageIndex >= pages.length) continue;

        const page = pages[pageIndex];
        const { width: pWidth, height: pHeight } = page.getSize();

        // PDF coordinates start from bottom-left (percentages)
        const x = (ann.x / 100) * pWidth;
        const width = (ann.width / 100) * pWidth;
        const height = (ann.height / 100) * pHeight;
        const y = ((100 - ann.y - ann.height) / 100) * pHeight;

        // Draw signatures/initials
        if ((ann.type === 'signature' || ann.type === 'initials') && ann.signatureS3Key) {
            try {
                const sigBuffer = await downloadSignatureFromS3(ann.signatureS3Key);
                const sigImage = await pdfDoc.embedPng(sigBuffer).catch(async () => {
                    return pdfDoc.embedJpg(sigBuffer);
                });

                page.drawImage(sigImage, { x, y, width, height });

                // Signer name metadata
                page.drawText(`Signed by ${ann.assignedTo}`, {
                    x, y: y - 8, size: 6, opacity: 0.5
                });
            } catch (err) {
                console.error('Failed to apply signature annotation:', err);
            }
        }

        // Draw text fields
        else if (ann.value && ann.type !== 'checkbox') {
            page.drawText(String(ann.value), {
                x: x + 2,
                y: y + (height / 2) - 3,
                size: 10,
                color: rgb(0.1, 0.1, 0.1),
            });
        }

        // Draw checkboxes
        else if (ann.type === 'checkbox' && (ann.value === true || ann.value === 'true')) {
            page.drawText('X', {
                x: x + (width / 2) - 4,
                y: y + (height / 2) - 4,
                size: 11,
                color: rgb(0, 0, 0),
            });
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
