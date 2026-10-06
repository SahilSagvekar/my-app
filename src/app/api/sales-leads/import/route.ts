export const dynamic = 'force-dynamic';
// POST /api/sales-leads/import
// Bulk-creates leads from an Excel import. Skips duplicates by email.
// Returns created / skipped / failed counts so the UI can show a summary.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { salesLead } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, ne } from 'drizzle-orm';
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

// Must match the status columns the Sales dashboard actually renders — a lead whose status
// isn't one of these is filtered out of every group and becomes invisible.
const VALID_STATUSES = ['NEW', 'CONTACTED', 'WORKING', 'QUALIFIED', 'WON', 'LOST', 'NOT_INTERESTED'];

function toBoolean(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') return ['true', 'yes', '1', 'x', '✓'].includes(v.toLowerCase().trim());
  return false;
}

function parseValue(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normaliseStatus(raw: string | undefined): string {
  if (!raw) return 'NEW';
  const upper = raw.toUpperCase().trim().replace(/[\s-]+/g, '_');
  if (VALID_STATUSES.includes(upper)) return upper;
  // Fuzzy match — order matters ("NOT INTERESTED" must not fall into a positive bucket)
  if (upper.includes('NOT_INTEREST') || upper.includes('UNINTEREST') || upper.includes('DECLINE')) return 'NOT_INTERESTED';
  if (upper.includes('LOST') || upper.includes('DEAD')) return 'LOST';
  if (upper.includes('WON') || upper.includes('CLOSED') || upper.includes('SIGNED')) return 'WON';
  if (upper.includes('QUALIF') || upper.includes('INTEREST') || upper.includes('PROPOSAL') || upper.includes('QUOT')) return 'QUALIFIED';
  if (upper.includes('WORK') || upper.includes('FOLLOW')) return 'WORKING';
  if (upper.includes('CONTACT')) return 'CONTACTED';
  return 'NEW';
}

export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || !['sales', 'admin', 'sales_manager'].includes(decoded.role)) {
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
      (await db.select({ email: salesLead.email }).from(salesLead)
        .where(and(eq(salesLead.userId, decoded.userId), ne(salesLead.email, ''))))
        .map(l => l.email.toLowerCase().trim())
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

      if (toCreate.length === 0) continue;

      try {
        const result = await db.insert(salesLead).values(toCreate.map(row => ({
          id: createId(),
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
          value: parseValue(row.value),
          priority: (row.priority || '').trim(),
          instagram: toBoolean(row.instagram),
          facebook: toBoolean(row.facebook),
          linkedin: toBoolean(row.linkedin),
          twitter: toBoolean(row.twitter),
          tiktok: toBoolean(row.tiktok),
          updatedAt: new Date().toISOString(),
        }))).returning({ id: salesLead.id });
        created += result.length;
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
