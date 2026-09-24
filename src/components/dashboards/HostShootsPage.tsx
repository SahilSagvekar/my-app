'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { PageHeader } from '../ui/page-header';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Calendar, Loader2, MapPin, User, Shirt, DollarSign } from 'lucide-react';

interface Shoot {
  id: string;
  clientName: string;
  shootDate: string | null;
  callTime: string | null;
  location: string | null;
  wardrobe: string | null;
  role: string | null;
  videographer: string | null;
  rate: string | null;
  notes: string | null;
  cancelled: boolean;
}

function formatDate(d: string | null) {
  if (!d) return 'Date TBD';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function HostShootsPage() {
  const [confirmed, setConfirmed] = useState<Shoot[]>([]);
  const [past, setPast] = useState<Shoot[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/host/shoots', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((json) => {
        if (cancelled) return;
        setConfirmed(json.confirmed || []);
        setPast(json.past || []);
      })
      .catch((err) => console.error('Failed to load shoots:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const detail = [...confirmed, ...past].find((s) => s.id === detailId) || null;

  const subline =
    confirmed.length === 0
      ? 'No confirmed shoots on the books'
      : `${confirmed.length} confirmed shoot${confirmed.length === 1 ? '' : 's'}, next on ${formatDate(confirmed[0]?.shootDate)}`;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading your shoots...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Shoots" description={subline} />

      <div>
        <h3 className="text-sm font-bold mb-3">Confirmed ({confirmed.length})</h3>
        {confirmed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No confirmed shoots right now.</p>
        ) : (
          <div className="space-y-3">
            {confirmed.map((s) => (
              <Card key={s.id} className="border">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-16 shrink-0 text-center">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                      {s.shootDate ? new Date(s.shootDate).toLocaleDateString('en-US', { month: 'short' }) : '—'}
                    </p>
                    <p className="text-2xl font-bold">
                      {s.shootDate ? new Date(s.shootDate).getDate() : '?'}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{s.clientName}</span>
                      <Badge variant="outline" className="text-[10px]">Confirmed</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground pt-1">
                      {formatTime(s.callTime) && (
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatTime(s.callTime)}</span>
                      )}
                      {s.location && (
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.location}</span>
                      )}
                      {s.wardrobe && (
                        <span className="flex items-center gap-1"><Shirt className="h-3 w-3" /> {s.wardrobe}</span>
                      )}
                      {s.videographer && (
                        <span className="flex items-center gap-1"><User className="h-3 w-3" /> {s.videographer}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {s.rate && (
                      <span className="text-sm font-bold flex items-center gap-0.5">
                        <DollarSign className="h-3.5 w-3.5" />{Number(s.rate).toFixed(0)}
                      </span>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setDetailId(s.id)}>
                      Shoot details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-bold mb-3">Past shoots ({past.length})</h3>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <div className="divide-y border rounded-lg">
            {past.map((s) => (
              <button
                key={s.id}
                onClick={() => setDetailId(s.id)}
                className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-gray-50 text-sm"
              >
                <span className="text-muted-foreground w-24 shrink-0">{formatDate(s.shootDate)}</span>
                <span className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="font-medium truncate">{s.clientName}</span>
                  {s.cancelled ? (
                    <Badge variant="outline" className="text-[10px]">Cancelled</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Completed</Badge>
                  )}
                </span>
                {s.rate && <span className="font-semibold shrink-0">${Number(s.rate).toFixed(0)}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-[620px]">
          <DialogHeader>
            <DialogTitle>Shoot details</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div>
                <p className="text-lg font-bold">{detail.clientName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(detail.shootDate)}{formatTime(detail.callTime) ? ` · Call ${formatTime(detail.callTime)}` : ''}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Location</p><p className="font-medium">{detail.location || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Your role</p><p className="font-medium">{detail.role || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Wardrobe</p><p className="font-medium">{detail.wardrobe || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Videographer</p><p className="font-medium">{detail.videographer || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Your rate</p><p className="font-medium">{detail.rate ? `$${Number(detail.rate).toFixed(0)}` : '—'}</p></div>
              </div>
              <div className="bg-gray-50 border rounded-xl p-4">
                <p className="text-sm font-semibold mb-1">Notes from E8</p>
                <p className="text-sm text-muted-foreground">{detail.notes || 'No additional notes for this shoot.'}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
