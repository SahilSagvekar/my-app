'use client';

import { ArrowRight, Cpu, Shield, Zap } from 'lucide-react';
import Link from 'next/link';
import { RoleCarousel } from './RoleCarousel';

export function E8AppHero() {
  return (
    <section className="pt-28 sm:pt-32 bg-white overflow-hidden">
      {/* Top content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16">
        {/* Headline */}
        <div className="text-center max-w-4xl mx-auto mb-6">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4">
            The Platform Powering Your Content
          </h1>
          <p className="text-base sm:text-lg text-black/60 max-w-2xl mx-auto">
            E8 App is our proprietary production platform — purpose-built for clients, editors, and QC teams to stay in sync on every deliverable.
          </p>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm text-black/50">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-black" />
            <span>Real-time task tracking</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-black" />
            <span>Secure video review</span>
          </div>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-black" />
            <span>Automated workflows</span>
          </div>
        </div>
      </div>

      {/* Role Carousel */}
      <div className="relative px-4 sm:px-6 lg:px-8 pb-0">
        <div className="max-w-5xl mx-auto">
          <RoleCarousel />
        </div>
        {/* Fade into next section */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-white pointer-events-none" />
      </div>

      {/* CTA Buttons — below carousel */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-8 pb-16 px-4">
        <Link
          href="/dashboard"
          className="group inline-flex items-center gap-2 px-7 py-3.5 bg-black text-white rounded-full text-sm sm:text-base font-medium hover:bg-black/90 active:scale-95 transition-all w-full sm:w-auto justify-center shadow-lg shadow-black/10"
        >
          Sign In to E8 App
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 px-7 py-3.5 border-2 border-black/10 text-black rounded-full text-sm sm:text-base font-medium hover:border-black/30 hover:shadow-lg active:scale-95 transition-all w-full sm:w-auto justify-center"
        >
          Request Client Access
        </Link>
      </div>
    </section>
  );
}
