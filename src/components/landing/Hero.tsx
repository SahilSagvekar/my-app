"use client";

import React, { useState, useEffect } from 'react';
import { ArrowRight, Play, Eye } from 'lucide-react';

export function Hero() {
  const [views, setViews] = useState(743595332);

  useEffect(() => {
    const interval = setInterval(() => {
      setViews(prev => prev + Math.floor(Math.random() * 15) + 5);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative pt-20 sm:pt-24 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-5xl mx-auto text-center">
          {/* Live Counter */}
          <div className="flex flex-col items-center justify-center min-h-[30vh] sm:min-h-[35vh] bg-[#ff2828] rounded-2xl sm:rounded-3xl shadow-2xl relative transition-all duration-300 hover:scale-[1.02]" style={{ boxShadow: 'inset 0 -20px 40px rgba(0,0,0,0.15), inset 0 20px 40px rgba(255,255,255,0.1), 0 10px 30px rgba(0,0,0,0.3)' }} onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'inset 0 -20px 40px rgba(0,0,0,0.2), inset 0 20px 40px rgba(255,255,255,0.15), 0 20px 50px rgba(0,0,0,0.5)'} onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'inset 0 -20px 40px rgba(0,0,0,0.15), inset 0 20px 40px rgba(255,255,255,0.1), 0 10px 30px rgba(0,0,0,0.3)'}>
            <div className="flex items-center gap-2 sm:gap-3 mb-2 px-4 sm:px-0">
              <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full animate-pulse" />
              <Eye className="w-6 h-6 sm:w-8 sm:h-8 text-white" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }} />
              <span className="font-mono text-3xl sm:text-5xl lg:text-7xl font-bold text-white tracking-tight" style={{ textShadow: '0 4px 12px rgba(0,0,0,0.6)' }} suppressHydrationWarning>{views.toLocaleString()}</span>
            </div>
            <p className="text-black text-sm sm:text-base lg:text-lg font-bold px-4 sm:px-0">views generated for clients</p>
          </div>
        </div>
      </div>
    </section>
  );
}