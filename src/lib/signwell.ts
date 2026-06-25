// lib/signwell.ts — SignWell API integration

const SIGNWELL_API_URL = 'https://www.signwell.com/api/v1';

function signwellHeaders(contentType = 'application/json') {
  
  return {
    'X-Api-Token': process.env.SIGNWELL_API_KEY!,
    'Content-Type': contentType,
  };
}

export interface SignWellSigner {
  id: string;
  name: string;
  email: string;
  send_email?: boolean;
}

// ── Create document from a raw PDF file (base64) ─────────────────────────────
// This is the main flow: admin uploads a PDF → we send it to SignWell
export async function createSignWellDocumentFromFile(params: {
  name: string;
  subject: string;
  message?: string;
  fileBase64: string;       // base64 encoded PDF
  fileName: string;
  signers: SignWellSigner[];
  expiresInDays?: number;
  testMode?: boolean;
  embeddedSigning?: boolean; // request embedded signing URLs
}): Promise<{
  id: string;
  status: string;
  signers: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    embedded_signing_url?: string;
  }>;
}> {
  const body: any = {
    test_mode: params.testMode ?? process.env.NODE_ENV !== 'production',
    name: params.name,
    subject: params.subject,
    message: params.message || '',
    send_email: true,
    embedded_signing: params.embeddedSigning ?? true,
    files: [
      {
        name: params.fileName,
        file_base64: params.fileBase64,
      },
    ],
    signers: params.signers.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      send_email: s.send_email ?? true,
    })),
  };

  if (params.expiresInDays) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + params.expiresInDays);
    body.expires_at = expiry.toISOString();
  }

  const res = await fetch(`${SIGNWELL_API_URL}/documents`, {
    method: 'POST',
    headers: signwellHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SignWell API error (${res.status}): ${err}`);
  }

  return res.json();
}

// ── Get document status ───────────────────────────────────────────────────────
export async function getSignWellDocument(documentId: string) {
  const res = await fetch(`${SIGNWELL_API_URL}/documents/${documentId}`, {
    headers: signwellHeaders(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SignWell API error (${res.status}): ${err}`);
  }

  return res.json();
}

// ── Download completed signed PDF ─────────────────────────────────────────────
export async function downloadSignWellPdf(documentId: string): Promise<Buffer> {
  const res = await fetch(
    `${SIGNWELL_API_URL}/documents/${documentId}/completed_pdf`,
    { headers: signwellHeaders() }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SignWell PDF download error (${res.status}): ${err}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── Send reminder to pending signers ─────────────────────────────────────────
export async function remindSignWellDocument(documentId: string): Promise<void> {
  const res = await fetch(
    `${SIGNWELL_API_URL}/documents/${documentId}/send_reminders`,
    { method: 'POST', headers: signwellHeaders() }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SignWell remind error (${res.status}): ${err}`);
  }
}

// ── Void/cancel a document ───────────────────────────────────────────────────
export async function voidSignWellDocument(documentId: string): Promise<void> {
  const res = await fetch(`${SIGNWELL_API_URL}/documents/${documentId}/void`, {
    method: 'PUT',
    headers: signwellHeaders(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SignWell void error (${res.status}): ${err}`);
  }
}

// ── Get embedded signing URL for a specific signer ───────────────────────────
export async function getEmbeddedSigningUrl(
  documentId: string,
  signerId: string
): Promise<string> {
  const doc = await getSignWellDocument(documentId);
  const signer = doc.signers?.find((s: any) => s.id === signerId);
  if (!signer?.embedded_signing_url) {
    throw new Error('Embedded signing URL not available for this signer');
  }
  return signer.embedded_signing_url;
}

// ── Map SignWell status to our ContractStatus enum ───────────────────────────
export function mapSignWellStatus(signwellStatus: string): string {
  const map: Record<string, string> = {
    draft:             'DRAFT',
    pending:           'SENT',
    in_progress:       'SENT',
    awaiting_signature:'SENT',
    completed:         'COMPLETED',
    declined:          'CANCELLED',
    voided:            'CANCELLED',
    expired:           'EXPIRED',
  };
  return map[signwellStatus?.toLowerCase()] || 'SENT';
}

// ── Map SignWell signer status ────────────────────────────────────────────────
export function mapSignWellSignerStatus(status: string): string {
  const map: Record<string, string> = {
    pending:  'PENDING',
    viewed:   'VIEWED',
    signed:   'SIGNED',
    declined: 'DECLINED',
  };
  return map[status?.toLowerCase()] || 'PENDING';
}
