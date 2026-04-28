import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  buildLinkedinLeadIdentity,
  buildLinkedinSocials,
  mapLinkedinConfidenceToPriority,
  RemoteLinkedinLead,
} from '@/lib/linkedin-leads';

export interface LinkedinJobPayload {
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

const ACTIVE_STATUSES = new Set(['QUEUED', 'RUNNING']);
const TERMINAL_STATUSES = new Set([
  'COMPLETED',
  'PARTIAL_SUCCESS',
  'NO_RESULTS',
  'FAILED',
  'PLATFORM_DRIFT',
  'ANTI_BOT',
]);
const FAILURE_STATUSES = new Set(['FAILED', 'PLATFORM_DRIFT', 'ANTI_BOT']);

function asMetadataRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, unknown>) };
}

function defaultProviderMessage(payload: LinkedinJobPayload, importedLeads = 0) {
  switch (payload.status) {
    case 'QUEUED':
      return 'Waiting for LinkedIn lead service';
    case 'RUNNING':
      return payload.provider_message || 'LinkedIn lead generation is running';
    case 'COMPLETED':
      return payload.provider_message || `Imported ${importedLeads} new LinkedIn leads`;
    case 'PARTIAL_SUCCESS':
      return (
        payload.provider_message ||
        `Imported ${importedLeads} LinkedIn leads, but some searches hit recoverable issues.`
      );
    case 'NO_RESULTS':
      return (
        payload.provider_message ||
        'LinkedIn search ran successfully, but there were no qualified leads to import.'
      );
    case 'PLATFORM_DRIFT':
      return (
        payload.provider_message ||
        'LinkedIn changed the search layout, so this run paused instead of returning fake zero leads.'
      );
    case 'ANTI_BOT':
      return (
        payload.provider_message ||
        'LinkedIn blocked the run with a login or security challenge.'
      );
    case 'FAILED':
    default:
      return payload.provider_message || 'LinkedIn lead generation failed';
  }
}

async function findExistingLinkedinLead(
  lead: RemoteLinkedinLead,
  externalId: string,
  normalizedPostUrl: string | null,
) {
  const duplicateChecks: Prisma.SalesLeadWhereInput[] = [
    {
      externalSource: 'linkedin',
      externalId,
    },
  ];
  const postUrls = new Set<string>();

  if (normalizedPostUrl) {
    postUrls.add(normalizedPostUrl);
  }

  const rawPostUrl = lead.post_url?.trim();
  if (rawPostUrl) {
    postUrls.add(rawPostUrl);
  }

  for (const postUrl of postUrls) {
    duplicateChecks.push({ postUrl });
    duplicateChecks.push({ externalUrl: postUrl });
  }

  return prisma.salesLead.findFirst({
    where: {
      OR: duplicateChecks,
    },
  });
}

export function isLinkedinJobTerminalStatus(status?: string | null) {
  return TERMINAL_STATUSES.has((status || '').toUpperCase());
}

export function isLinkedinJobActiveStatus(status?: string | null) {
  return ACTIVE_STATUSES.has((status || '').toUpperCase());
}

