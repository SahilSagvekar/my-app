// FILE: src/components/StrikeIndicator.tsx
// Header badge showing the signed-in user's own strikes: how many (of 3), why
// each was given, who sent it, and when. Renders nothing while they have no
// active strikes. Revoked strikes stay listed (struck through) for transparency.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useAuth } from './auth/AuthContext';

type StrikeView = {
  id: string;
  reason: string;
  createdAt: string;
  sender: { id: number; name: string | null } | null;
  revoked: boolean;
  revokedAt: string | null;
  revokeReason: string | null;
};

type Summary = { activeCount: number; max: number; strikes: StrikeView[] };

// Timestamps from the DB are UTC without a zone suffix.
function formatDate(value: string) {
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function StrikeIndicator() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/strikes/me');
      if (!res.ok) return;
      setSummary(await res.json());
    } catch {
      // Silent: the indicator just stays hidden this load.
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  if (!user || !summary || summary.activeCount === 0) return null;

  const atRisk = summary.activeCount >= summary.max - 1;

  return (
    <Popover onOpenChange={(open) => open && load()}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="You have strikes on your record"
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
            atRisk
              ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
              : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          <span>
            {summary.activeCount}/{summary.max}
            <span className="hidden sm:inline"> strikes</span>
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            Your strikes: {summary.activeCount} of {summary.max}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {summary.activeCount >= summary.max - 1
              ? 'One more strike will terminate your account.'
              : `${summary.max} strikes will terminate your account.`}
          </p>
        </div>

        <ul className="max-h-[320px] divide-y overflow-y-auto">
          {summary.strikes.map((s, i) => (
            <li key={s.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    s.revoked ? 'text-slate-400' : 'text-red-600'
                  }`}
                >
                  Strike {summary.strikes.length - i}
                  {s.revoked ? ' · removed' : ''}
                </span>
                <span className="text-xs text-slate-400">{formatDate(s.createdAt)}</span>
              </div>
              <p
                className={`mt-1 whitespace-pre-wrap text-sm ${
                  s.revoked ? 'text-slate-400 line-through' : 'text-slate-800'
                }`}
              >
                {s.reason}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                From {s.sender?.name || 'a team member'}
                {s.revoked && s.revokeReason ? ` · Removed: ${s.revokeReason}` : ''}
              </p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
