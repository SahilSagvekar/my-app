'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const CONSENT_KEY = 'e8_cookie_consent';

export type ConsentState = 'accepted' | 'declined' | null;

export function getConsentState(): ConsentState {
  if (typeof window === 'undefined') return null;
  return (localStorage.getItem(CONSENT_KEY) as ConsentState) ?? null;
}

export function initGA(measurementId: string) {
  if (typeof window === 'undefined') return;
  if ((window as any).__ga_initialized) return;
  (window as any).__ga_initialized = true;

  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  script.async = true;
  document.head.appendChild(script);

  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(...args: any[]) { (window as any).dataLayer.push(args); }
  (window as any).gtag = gtag;
  gtag('js', new Date());
  gtag('config', measurementId);
}

interface CookieConsentProps {
  measurementId: string;
}

export default function CookieConsent({ measurementId }: CookieConsentProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = getConsentState();
    if (stored === 'accepted') {
      initGA(measurementId);
    } else if (stored === null) {
      setVisible(true);
    }
  }, [measurementId]);

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
    initGA(measurementId);
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, 'declined');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-black/95 text-white border-t border-white/10 shadow-2xl"
    >
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-white/80 flex-1 leading-relaxed">
          We use cookies to analyse site traffic and improve your experience. By clicking
          &ldquo;Accept&rdquo; you consent to our use of analytics cookies.{' '}
          <Link href="/privacy" className="underline hover:text-white transition-colors">
            Privacy Policy
          </Link>
          {' · '}
          <Link href="/cookies" className="underline hover:text-white transition-colors">
            Cookie Policy
          </Link>
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 text-sm text-white/70 hover:text-white border border-white/20 hover:border-white/40 rounded-md transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="px-5 py-2 text-sm font-medium bg-white text-black hover:bg-white/90 rounded-md transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}