'use client';

import { useEffect, useState } from 'react';

const TZ = 'America/New_York'; // South Carolina = US Eastern

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

function getParts(d: Date) {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { h: Number(p.hour) % 24, m: Number(p.minute), s: Number(p.second) };
}

export function SCAnalogClock({ size = 34 }: { size?: number }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { h, m, s } = now ? getParts(now) : { h: 0, m: 0, s: 0 };
  const hourDeg = ((h % 12) + m / 60) * 30;
  const minDeg = (m + s / 60) * 6;
  const secDeg = s * 6;

  const title = now
    ? `South Carolina: ${now.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' })}`
    : 'South Carolina time';

  return (
    <div
      className="shrink-0 select-none"
      title={title}
      aria-label={title}
      role="img"
      style={{ width: size, height: size, visibility: now ? 'visible' : 'hidden' }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r="47" className="fill-background stroke-border" strokeWidth="4" />
        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={i}
            x1="50"
            y1="8"
            x2="50"
            y2={i % 3 === 0 ? 17 : 13}
            className="stroke-muted-foreground"
            strokeWidth={i % 3 === 0 ? 4 : 2}
            strokeLinecap="round"
            transform={`rotate(${i * 30} 50 50)`}
          />
        ))}
        <line x1="50" y1="50" x2="50" y2="28" className="stroke-foreground" strokeWidth="5" strokeLinecap="round" transform={`rotate(${hourDeg} 50 50)`} />
        <line x1="50" y1="50" x2="50" y2="16" className="stroke-foreground" strokeWidth="3.5" strokeLinecap="round" transform={`rotate(${minDeg} 50 50)`} />
        <line x1="50" y1="56" x2="50" y2="14" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" transform={`rotate(${secDeg} 50 50)`} />
        <circle cx="50" cy="50" r="3.5" fill="#EA580C" />
      </svg>
    </div>
  );
}
