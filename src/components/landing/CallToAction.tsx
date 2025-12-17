import React from 'react';
import { ArrowRight } from 'lucide-react';

export function CallToAction() {
  return (
    <section className="pt-16 pb-24 px-6 lg:px-8 bg-black">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-white mb-6">
          Ready to Level Up Your Brand?
        </h2>
        <p className="text-white/70 mb-10 max-w-2xl mx-auto">
          Let's create content that makes your business stand out. Professional quality 
          that fits your budget.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button className="group inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full transition-all hover:bg-white/90 hover:scale-105 hover:shadow-xl">
            Start Your Project
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
          
          <button className="inline-flex items-center gap-2 px-8 py-4 bg-transparent text-white border border-white/20 rounded-full transition-all hover:border-white/40 hover:bg-white/5">
            Sign In to Dashboard
          </button>
        </div>
      </div>
    </section>
  );
}