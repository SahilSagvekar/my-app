'use client';

import { useEffect, useState } from 'react';

const TZ = 'America/New_York'; // South Carolina = US Eastern

const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

const zoneFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  timeZoneName: 'short',
});

export function SCDigitalClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now ? timeFmt.format(now) : '--:--:-- --';
  const zone = now
    ? zoneFmt.formatToParts(now).find((p) => p.type === 'timeZoneName')?.value
    : '';

  return (
    <div
      className="hidden sm:flex shrink-0 select-none flex-col items-end leading-tight"
      title="South Carolina time"
      aria-label={`South Carolina time ${time} ${zone}`}
    >
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{time}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        South Carolina{zone ? ` · ${zone}` : ''}
      </span>
    </div>
  );
}
