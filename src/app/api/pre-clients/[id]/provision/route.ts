export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { createClientFolders } from '@/lib/s3';
import { createClientSlackChannel } from '@/lib/client-onboarding';
import nodemailer from 'nodemailer';
import { createRecurringTasksForClient } from '@/app/api/clients/recurring';

function getTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendMagicLinkEmail(params: {
  clientName: string;
  email: string;
  magicLink: string;
}) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"E8 Productions" <eric@e8productions.com>`,
    to: params.email,
    subject: `Welcome to E8 Productions — Set up your portal`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                  max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #333;">
        <div style="border-bottom: 3px solid #0066ff; padding-bottom: 16px; margin-bottom: 28px;">
          <div style="font-size: 22px; font-weight: 700; color: #000;">E8 Productions</div>
          <div style="font-size: 12px; color: #666; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 2px;">
            Full Service Video + Content
          </div>
        </div>

        <p style="font-size: 16px;">Hi ${params.clientName},</p>

        <p style="font-size: 15px; line-height: 1.7; color: #444;">
          Your proposal has been accepted and your E8 client portal is ready.
          Click the button below to get started — you'll watch a quick welcome video,
          set your password, and sign your contract all in one flow.
        </p>

        <div style="text-align: center; margin: 36px 0;">
          <a href="${params.magicLink}"
             style="background: #0066ff; color: #fff; padding: 16px 36px;
                    border-radius: 8px; text-decoration: none; font-size: 16px;
                    font-weight: 700; display: inline-block; letter-spacing: 0.01em;">
            Access Your Portal →
          </a>
        </div>

        <p style="font-size: 13px; color: #888; text-align: center;">
          This link is one-time use and expires in 48 hours.<br/>
          If you didn't expect this email, please ignore it.
        </p>

        <div style="border-top: 1px solid #eee; margin-top: 36px; padding-top: 16px;">
          <p style="font-size: 12px; color: #aaa; margin: 0;">
            E8 Productions, LLC ·
            <a href="https://e8productions.com" style="color: #0066ff;">e8productions.com</a>
          </p>
        </div>
      </div>
    `,
  });
}

// POST /api/pre-clients/[id]/provision
// Converts accepted pre-client → full Client → sends magic link
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: preClientId } = await params;

    const preClient = await prisma.preClient.findUnique({
      where: { id: preClientId },
      include: {
        quotes: {
          where: { status: 'ACCEPTED' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!preClient) {
      return NextResponse.json({ error: 'Pre-client not found' }, { status: 404 });
    }

    if (preClient.status === 'CONVERTED') {
      return NextResponse.json({ error: 'Already provisioned' }, { status: 400 });
    }

    if (preClient.status !== 'QUOTE_ACCEPTED') {
      return NextResponse.json(
        { error: 'Quote must be accepted before provisioning' },
        { status: 400 }
      );
    }

    const acceptedQuote = preClient.quotes[0];
    if (!acceptedQuote) {
      return NextResponse.json({ error: 'No accepted quote found' }, { status: 400 });
    }

    // Check if already provisioned (idempotency)
    if (preClient.clientId) {
      return NextResponse.json({ error: 'Client already provisioned' }, { status: 400 });
    }

    // 1. Create R2 folders
    const folders = await createClientFolders(
      preClient.companyName || preClient.name
    ).catch(() => ({
      mainFolderId: null,
      rawFolderId: null,
      elementsFolderId: null,
      outputsFolderId: null,
    }));

    // 2. Create User + Client + OnboardingToken + ClientPortalAccess in one transaction
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    const { client, onboardingToken } = await prisma.$transaction(async (tx) => {
      // Create the portal User (no password yet)
      const portalUser = await tx.user.create({
        data: {
          name: preClient.name,
          email: preClient.email,
          password: null,
          role: 'client',
        },
      });

      // Create the full Client record
      const client = await tx.client.create({
        data: {
          name: preClient.name,
          email: preClient.email,
          phone: preClient.phone || '',
          companyName: preClient.companyName || null,
          status: 'active',
          startDate: new Date(),
          lastActivity: new Date(),
          preClientId: preClient.id,
          portalPasswordSet: false,
          welcomeVideoWatched: false,
          driveFolderId: folders.mainFolderId,
          rawFootageFolderId: folders.rawFolderId,
          essentialsFolderId: folders.elementsFolderId,
          outputsFolderId: folders.outputsFolderId,
          currentProgress: { completed: 0, total: 0 },
          user: { connect: { id: portalUser.id } },
        },
      });

      // Create ClientPortalAccess — locked to ONBOARDING
      await tx.clientPortalAccess.create({
        data: {
          clientId: client.id,
          status: 'ONBOARDING',
        },
      });

      // Create one-time onboarding token
      const onboardingToken = await tx.onboardingToken.create({
        data: {
          clientId: client.id,
          expiresAt,
        },
      });

      // Mark pre-client as converted
      await tx.preClient.update({
        where: { id: preClientId },
        data: { status: 'CONVERTED', clientId: client.id },
      });

      // Kick off recurring tasks
      await createRecurringTasksForClient(client.id, tx);

      return { client, onboardingToken };
    });

    // 3. Send magic link email (non-blocking — don't fail if email fails)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://e8productions.com';
    const magicLink = `${baseUrl}/onboarding/${onboardingToken.token}`;

    sendMagicLinkEmail({
      clientName: preClient.name,
      email: preClient.email,
      magicLink,
    }).catch((err) => console.error('[Provision] Magic link email failed:', err));

    // 4. Create Slack channel (non-blocking)
    createClientSlackChannel({
      clientId: client.id,
      companyName: preClient.companyName || preClient.name,
      clientName: preClient.name,
      clientEmail: preClient.email,
    }).catch((err) => console.error('[Provision] Slack channel failed:', err));

    return NextResponse.json({
      success: true,
      clientId: client.id,
      magicLink,
    });
  } catch (err: any) {
    console.error('POST /api/pre-clients/[id]/provision error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
