'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LeaderboardRow {
  userId: number;
  name: string;
  calls: number;
  dealsClosed: number;
  meetings: number;
}

type Metric = 'calls' | 'dealsClosed' | 'meetings';

const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: 'calls', label: 'Calls', unit: 'calls' },
  { key: 'dealsClosed', label: 'Deals Closed', unit: 'deals' },
  { key: 'meetings', label: 'Meetings', unit: 'meetings' },
];

const MEDAL_COLORS = ['#F5A623', '#B0B7C3', '#C97C4B'];
const ACCENT = '#FF9800';
const ACCENT_TINT = '#FFF3E0';

export function TeamLeaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [metric, setMetric] = useState<Metric>('calls');
  const [expanded, setExpanded] = useState(true);
  const [logging, setLogging] = useState<Metric | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/sales-leaderboard');
      const data = await res.json();
      if (data.ok) {
        setRows(data.rows);
        setCurrentUserId(data.currentUserId);
      }
    } catch {
      // silent — leaderboard is non-critical
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const logActivity = async (type: Metric) => {
    setLogging(type);
    try {
      const res = await fetch('/api/sales-leaderboard/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || 'Failed to log');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to log activity');
    } finally {
      setLogging(null);
    }
  };

  const sorted = [...rows].sort((a, b) => b[metric] - a[metric]);
  const topValue = sorted[0]?.[metric] || 0;
  const myRank = sorted.findIndex(r => r.userId === currentUserId) + 1;
  const myRow = sorted.find(r => r.userId === currentUserId);
  const metricLabel = METRICS.find(m => m.key === metric)!;

  const summary = myRow
    ? `You're ranked #${myRank} of ${sorted.length} in ${metricLabel.label.toLowerCase()} today (${myRow[metric]} ${metricLabel.unit}).`
    : `${sorted.length} rep${sorted.length !== 1 ? 's' : ''} on the board today.`;

  if (rows.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 mb-5">
      <div onClick={() => setExpanded(v => !v)} className="flex items-center justify-between gap-4 flex-wrap cursor-pointer">
        <div className="flex items-center gap-2.5">
          <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', !expanded && '-rotate-90')} />
          <div>
            <p className="text-[15px] font-extrabold leading-tight">Team Leaderboard</p>
            <p className="text-xs text-gray-500 mt-0.5">{summary}</p>
          </div>
        </div>
      </div>

      {expanded && (
        <>
          <div className="flex items-center justify-end gap-2.5 flex-wrap mt-4" onClick={e => e.stopPropagation()}>
            <div className="flex bg-gray-100 p-[3px] rounded-lg gap-0.5">
              {METRICS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-bold rounded-md transition-colors',
                    metric === m.key ? 'bg-white text-[#0073EA] shadow-sm' : 'text-gray-500'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="w-px h-5.5 bg-gray-200" />
            <button onClick={() => logActivity('calls')} disabled={!!logging} className="h-8 px-3 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-600 disabled:opacity-50">
              + Call
            </button>
            <button onClick={() => logActivity('dealsClosed')} disabled={!!logging} className="h-8 px-3 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-600 disabled:opacity-50">
              + Deal Closed
            </button>
            <button onClick={() => logActivity('meetings')} disabled={!!logging} className="h-8 px-3 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-600 disabled:opacity-50">
              + Meeting
            </button>
          </div>

          <div className="flex flex-col gap-1.5 mt-3.5">
            {sorted.map((row, i) => {
              const isMe = row.userId === currentUserId;
              const pct = topValue > 0 ? Math.round((row[metric] / topValue) * 100) : 0;
              const others = METRICS.filter(m => m.key !== metric).map(m => `${row[m.key]} ${m.unit}`).join(' · ');
              return (
                <div
                  key={row.userId}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5"
                  style={isMe ? { backgroundColor: ACCENT_TINT, boxShadow: `inset 3px 0 0 ${ACCENT}` } : undefined}
                >
                  <span
                    className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs font-extrabold shrink-0"
                    style={
                      i < 3
                        ? { backgroundColor: MEDAL_COLORS[i], color: '#fff' }
                        : { backgroundColor: '#F0F0F2', color: '#8A8A8E' }
                    }
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-[110px] shrink-0">
                    <p className="text-[13.5px] font-bold text-gray-900">
                      {row.name}
                      {isMe && <span style={{ color: ACCENT }}> (You)</span>}
                    </p>
                    <p className="text-[11px] text-gray-400">{others}</p>
                  </div>
                  <div className="flex-1 h-3.5 rounded-full bg-gray-100 overflow-hidden min-w-[80px]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: isMe ? ACCENT : '#A9C9F5' }}
                    />
                  </div>
                  <span className="w-[90px] text-right text-[15px] font-extrabold text-gray-900 shrink-0">
                    {row[metric]} {metricLabel.unit}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
