import { Navigation } from '@/components/landing/Navigation';
import { Footer } from '@/components/landing/Footer';
import { Briefcase, ArrowRight } from 'lucide-react';
import logo from '../../../public/assets/about/E8FIRELOGO.jpg';
import e8FlamingLogo from '../../../public/assets/about/2.png';
import Image from 'next/image';
import Link from 'next/link';

const positions = [
  {
    title: 'Video Producer',
    type: 'Full-time',
    location: 'Remote',
    description: 'Create compelling video content for small business clients across multiple industries.',
  },
  {
    title: 'Content Strategist',
    type: 'Full-time',
    location: 'Remote',
    description: 'Develop data-driven content strategies that help our clients achieve their business goals.',
  },
  {
    title: 'Social Media Manager',
    type: 'Contract',
    location: 'Remote',
    description: 'Manage social media campaigns and create engaging content for our client portfolio.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Page Hero — matches all other main pages */}
      <section className="pt-28 sm:pt-32 pb-10 sm:pb-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4">
            About Us
          </h1>
          <p className="text-base sm:text-lg text-black/60 max-w-2xl mx-auto">
            We&apos;re a full-service content production company helping small businesses compete in a digital world that moves fast.
          </p>
        </div>
      </section>

      {/* Founder Story Section */}
      <section className="py-16 sm:py-20 px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">
            {/* Founder Image */}
            <div className="lg:col-span-1 flex flex-col items-center">
              <div className="aspect-square w-full rounded-2xl overflow-hidden bg-black/5">
                <Image
                  src={e8FlamingLogo}
                  alt="Eric Davis — Founder & CEO"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="mt-6 text-center">
                <p className="text-black font-semibold text-lg">Eric Davis</p>
                <p className="text-black/60 text-sm mt-1">Founder & CEO</p>
              </div>
            </div>

            {/* Story Content */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-black">How We Got Started</h2>
              <div className="space-y-4 text-black/60 leading-relaxed">
                <p>
                  E8 Productions was born from a simple observation: creators were winning the internet, and small businesses deserved a piece of that.
                </p>
                <p>
                  After spending time in the content world, one thing became undeniable — creators had cracked the code on capturing attention. Viral content wasn't just luck; it was strategy, storytelling, and consistency. And while creators were building massive audiences overnight, small businesses were being left behind.
                </p>
                <p>
                  That's the gap we set out to close. In a world where social media presence isn't optional anymore, small businesses need more than just content — they need organic content that actually works. Content built on the same viral principles driving the creator economy, tailored to grow real businesses.
                </p>
                <p>
                  So we built E8 around that idea. We combined creative excellence with efficient systems, lean operations with premium quality, and enterprise-level expertise with startup-friendly pricing. Today, we help small businesses show up, stand out, and compete in the digital world — because the tools that make creators go viral should be working for your business too.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Careers Section */}
      <section className="py-16 sm:py-20 px-6 lg:px-8 bg-black/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
            {/* Content */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-black">Join Our Team</h2>
              <div className="space-y-4 text-black/60 leading-relaxed">
                <p>
                  Creators figured out how to win the internet. Now we're bringing that same energy to small businesses — and we need talented people to help make it happen.
                </p>
                <p>
                  We're looking for video hosts, editors, videographers, sales representatives, and content strategists who understand what makes viral organic content. People who are passionate about their craft and excited by the idea of taking viral creative principles and putting them to work for businesses that actually need it.
                </p>
                <p>
                  At E8, you won't just be making content — you'll be helping small businesses compete in a digital world that moves fast. If you're hungry, creative, and ready to build something special, we'd love to hear from you.
                </p>
              </div>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-8 py-4 bg-black text-white rounded-full hover:bg-black/90 hover:scale-105 transition-all font-medium"
              >
                Send Your Resume
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Logo Visual */}
            <div className="lg:col-span-1">
              <div className="aspect-square rounded-2xl overflow-hidden bg-black flex items-center justify-center p-8">
                <Image
                  src={logo}
                  alt="E8 Productions Logo"
                  className="w-full h-auto object-contain"
                />
              </div>
              <div className="mt-6 text-center">
                <p className="text-black font-medium">Join Us</p>
                <p className="text-black/60 text-sm mt-1">Build the Future</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
