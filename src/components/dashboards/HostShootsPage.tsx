"use client";

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Calendar, MapPin, RefreshCw, Shirt, User as UserIcon, Video } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { PageHeader } from '../ui/page-header';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { cn } from '@/lib/utils';

// Host Portal — "My Shoots" (see design_handoff_host_portal/README.md).
// E8 assigns hosts directly, so every booking here is already decided:
// confirmed (upcoming) or past (completed / cancelled). Status badges are
// deliberately neutral (icon + weight, no red/green), per the E8 design system.

const TZ = 'America/New_York';

interface HostShoot {
  id: string;
  status: 'confirmed' | 'completed' | 'cancelled';
  clientName: string;
  shootDate: string | null;
  callTime: string | null;
  endTime: string | null;
  location: string | null;
  role: string | null;
  wardrobe: string | null;
  videographer: string | null;
  rate: string | null;
  notes: string | null;
  hostId: number | null;
  hostName: string | null;
}

interface ShootsResponse {
  ok: boolean;
  confirmed: HostShoot[];
  past: HostShoot[];
  preview: boolean;
}

const fetcher = async (url: string): Promise<ShootsResponse> => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Your session has expired — refresh the page or sign in again' : `Request failed (${res.status})`);
  }
  return res.json();
};

// Postgres `timestamp` values arrive without a zone; they are always written as UTC.
function toDate(value: string | null): Date | null {
  if (!value) return null;
  const s = value.trim();
  const iso = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) ? s : s.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const fmt = (d: Date | null, opts: Intl.DateTimeFormatOptions) =>
  d ? new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts }).format(d) : '';

const longDate = (d: Date | null) => fmt(d, { month: 'short', day: 'numeric', year: 'numeric' });
const timeOnly = (d: Date | null) => fmt(d, { hour: 'numeric', minute: '2-digit' });

function money(value: string | null): string | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function StatusBadge({ status }: { status: HostShoot['status'] }) {
  const label = status === 'confirmed' ? 'Confirmed' : status === 'completed' ? 'Completed' : 'Cancelled';
  return (
    <Badge variant="outline" className={cn('font-semibold', status === 'cancelled' && 'text-muted-foreground line-through decoration-1')}>
      {label}
    </Badge>
  );
}

function DateBlock({ date }: { date: Date | null }) {
  return (
    <div className="w-14 shrink-0 text-center">
      <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">{fmt(date, { month: 'short' })}</div>
      <div className="text-[32px] font-bold leading-none tracking-tight">{fmt(date, { day: 'numeric' })}</div>
    </div>
  );
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold" title={value || undefined}>
        {value || '—'}
      </div>
    </div>
  );
}

function ShootCard({ shoot, preview, onOpen }: { shoot: HostShoot; preview: boolean; onOpen: () => void }) {
  const start = toDate(shoot.shootDate);
  const call = toDate(shoot.callTime);
  const rate = money(shoot.rate);

  return (
    <Card className="gap-0 overflow-hidden">
      <div className="flex flex-wrap items-start gap-5 p-5">
        <DateBlock date={start} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold">{shoot.clientName}</h3>
            <StatusBadge status={shoot.status} />
            {preview && shoot.hostName && <Badge variant="secondary">Host: {shoot.hostName}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {[longDate(start), call ? `${timeOnly(call)} call` : null, shoot.location, shoot.role].filter(Boolean).join(' · ')}
          </p>
        </div>
        {rate && (
          <div className="text-right">
            <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">Your rate</div>
            <div className="text-xl font-bold">{rate}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4 px-5 pb-5">
        <MetaItem icon={<Calendar className="h-3.5 w-3.5" />} label="Call time" value={call ? `${timeOnly(call)} ET` : null} />
        <MetaItem icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={shoot.location} />
        <MetaItem icon={<Shirt className="h-3.5 w-3.5" />} label="Wardrobe" value={shoot.wardrobe} />
        <MetaItem icon={<Video className="h-3.5 w-3.5" />} label="Videographer" value={shoot.videographer} />
      </div>

      <div className="flex items-center justify-end border-t bg-muted/40 px-5 py-3">
        <Button variant="outline" size="sm" onClick={onOpen}>
          Shoot details
        </Button>
      </div>
    </Card>
  );
}

function PastRow({ shoot, preview, onOpen }: { shoot: HostShoot; preview: boolean; onOpen: () => void }) {
  const start = toDate(shoot.shootDate);
  const rate = money(shoot.rate);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/50"
    >
      <span className="w-28 shrink-0 text-muted-foreground">{longDate(start)}</span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-semibold">{shoot.clientName}</span>
        <StatusBadge status={shoot.status} />
        {preview && shoot.hostName && <span className="truncate text-xs text-muted-foreground">· {shoot.hostName}</span>}
      </span>
      <span className="shrink-0 font-semibold">{shoot.status === 'cancelled' ? '—' : rate ?? '—'}</span>
    </button>
  );
}

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value || '—'}</div>
    </div>
  );
}

