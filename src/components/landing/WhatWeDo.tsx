import React from 'react';
import { Video, Lightbulb, Share2, Cpu, Scissors, DollarSign, Tv, Camera } from 'lucide-react';

const services = [
  {
    icon: Lightbulb,
    title: 'Content Strategy',
    description: 'Smart planning that helps you stand out in your market and connect with your customers.',
  },
  {
    icon: Video,
    title: 'Video Production',
    description: 'Professional video content that makes your business look bigger than it is. From ads to brand stories.',
  },
  {
    icon: Scissors,
    title: 'Video Editing',
    description: 'Polished, professional editing that transforms raw footage into compelling stories.',
  },
  {
    icon: Share2,
    title: 'Social Media Management',
    description: 'Strategic management of your social presence across all platforms to maximize engagement.',
  },
  {
    icon: Cpu,
    title: 'Posting & Distribution',
    description: 'Automated scheduling and distribution to ensure your content reaches the right audience at the right time.',
  },
  {
    icon: DollarSign,
    title: 'Monetized Accounts',
    description: 'Build and grow revenue-generating social media accounts that turn followers into income.',
  },
  {
    icon: Tv,
    title: 'Original Show Production',
    description: 'Full-scale production of original content series and shows that captivate audiences.',
  },
  {
    icon: Camera,
    title: 'UGC Content',
    description: 'Authentic user-generated style content that resonates with audiences and drives engagement.',
  },
];

export function WhatWeDo() {
  return (
    <section id="services" className="pt-12 sm:pt-14 pb-12 sm:pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl text-black mb-3 sm:mb-4">
            What We Do
          </h1>
          <p className="text-sm sm:text-base text-black/60 max-w-2xl mx-auto px-4 sm:px-0">
            Everything your business needs to create content that drives results.
          </p>
        </div>

        {/* Service Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {services.map((service, index) => (
            <div
              key={index}
              className="group relative p-6 sm:p-8 bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-gray-200"
            >
              <div className="flex items-start gap-4 sm:gap-5">
                <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 bg-gradient-to-br from-gray-900 to-black rounded-lg sm:rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-105">
                  <service.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg text-black mb-1.5 sm:mb-2">
                    {service.title}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                    {service.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}