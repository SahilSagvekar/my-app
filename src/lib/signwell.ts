// lib/signwell.ts
// SignWell API integration for contract signing

const SIGNWELL_API_URL = 'https://www.signwell.com/api/v1';
const SIGNWELL_API_KEY = process.env.SIGNWELL_API_KEY!;

function signwellHeaders() {
  return {
    'X-Api-Token': SIGNWELL_API_KEY,
    'Content-Type': 'application/json',
  };
}

export interface SignWellSigner {
  id: string;
  name: string;
  email: string;
  send_email?: boolean;
  send_email_delay?: number;
}

export interface SignWellField {
  api_id: string;
  value: string;
}

// Create a document from a template and send for signing
export async function createSignWellDocument(params: {
  templateId: string;
  subject: string;
  message: string;
  signers: SignWellSigner[];
  fields?: SignWellField[];
  testMode?: boolean;
}): Promise<{
  id: string;
  status: string;
  signers: Array<{ id: string; name: string; email: string; embedded_signing_url?: string }>;
}> {
  const body = {
    test_mode: params.testMode ?? process.env.NODE_ENV !== 'production',
    template_id: params.templateId,
    subject: params.subject,
    message: params.message,
    signers: params.signers,
    fields: params.fields || [],
    // Send via email by default (v1 — embedded is phase later)
    send_email: true,
  };

  const res = await fetch(`${SIGNWELL_API_URL}/document_templates/documents`, {
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

// Get a document by ID
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

// Download completed document PDF as a Buffer
export async function downloadSignWellPdf(documentId: string): Promise<Buffer> {
  const res = await fetch(`${SIGNWELL_API_URL}/documents/${documentId}/completed_pdf`, {
    headers: signwellHeaders(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SignWell PDF download error (${res.status}): ${err}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Void/cancel a document
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

// Build the merge fields from a quote + client for the contract template
export function buildContractFields(params: {
  clientName: string;
  companyName: string | null;
  email: string;
  totalAmount: number; // cents
  services: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  startDate: string;
}): SignWellField[] {
  const total = `$${(params.totalAmount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const servicesSummary = params.services
    .map((s) => `${s.description}: $${(s.total / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo`)
    .join('\n');

  return [
    { api_id: 'client_name',      value: params.clientName },
    { api_id: 'company_name',     value: params.companyName || params.clientName },
    { api_id: 'client_email',     value: params.email },
    { api_id: 'monthly_total',    value: total },
    { api_id: 'services_summary', value: servicesSummary },
    { api_id: 'start_date',       value: params.startDate },
    { api_id: 'contract_date',    value: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
  ];
}
