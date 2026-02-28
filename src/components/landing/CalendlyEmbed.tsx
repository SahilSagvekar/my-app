'use client';

import Script from 'next/script';

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL?.trim() || '';

export function CalendlyEmbed() {
  if (!CALENDLY_URL) return null;

  return (
    <>
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="lazyOnload"
      />
      <div
        className="calendly-inline-widget min-w-[320px] w-full h-[700px] rounded-2xl overflow-hidden border border-black/10"
        data-url={`${CALENDLY_URL}?hide_event_type_details=1&hide_gdpr_banner=1`}
        data-resize="true"
        style={{ minHeight: '700px' }}
      />
    </>
  );
}

export function hasCalendlyConfig(): boolean {
  return CALENDLY_URL.length > 0;
}