function ShootDetailsDialog({ shoot, onClose }: { shoot: HostShoot | null; onClose: () => void }) {
  const start = toDate(shoot?.shootDate ?? null);
  const call = toDate(shoot?.callTime ?? null);
  const end = toDate(shoot?.endTime ?? null);

  return (
    <Dialog open={!!shoot} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Shoot details</DialogTitle>
          <DialogDescription className="sr-only">Details for this booking</DialogDescription>
        </DialogHeader>
        {shoot && (
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold">{shoot.clientName}</h3>
                <StatusBadge status={shoot.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {[longDate(start), call ? `${timeOnly(call)}${end ? ` – ${timeOnly(end)}` : ''} ET` : null].filter(Boolean).join(' · ')}
              </p>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
              <DetailField label="Location" value={shoot.location} />
              <DetailField label="Your role" value={shoot.role} />
              <DetailField label="Wardrobe" value={shoot.wardrobe} />
              <DetailField label="Videographer" value={shoot.videographer} />
              <DetailField label="Your rate" value={money(shoot.rate)} />
            </div>

            <div className="rounded-xl border bg-muted/40 p-4">
              <div className="text-sm font-semibold">Notes from E8</div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">
                {shoot.notes || 'No additional notes for this shoot.'}
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function HostShootsPage() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<ShootsResponse>('/api/host/shoots', fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 60_000, // bookings can change while the page is open
    shouldRetryOnError: true,
    errorRetryCount: 5,
    errorRetryInterval: 3000,
  });
  const [openId, setOpenId] = useState<string | null>(null);

  const confirmed = data?.confirmed ?? [];
  const past = data?.past ?? [];
  const preview = !!data?.preview;
  const openShoot = useMemo(
    () => [...confirmed, ...past].find((s) => s.id === openId) ?? null,
    [confirmed, past, openId]
  );

  const subtitle = useMemo(() => {
    if (confirmed.length === 0) return 'No confirmed shoots on the books';
    const next = confirmed[0];
    return `${confirmed.length} confirmed shoot${confirmed.length === 1 ? '' : 's'}, next on ${longDate(toDate(next.shootDate))}`;
  }, [confirmed]);

  return (
    <div className="mx-auto w-full max-w-[960px] space-y-6">
      <PageHeader
        title="My Shoots"
        description={isLoading ? 'Loading your bookings…' : subtitle}
        actions={
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isValidating && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {preview && (
        <div className="rounded-lg border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
          Preview — showing every host&apos;s bookings. A host account only ever sees their own.
        </div>
      )}

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm">
          <span>
            Couldn&apos;t load your shoots: {error.message}.{data ? ' Showing the last loaded results.' : ''} Retrying automatically…
          </span>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            Retry now
          </Button>
        </div>
      )}

      {isLoading && !data && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
      )}

      {data && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Confirmed ({confirmed.length})</h2>
            {confirmed.length === 0 ? (
              <Card className="items-center gap-2 p-10 text-center">
                <UserIcon className="h-8 w-8 text-muted-foreground/40" />
                <p className="font-semibold">Nothing booked yet</p>
                <p className="text-sm text-muted-foreground">When E8 books you for a shoot, it will show up here.</p>
              </Card>
            ) : (
              confirmed.map((s) => <ShootCard key={s.id} shoot={s} preview={preview} onOpen={() => setOpenId(s.id)} />)
            )}
          </section>

          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Past shoots ({past.length})</h2>
              <Card className="gap-0 overflow-hidden">
                {past.map((s) => (
                  <PastRow key={s.id} shoot={s} preview={preview} onOpen={() => setOpenId(s.id)} />
                ))}
              </Card>
            </section>
          )}
        </>
      )}

      <ShootDetailsDialog shoot={openShoot} onClose={() => setOpenId(null)} />
    </div>
  );
}
