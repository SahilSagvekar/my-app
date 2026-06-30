import { Navigation } from '@/components/landing/Navigation';
import { WhatWeDo } from '@/components/landing/WhatWeDo';
import { WhyE8 } from '@/components/landing/WhyE8';
import { CallToAction } from '@/components/landing/CallToAction';
import { Footer } from '@/components/landing/Footer';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Our Services — E8 Productions',
  description:
    'Video editing, production, social media management, UGC content, distribution, content strategy, monetized accounts, and original show production.',
  pathname: '/services',
});

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Page Hero */}
      <section className="pt-28 sm:pt-32 pb-10 sm:pb-14 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4">
            Everything Your Brand Needs to Grow
          </h1>
          <p className="text-base sm:text-lg text-black/60 max-w-2xl mx-auto">
            From raw footage to a full content engine — we handle every part of the production pipeline so you can focus on running your business.
          </p>
        </div>
      </section>

      <WhatWeDo hideHeader />
      <WhyE8 />
      <CallToAction />
      <Footer />
    </div>
  );
}
