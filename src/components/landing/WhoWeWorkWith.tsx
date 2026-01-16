import React from 'react';

const clientTypes = [
  'Local Businesses',
  'Startups',
  'E-commerce Brands',
  'Service Providers',
  'Restaurants & Cafes',
  'Retail Shops',
];

export function WhoWeWorkWith() {
  return (
    <section className="pt-16 pb-24 px-6 lg:px-8 bg-black/[0.02]">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl text-black mb-3 sm:mb-4">
            Who We Work With
          </h2>
          <p className="text-sm sm:text-base text-black/60 max-w-2xl mx-auto px-4 sm:px-0">
            Small businesses and growing brands that want to make a big impact.
          </p>
        </div>

        {/* Logo Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 px-4 sm:px-0">
          {clientTypes.map((client, index) => (
            <div
              key={index}
              className="aspect-[3/2] bg-white border border-black/5 rounded-xl sm:rounded-2xl flex items-center justify-center p-4 sm:p-6 transition-all hover:border-black/20 hover:shadow-lg"
            >
              <div className="text-center">
                <p className="text-black/70 text-xs sm:text-sm">
                  {client}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Badge */}
        <div className="mt-12 text-center">
          <p className="text-black/40 text-sm">
            Helping small businesses compete and win in their markets.
          </p>
        </div>
      </div>
    </section>
  );
}