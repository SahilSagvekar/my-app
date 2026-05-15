export const dynamic = 'force-dynamic';
// POST /api/sales-leads/import
// Bulk-creates leads from an Excel import. Skips duplicates by email.
// Returns created / skipped / failed counts so the UI can show a summary.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

interface ImportRow {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  status?: string;
  source?: string;
  notes?: string;
  profileUrl?: string;
  postUrl?: string;
  value?: string | number;
  priority?: string;
  instagram?: boolean | string;
  facebook?: boolean | string;
  linkedin?: boolean | string;
  twitter?: boolean | string;
  tiktok?: boolean | string;
}

const VALID_STATUSES = ['NEW', 'CONTACTED', 'INTERESTED', 'PROPOSAL', 'WON', 'LOST', 'FOLLOW_UP'];

function toBoolean(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') return ['true', 'yes', '1', 'x', '✓'].includes(v.toLowerCase().trim());
  return false;
}

function normaliseStatus(raw: string | undefined): string {
  if (!raw) return 'NEW';
  const upper = raw.toUpperCase().trim().replace(/\s+/g, '_');
  // Fuzzy match
  if (upper.includes('NEW')) return 'NEW';
  if (upper.includes('CONTACT')) return 'CONTACTED';
  if (upper.includes('INTEREST')) return 'INTERESTED';
  if (upper.includes('PROPOSAL') || upper.includes('QUOT')) return 'PROPOSAL';
  if (upper.includes('WON') || upper.includes('CLOSED') || upper.includes('SIGNED')) return 'WON';
  if (upper.includes('LOST') || upper.includes('DECLINE')) return 'LOST';
  if (upper.includes('FOLLOW')) return 'FOLLOW_UP';
  return VALID_STATUSES.includes(upper) ? upper : 'NEW';
}

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || (decoded.role !== 'sales' && decoded.role !== 'admin')) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const { rows }: { rows: ImportRow[] } = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: false, message: 'No rows provided' }, { status: 400 });
    }

    if (rows.length > 2000) {
      return NextResponse.json({ ok: false, message: 'Max 2000 rows per import' }, { status: 400 });
    }

    // Fetch existing emails for this user to detect duplicates
    const existingEmails = new Set(
      (await prisma.salesLead.findMany({
        where: { userId: decoded.userId, email: { not: '' } },
        select: { email: true },
      })).map(l => l.email.toLowerCase().trim())
    );

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process in batches of 100 to avoid Prisma transaction limits
    const BATCH = 100;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);

      const toCreate = batch.filter(row => {
        const email = (row.email || '').toLowerCase().trim();
        if (email && existingEmails.has(email)) {
          skipped++;
          return false;
        }
        if (email) existingEmails.add(email); // prevent intra-batch dupes
        return true;
      });

      try {
        const result = await prisma.salesLead.createMany({
          data: toCreate.map(row => ({
            userId: decoded.userId,
            name: (row.name || '').trim(),
            company: (row.company || '').trim(),
            email: (row.email || '').trim(),
            phone: (row.phone || '').trim(),
            profileUrl: row.profileUrl?.trim() || null,
            postUrl: row.postUrl?.trim() || null,
            socials: '',
            status: normaliseStatus(row.status),
            source: (row.source || '').trim(),
            notes: (row.notes || '').trim(),
            value: row.value != null && row.value !== '' ? parseFloat(String(row.value)) : null,
            priority: (row.priority || '').trim(),
            instagram: toBoolean(row.instagram),
            facebook: toBoolean(row.facebook),
            linkedin: toBoolean(row.linkedin),
            twitter: toBoolean(row.twitter),
            tiktok: toBoolean(row.tiktok),
          })),
          skipDuplicates: true,
        });
        created += result.count;
      } catch (err: any) {
        failed += toCreate.length;
        errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${err.message}`);
      }
    }

    return NextResponse.json({ ok: true, created, skipped, failed, errors });
  } catch (err: any) {
    console.error('[POST /api/sales-leads/import]', err);
    return NextResponse.json({ ok: false, message: err.message || 'Server error' }, { status: 500 });
  }
}