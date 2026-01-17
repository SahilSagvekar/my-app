import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function CallToAction() {
  return (
    <section className="pt-10 sm:pt-14 pb-12 sm:pb-20 px-4 sm:px-6 lg:px-8 bg-black">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-xl sm:text-2xl lg:text-3xl text-white mb-4 sm:mb-6 px-4 sm:px-0">
          Ready to Level Up Your Brand?
        </h2>
        <p className="text-sm sm:text-base text-white/70 mb-8 sm:mb-10 max-w-2xl mx-auto px-4 sm:px-0">
          Let's create content that makes your business stand out. Professional quality 
          that fits your budget.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4 sm:px-0">
            <Link href="/dashboard" className="group inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base bg-white text-black rounded-full transition-all hover:bg-white/90 hover:scale-105 hover:shadow-xl w-full sm:w-auto justify-center">
              Start Your Project
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            
            {/* <button className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base bg-transparent text-white border border-white/20 rounded-full transition-all hover:border-white/40 hover:bg-white/5 w-full sm:w-auto justify-center"> */}
              <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base bg-transparent text-white border border-white/20 rounded-full transition-all hover:border-white/40 hover:bg-white/5 w-full sm:w-auto justify-center">
              Sign In to Dashboard
              </Link>
                         {/* </button> */}
          </div>
      </div>
    </section>
  );
}