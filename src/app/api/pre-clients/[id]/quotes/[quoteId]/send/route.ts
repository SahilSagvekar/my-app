export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import nodemailer from 'nodemailer';

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; quoteId: string }> }
) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: preClientId, quoteId } = await params;

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { preClient: true },
    });

    if (!quote || quote.preClientId !== preClientId) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.status === 'ACCEPTED') {
      return NextResponse.json({ error: 'Quote already accepted' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://e8productions.com';
    const quoteUrl = `${baseUrl}/quote/${quote.shareToken}`;
    const isResend = quote.sentAt !== null || quote.version > 1;

    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"E8 Productions" <eric@e8productions.com>`,
      to: quote.preClient.email,
      subject: isResend
        ? `Your Revised Quote from E8 Productions — ${quote.preClient.name}`
        : `Your Quote from E8 Productions — ${quote.preClient.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="border-bottom: 3px solid #0066ff; padding-bottom: 16px; margin-bottom: 24px;">
            <h1 style="font-size: 24px; margin: 0; color: #000;">E8 Productions</h1>
            <p style="margin: 4px 0 0; color: #666; font-size: 14px;">Full Service Video + Content</p>
          </div>
          <p style="font-size: 16px;">Hi ${quote.preClient.name},</p>
          <p style="font-size: 15px; line-height: 1.6;">
            Thank you for the opportunity. We've put together a proposal for your review.
            Please click the button below to view your quote.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${quoteUrl}"
               style="background: #0066ff; color: #fff; padding: 14px 32px;
                      border-radius: 8px; text-decoration: none; font-size: 16px;
                      font-weight: bold; display: inline-block;">
              View Your Quote
            </a>
          </div>
          <p style="font-size: 13px; color: #888;">
            Or copy this link: <a href="${quoteUrl}" style="color: #0066ff;">${quoteUrl}</a>
          </p>
          <div style="border-top: 1px solid #eee; margin-top: 32px; padding-top: 16px;">
            <p style="font-size: 13px; color: #666; margin: 0;">
              E8 Productions, LLC · <a href="https://e8productions.com" style="color: #0066ff;">e8productions.com</a>
            </p>
          </div>
        </div>
      `,
    });

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'SENT', sentAt: new Date() },
    });

    return NextResponse.json({ success: true, quote: updated });
  } catch (err) {
    console.error('POST quote/send error:', err);
    return NextResponse.json({ error: 'Failed to send quote' }, { status: 500 });
  }
}