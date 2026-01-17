import React from 'react';
import { Zap, Boxes, Award, TrendingUp } from 'lucide-react';

const values = [
  {
    icon: Boxes,
    title: 'Built to Scale',
    description: 'Infrastructure and processes designed to handle projects of any size, anywhere.',
  },
  {
    icon: Zap,
    title: 'Systems-Driven',
    description: 'Automated workflows and smart tools that ensure consistency and speed.',
  },
  {
    icon: Award,
    title: 'Uncompromising Quality',
    description: 'Award-winning creative paired with technical precision on every deliverable.',
  },
  {
    icon: TrendingUp,
    title: 'Results-Focused',
    description: 'Strategic alignment with your KPIs. We measure what matters.',
  },
];

export function WhyE8() {
  return (
    <section className="pt-16 pb-24 px-5 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl text-black mb-3 sm:mb-4">
            Why E8 Productions
          </h2>
          <p className="text-base sm:text-base text-black/60 px-4 sm:px-0">
            Small business pricing. Real results.
          </p>
        </div>

        {/* Value Props Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 max-w-5xl mx-auto px-4 sm:px-0">
          {values.map((value, index) => (
            <div
              key={index}
              className="flex gap-5 sm:gap-6 group p-4 sm:p-0 rounded-2xl hover:bg-black/5 transition-all"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-black rounded-xl sm:rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
                  <value.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-lg sm:text-lg text-black mb-1.5 sm:mb-2">
                  {value.title}
                </h3>
                <p className="text-base sm:text-base text-black/60">
                  {value.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}