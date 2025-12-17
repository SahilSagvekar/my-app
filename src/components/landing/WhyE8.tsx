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
    <section className="pt-16 pb-24 px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-black mb-4">
            Why E8 Productions
          </h2>
          <p className="text-black/60">
            Small business pricing. Real results.
          </p>
        </div>

        {/* Value Props Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto">
          {values.map((value, index) => (
            <div
              key={index}
              className="flex gap-6 group"
            >
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
                  <value.icon className="w-7 h-7 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-black mb-2">
                  {value.title}
                </h3>
                <p className="text-black/60">
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