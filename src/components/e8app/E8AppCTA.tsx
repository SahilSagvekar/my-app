import Link from 'next/link';
import { ArrowRight, LogIn } from 'lucide-react';

export function E8AppCTA() {
  return (
    <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-5">
          Ready to Get Started?
        </h2>
        <p className="text-base sm:text-lg text-black/60 mb-10 max-w-2xl mx-auto leading-relaxed">
          Existing clients and team members sign in below. Interested in working with E8 and getting access to the platform? Reach out and we'll get you set up.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 px-8 py-4 bg-black text-white rounded-full text-base font-medium hover:bg-black/90 active:scale-95 transition-all w-full sm:w-auto justify-center shadow-lg shadow-black/10"
          >
            <LogIn className="w-5 h-5" />
            Sign In to E8 App
          </Link>
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 px-8 py-4 border-2 border-black/10 text-black rounded-full text-base font-medium hover:border-black/30 hover:shadow-lg active:scale-95 transition-all w-full sm:w-auto justify-center"
          >
            Request Access
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <p className="mt-8 text-sm text-black/40">
          Already a client? Your login was emailed when you signed up.
        </p>
      </div>
    </section>
  );
}
