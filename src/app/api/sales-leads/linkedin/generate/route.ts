export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

import {
  applyLinkedinJobUpdate,
  failLinkedinJobByExternalId,
  isLinkedinJobActiveStatus,
} from '@/lib/linkedin-lead-jobs';
import {
  getLinkedinLeadJob,
  LinkedinLeadServiceError,
  startLinkedinLeadJob,
} from '@/lib/linkedin-leads';
import { prisma } from '@/lib/prisma';

interface AuthorizedUserToken {
  userId: number;
  role: 'sales' | 'admin' | string;
}

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

async function getAuthorizedUser(req: NextRequest) {
  const token = getTokenFromCookies(req);
  if (!token) {
    throw new Response(JSON.stringify({ ok: false, message: 'Unauthorized' }), { status: 401 });
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthorizedUserToken;
  if (!decoded?.userId || (decoded.role !== 'sales' && decoded.role !== 'admin')) {
    throw new Response(JSON.stringify({ ok: false, message: 'Forbidden' }), { status: 403 });
  }

  return decoded;
}

export async function GET(req: NextRequest) {
  try {
    const decoded = await getAuthorizedUser(req);

    let job = await prisma.salesLeadGenerationJob.findFirst({
      where: {
        userId: decoded.userId,
        provider: 'LINKEDIN',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (job?.externalJobId && isLinkedinJobActiveStatus(job.status)) {
      try {
        const remoteJob = await getLinkedinLeadJob(job.externalJobId, true);
        const syncResult = await applyLinkedinJobUpdate(remoteJob, 'status-poll');
        if (syncResult.ok) {
          job = syncResult.job;
        }
      } catch (error) {
        if (error instanceof LinkedinLeadServiceError && error.status === 404) {
          job = await failLinkedinJobByExternalId(job.externalJobId, {
            errorMessage:
              'LinkedIn lead service restarted while this run was active, so the in-flight job was lost. Please run Generate Leads again.',
            providerMessage:
              'LinkedIn lead service restarted during this run. Start a new run when you are ready.',
            metadata: {
              remoteJobMissing: true,
              remoteJobMissingAt: new Date().toISOString(),
            },
          });
        } else {
          console.error(
            `[GET /api/sales-leads/linkedin/generate] Failed syncing external job ${job.externalJobId}`,
            error,
          );
        }
      }
    }

    return NextResponse.json({ ok: true, job });
  } catch (err) {
    if (err instanceof Response) {
      return err;
    }

    console.error('[GET /api/sales-leads/linkedin/generate]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const decoded = await getAuthorizedUser(req);
    const callbackBaseUrl =
      process.env.LINKEDIN_LEAD_CALLBACK_BASE_URL?.replace(/\/+$/, '') ||
      req.nextUrl.origin.replace(/\/+$/, '');

    const existingJob = await prisma.salesLeadGenerationJob.findFirst({
      where: {
        userId: decoded.userId,
        provider: 'LINKEDIN',
        status: {
          in: ['QUEUED', 'RUNNING'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingJob) {
      if (!existingJob.externalJobId) {
        await prisma.salesLeadGenerationJob.update({
          where: { id: existingJob.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage:
              'This LinkedIn run never received a remote job ID from the scraper service. Please start a new run.',
            providerMessage:
              'The previous LinkedIn run did not start cleanly. Starting a fresh run now.',
          },
        });
      } else {
      try {
        const remoteJob = await getLinkedinLeadJob(existingJob.externalJobId, false);
        const syncResult = await applyLinkedinJobUpdate(remoteJob, 'status-poll');

        if (syncResult.ok && isLinkedinJobActiveStatus(syncResult.job.status)) {
          return NextResponse.json({
            ok: true,
            alreadyRunning: true,
            job: syncResult.job,
          });
        }
      } catch (error) {
        if (error instanceof LinkedinLeadServiceError && error.status === 404 && existingJob.externalJobId) {
          await failLinkedinJobByExternalId(existingJob.externalJobId, {
            errorMessage:
              'LinkedIn lead service restarted while this run was active, so the in-flight job was lost. Please run Generate Leads again.',
            providerMessage:
              'The previous LinkedIn run was interrupted by a scraper-service restart. Starting a fresh run now.',
            metadata: {
              remoteJobMissing: true,
              remoteJobMissingAt: new Date().toISOString(),
            },
          });
        } else {
          console.error(
            `[POST /api/sales-leads/linkedin/generate] Failed syncing external job ${existingJob.externalJobId}`,
            error,
          );

          return NextResponse.json({
            ok: true,
            alreadyRunning: true,
            job: existingJob,
          });
        }
      }
      }
    }

    const localJob = await prisma.salesLeadGenerationJob.create({
      data: {
        userId: decoded.userId,
        provider: 'LINKEDIN',
        status: 'QUEUED',
        providerMessage: 'Waiting for LinkedIn lead service',
        metadata: {
          requestedFrom: 'sales-dashboard',
        },
      },
    });

    try {
      const callbackUrl = `${callbackBaseUrl}/api/integration/linkedin-leads/callback`;
      const remoteJob = await startLinkedinLeadJob({
        callbackUrl,
        callbackSecret: process.env.LINKEDIN_LEAD_CALLBACK_SECRET,
      });

      const job = await prisma.salesLeadGenerationJob.update({
        where: { id: localJob.id },
        data: {
          status: remoteJob.status || 'RUNNING',
          externalJobId: remoteJob.job_id,
          providerMessage: remoteJob.provider_message || 'LinkedIn lead generation is running',
          metadata: {
            requestedFrom: 'sales-dashboard',
            callbackUrl,
            remoteProvider: remoteJob.provider || 'linkedin',
            remoteStartedAt: remoteJob.started_at || null,
          },
        },
      });

      console.log(
        `[LinkedIn Lead Sync] Started job ${remoteJob.job_id} for sales user ${decoded.userId}`,
      );

      return NextResponse.json({ ok: true, job });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to start LinkedIn lead generation';

      await prisma.salesLeadGenerationJob.update({
        where: { id: localJob.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: message,
        },
      });

      console.error('[POST /api/sales-leads/linkedin/generate]', error);
      return NextResponse.json(
        { ok: false, message },
        { status: 500 },
      );
    }
  } catch (err) {
    if (err instanceof Response) {
      return err;
    }

    console.error('[POST /api/sales-leads/linkedin/generate]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
