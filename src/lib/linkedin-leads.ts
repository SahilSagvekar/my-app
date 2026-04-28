import { createHash } from 'node:crypto';

export interface RemoteLinkedinLead {
  name?: string;
  profile_url?: string;
  post_url?: string;
  post_text?: string;
  detected_need?: string;
  matched_service?: string;
  niche?: string;
  suggested_message?: string;
  confidence?: string;
  keyword?: string;
  analysis_source?: string;
}

export interface RemoteLinkedinJob {
  job_id: string;
  provider?: string;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
  total_leads?: number;
  error?: string | null;
  provider_message?: string | null;
  metadata?: Record<string, unknown> | null;
  leads?: RemoteLinkedinLead[];
}

export class LinkedinLeadServiceError extends Error {
  status: number;
  responseText: string;

  constructor(status: number, responseText: string) {
    super(`LinkedIn lead service returned ${status}: ${responseText}`);
    this.name = 'LinkedinLeadServiceError';
    this.status = status;
    this.responseText = responseText;
  }
}

interface StartLinkedinJobParams {
  callbackUrl: string;
  callbackSecret?: string;
}

const LINKEDIN_LEAD_API_URL = process.env.LINKEDIN_LEAD_API_URL;
const LINKEDIN_LEAD_API_KEY = process.env.LINKEDIN_LEAD_API_KEY;

export interface LinkedinLeadIdentityInput {
  profile_url?: string | null;
  post_url?: string | null;
  post_text?: string | null;
  profileUrl?: string | null;
  postUrl?: string | null;
  postText?: string | null;
}

export interface LinkedinLeadIdentity {
  externalId: string;
  normalizedProfileUrl: string | null;
  normalizedPostUrl: string | null;
  dedupeSource: 'post_url' | 'profile_url+post_text';
}

export function getLinkedinLeadApiUrl() {
  if (!LINKEDIN_LEAD_API_URL) {
    throw new Error('LINKEDIN_LEAD_API_URL is not configured');
  }

  return LINKEDIN_LEAD_API_URL.replace(/\/+$/, '');
}

function getLinkedinLeadApiHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (LINKEDIN_LEAD_API_KEY) {
    headers['x-api-key'] = LINKEDIN_LEAD_API_KEY;
  }

  return headers;
}

function getLinkedinLeadJobsEndpoint() {
  const baseUrl = getLinkedinLeadApiUrl();

  if (baseUrl.endsWith('/api/scrape/jobs')) {
    return baseUrl;
  }

  if (baseUrl.endsWith('/api/scrape')) {
    return `${baseUrl}/jobs`;
  }

  return `${baseUrl}/api/scrape/jobs`;
}

function getLinkedinLeadJobEndpoint(jobId: string, includeLeads: boolean) {
  const query = `include_leads=${includeLeads ? 'true' : 'false'}`;
  return `${getLinkedinLeadJobsEndpoint()}/${jobId}?${query}`;
}

export async function startLinkedinLeadJob({
  callbackUrl,
  callbackSecret,
}: StartLinkedinJobParams) {
  const response = await fetch(getLinkedinLeadJobsEndpoint(), {
    method: 'POST',
    headers: getLinkedinLeadApiHeaders(),
    body: JSON.stringify({
      callback_url: callbackUrl,
      callback_secret: callbackSecret,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new LinkedinLeadServiceError(response.status, errorText);
  }

  return response.json();
}

export async function getLinkedinLeadJob(jobId: string, includeLeads = false) {
  const response = await fetch(getLinkedinLeadJobEndpoint(jobId, includeLeads), {
    headers: getLinkedinLeadApiHeaders(),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new LinkedinLeadServiceError(response.status, errorText);
  }

  return response.json() as Promise<RemoteLinkedinJob>;
}

function normalizeLinkedinUrl(url?: string | null) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${parsed.pathname}`.toLowerCase();
  } catch {
    return url.trim().replace(/\/+$/, '').toLowerCase();
  }
}

function normalizeLinkedinLeadText(text?: string | null) {
  if (!text) return '';

  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function hashLinkedinLeadIdentity(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeLinkedinProfileUrl(url?: string | null) {
  return normalizeLinkedinUrl(url);
}

export function normalizeLinkedinPostUrl(url?: string | null) {
  return normalizeLinkedinUrl(url);
}

export function buildLinkedinLeadIdentity(lead: LinkedinLeadIdentityInput): LinkedinLeadIdentity | null {
  const normalizedProfileUrl = normalizeLinkedinProfileUrl(lead.profile_url ?? lead.profileUrl);
  const normalizedPostUrl = normalizeLinkedinPostUrl(lead.post_url ?? lead.postUrl);
  if (normalizedPostUrl) {
    return {
      externalId: `post:${normalizedPostUrl}`,
      normalizedProfileUrl,
      normalizedPostUrl,
      dedupeSource: 'post_url',
    };
  }

  const normalizedPostText = normalizeLinkedinLeadText(lead.post_text ?? lead.postText);
  if (!normalizedProfileUrl || !normalizedPostText) {
    return null;
  }

  // Fall back to profile + post text only when LinkedIn does not expose a stable post URL.
  return {
    externalId: `fallback:${hashLinkedinLeadIdentity(`${normalizedProfileUrl}\n${normalizedPostText}`)}`,
    normalizedProfileUrl,
    normalizedPostUrl: null,
    dedupeSource: 'profile_url+post_text',
  };
}

export function buildLinkedinSocials(profileUrl?: string | null) {
  if (!profileUrl) return '';

  return JSON.stringify([
    {
      platform: 'linkedin',
      url: profileUrl,
    },
  ]);
}

export function mapLinkedinConfidenceToPriority(confidence?: string | null) {
  switch ((confidence || '').toLowerCase()) {
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return '';
  }
}
