import React from 'react';
import Link from 'next/link';
import { Video, Lightbulb, Share2, Cpu, Scissors, DollarSign, Tv, Camera, ArrowRight } from 'lucide-react';

const services = [
  {
    icon: Scissors,
    title: 'Video Editing',
    description: 'Polished, professional editing that transforms raw footage into compelling stories.',
    href: '/services/video-editing',
    iconGradient: 'from-blue-500 to-blue-700',
    cardBg: 'bg-blue-50/60',
    cardBorder: 'border-blue-100',
    accent: 'bg-blue-500',
    text: 'text-blue-600',
  },
  {
    icon: Video,
    title: 'Video Production',
    description: 'Professional video content that makes your business look bigger than it is. From ads to brand stories.',
    href: '/services/video-production',
    iconGradient: 'from-violet-500 to-violet-700',
    cardBg: 'bg-violet-50/60',
    cardBorder: 'border-violet-100',
    accent: 'bg-violet-500',
    text: 'text-violet-600',
  },
  {
    icon: Share2,
    title: 'Social Media Management',
    description: 'Strategic management of your social presence across all platforms to maximize engagement.',
    href: '/services/social-media-management',
    iconGradient: 'from-pink-500 to-pink-700',
    cardBg: 'bg-pink-50/60',
    cardBorder: 'border-pink-100',
    accent: 'bg-pink-500',
    text: 'text-pink-600',
  },
  {
    icon: Camera,
    title: 'UGC Content',
    description: 'Authentic user-generated style content that resonates with audiences and drives engagement.',
    href: '/services/ugc-content',
    iconGradient: 'from-orange-500 to-orange-600',
    cardBg: 'bg-orange-50/60',
    cardBorder: 'border-orange-100',
    accent: 'bg-orange-500',
    text: 'text-orange-600',
  },
  {
    icon: Cpu,
    title: 'Posting & Distribution',
    description: 'Automated scheduling and distribution to ensure your content reaches the right audience at the right time.',
    href: '/services/posting-distribution',
    iconGradient: 'from-emerald-500 to-emerald-700',
    cardBg: 'bg-emerald-50/60',
    cardBorder: 'border-emerald-100',
    accent: 'bg-emerald-500',
    text: 'text-emerald-600',
  },
  {
    icon: Lightbulb,
    title: 'Content Strategy',
    description: 'Smart planning that helps you stand out in your market and connect with your customers.',
    href: '/services/content-strategy',
    iconGradient: 'from-teal-500 to-teal-700',
    cardBg: 'bg-teal-50/60',
    cardBorder: 'border-teal-100',
    accent: 'bg-teal-500',
    text: 'text-teal-600',
  },
  {
    icon: DollarSign,
    title: 'Monetized Accounts',
    description: 'Build and grow revenue-generating social media accounts that turn views into income.',
    href: '/services/monetized-accounts',
    iconGradient: 'from-amber-500 to-amber-600',
    cardBg: 'bg-amber-50/60',
    cardBorder: 'border-amber-100',
    accent: 'bg-amber-500',
    text: 'text-amber-600',
  },
  {
    icon: Tv,
    title: 'Original Show Production',
    description: 'Full-scale production of original content series and shows that captivate audiences.',
    href: '/services/original-show-production',
    iconGradient: 'from-red-500 to-red-700',
    cardBg: 'bg-red-50/60',
    cardBorder: 'border-red-100',
    accent: 'bg-red-500',
    text: 'text-red-600',
  },
];

export function WhatWeDo({ hideHeader = false }: { hideHeader?: boolean }) {
  return (
    <section id="services" className="pt-14 sm:pt-16 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        {!hideHeader && (
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4 sm:mb-5">
              What E8 Does
            </h2>
            <p className="text-base sm:text-lg text-black/60 max-w-2xl mx-auto">
              Everything your business needs to create content that drives results.
            </p>
          </div>
        )}

        {/* Service Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <Link
                key={index}
                href={service.href}
                className={`group relative p-6 sm:p-7 rounded-2xl border ${service.cardBorder} ${service.cardBg} hover:shadow-md transition-all duration-300 block overflow-hidden`}
              >
                <div className="flex flex-col items-start gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 bg-gradient-to-br ${service.iconGradient} rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-black mb-2">
                      {service.title}
                    </h3>
                    <p className="text-sm text-black/55 leading-relaxed">
                      {service.description}
                    </p>
                  </div>

                  {/* Learn More */}
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${service.text} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                    <span>Learn more</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* Bottom accent bar */}
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${service.accent} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left`} />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