export async function failLinkedinJobByExternalId(
  externalJobId: string,
  {
    errorMessage,
    providerMessage,
    metadata,
  }: {
    errorMessage: string;
    providerMessage?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const job = await prisma.salesLeadGenerationJob.findUnique({
    where: { externalJobId },
  });

  if (!job) {
    return null;
  }

  const existingMetadata = asMetadataRecord(job.metadata);
  const mergedMetadata: Record<string, unknown> = {
    ...existingMetadata,
    ...(metadata || {}),
    lastLinkedinSyncAt: new Date().toISOString(),
    lastLinkedinSyncSource: 'status-poll',
  };

  return prisma.salesLeadGenerationJob.update({
    where: { id: job.id },
    data: {
      status: 'FAILED',
      completedAt: job.completedAt ?? new Date(),
      errorMessage,
      providerMessage: providerMessage || errorMessage,
      metadata: mergedMetadata,
    },
  });
}

export async function importCompletedLeads(
  userId: number,
  externalJobId: string,
  leads: RemoteLinkedinLead[],
) {
  let importedLeads = 0;
  let duplicateLeads = 0;

  for (const lead of leads) {
    const identity = buildLinkedinLeadIdentity(lead);
    if (!identity) {
      duplicateLeads += 1;
      continue;
    }

    const profileUrl = identity.normalizedProfileUrl || lead.profile_url || null;
    const postUrl = identity.normalizedPostUrl || lead.post_url || null;
    const externalUrl = postUrl || profileUrl;
    const existing = await findExistingLinkedinLead(lead, identity.externalId, identity.normalizedPostUrl);

    if (existing) {
      duplicateLeads += 1;
      continue;
    }

    try {
      await prisma.salesLead.create({
        data: {
          userId,
          name: lead.name || '',
          source: 'LinkedIn',
          status: 'NEW',
          priority: mapLinkedinConfidenceToPriority(lead.confidence),
          linkedin: true,
          profileUrl: profileUrl,
          postUrl: postUrl,
          socials: buildLinkedinSocials(profileUrl),
          externalSource: 'linkedin',
          externalId: identity.externalId,
          externalUrl,
          metadata: {
            linkedinLead: {
              provider: 'linkedin',
              externalJobId,
              leadKey: identity.externalId,
              leadKeySource: identity.dedupeSource,
              profileUrl,
              postUrl,
              postText: lead.post_text || '',
              detectedNeed: lead.detected_need || '',
              matchedService: lead.matched_service || '',
              niche: lead.niche || '',
              suggestedMessage: lead.suggested_message || '',
              confidence: lead.confidence || '',
              keyword: lead.keyword || '',
              analysisSource: lead.analysis_source || '',
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        duplicateLeads += 1;
        continue;
      }

      throw error;
    }

    importedLeads += 1;
  }

  return { importedLeads, duplicateLeads };
}

export async function applyLinkedinJobUpdate(
  payload: LinkedinJobPayload,
  source: 'callback' | 'status-poll' = 'callback',
) {
  const job = await prisma.salesLeadGenerationJob.findUnique({
    where: {
      externalJobId: payload.job_id,
    },
  });

  if (!job) {
    return { ok: false as const, reason: 'job_not_found' as const };
  }

  const nowIso = new Date().toISOString();
  const existingMetadata = asMetadataRecord(job.metadata);
  const payloadMetadata = asMetadataRecord(payload.metadata);
  const mergedMetadata: Record<string, unknown> = {
    ...existingMetadata,
    ...payloadMetadata,
    lastLinkedinSyncAt: nowIso,
    lastLinkedinSyncSource: source,
  };

  if (source === 'callback') {
    mergedMetadata.callbackReceivedAt = nowIso;
  }

  if (ACTIVE_STATUSES.has(payload.status)) {
    const updatedJob = await prisma.salesLeadGenerationJob.update({
      where: { id: job.id },
      data: {
        status: payload.status,
        startedAt: payload.started_at ? new Date(payload.started_at) : job.startedAt,
        totalLeads: payload.total_leads ?? job.totalLeads,
        errorMessage: null,
        providerMessage: defaultProviderMessage(payload),
        metadata: mergedMetadata,
      },
    });

    return { ok: true as const, job: updatedJob, importedLeads: 0, duplicateLeads: 0 };
  }

  if (
    job.importedAt &&
    isLinkedinJobTerminalStatus(job.status) &&
    isLinkedinJobTerminalStatus(payload.status)
  ) {
    const updatedJob = await prisma.salesLeadGenerationJob.update({
      where: { id: job.id },
      data: {
        status: payload.status,
        completedAt: payload.completed_at ? new Date(payload.completed_at) : job.completedAt,
        totalLeads: payload.total_leads ?? job.totalLeads,
        providerMessage: defaultProviderMessage(payload, job.importedLeads),
        errorMessage: FAILURE_STATUSES.has(payload.status)
          ? payload.error || defaultProviderMessage(payload)
          : null,
        metadata: mergedMetadata,
      },
    });

    return {
      ok: true as const,
      job: updatedJob,
      importedLeads: updatedJob.importedLeads,
      duplicateLeads: updatedJob.duplicateLeads,
      alreadyImported: true as const,
    };
  }

  if (FAILURE_STATUSES.has(payload.status)) {
    const updatedJob = await prisma.salesLeadGenerationJob.update({
      where: { id: job.id },
      data: {
        status: payload.status,
        startedAt: payload.started_at ? new Date(payload.started_at) : job.startedAt,
        completedAt: payload.completed_at ? new Date(payload.completed_at) : new Date(),
        importedAt: new Date(),
        totalLeads: payload.total_leads ?? 0,
        importedLeads: 0,
        duplicateLeads: 0,
        errorMessage: payload.error || defaultProviderMessage(payload),
        providerMessage: defaultProviderMessage(payload),
        metadata: mergedMetadata,
      },
    });

    return { ok: true as const, job: updatedJob, importedLeads: 0, duplicateLeads: 0 };
  }

  const leads = payload.leads || [];
  const { importedLeads, duplicateLeads } = await importCompletedLeads(
    job.userId,
    payload.job_id,
    leads,
  );

  const updatedJob = await prisma.salesLeadGenerationJob.update({
    where: { id: job.id },
    data: {
      status: payload.status,
      startedAt: payload.started_at ? new Date(payload.started_at) : job.startedAt,
      completedAt: payload.completed_at ? new Date(payload.completed_at) : new Date(),
      importedAt: new Date(),
      totalLeads: payload.total_leads ?? leads.length,
      importedLeads,
      duplicateLeads,
      errorMessage: null,
      providerMessage: defaultProviderMessage(payload, importedLeads),
      metadata: mergedMetadata,
    },
  });

  return { ok: true as const, job: updatedJob, importedLeads, duplicateLeads };
}
