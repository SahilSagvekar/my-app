import { Navigation } from '@/components/landing/Navigation';
import { Hero } from '@/components/landing/Hero';
import { Footer } from '@/components/landing/Footer';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Tv, TrendingUp, Users, Video, Target, Scissors, Send, DollarSign, Camera } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <Hero />

      {/* Services Preview */}
      <section className="py-16 px-6 lg:px-8 bg-black/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 order-2 md:order-1">
              <div className="aspect-video rounded-3xl overflow-hidden shadow-xl bg-white p-6">
                <div className="grid grid-cols-3 gap-2 h-full">
                  {/* Service Grid Items */}
                  <ServiceItem icon={Target} label="Content Strategy" />
                  <ServiceItem icon={Video} label="Video Production" />
                  <ServiceItem icon={Scissors} label="Video Editing" />
                  <ServiceItem icon={Users} label="Social Media Management" />
                  <ServiceItem icon={Send} label="Posting & Distribution" />
                  <ServiceItem icon={DollarSign} label="Monetized Accounts" />
                  <ServiceItem icon={Tv} label="Original Show Production" />
                  <ServiceItem icon={Camera} label="UGC Content" />
                  <div className="bg-black/[0.02] rounded-xl"></div>
                </div>
              </div>
            </div>

            <div className="flex-1 order-1 md:order-2">
              <h2 className="text-black text-4xl font-bold mb-4">What We Do</h2>
              <p className="text-black/60 text-lg mb-6">
                We provide end-to-end social media and content solutions for modern businesses. From strategy and video production to editing, posting, distribution, and ongoing management.
              </p>
              
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div>
                  <div className="text-black text-2xl font-bold mb-1">8 Services</div>
                  <div className="text-black/50 text-sm">Complete Solutions</div>
                </div>
                <div>
                  <div className="text-black text-2xl font-bold mb-1">End-to-End</div>
                  <div className="text-black/50 text-sm">Full Production</div>
                </div>
              </div>

              <Link
                href="/services"
                className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full hover:bg-black/90 transition-all group"
              >
                View All Services
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-black text-4xl font-bold mb-4">
            Ready to Transform Your Content?
          </h2>
          <p className="text-black/60 text-lg mb-8">
            Join hundreds of businesses achieving real results through strategic content and video production.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 bg-black text-white rounded-full hover:bg-black/90 transition-all group text-lg font-semibold"
            >
              Get Started
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black border-2 border-black/10 rounded-full hover:border-black/30 hover:shadow-lg transition-all group text-lg font-semibold"
            >
              Client Portal
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// Helper Component
function ServiceItem({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="bg-black/5 rounded-xl flex flex-col items-center justify-center p-3 hover:bg-black/10 transition-all cursor-pointer">
      <Icon className="w-6 h-6 text-black mb-1" />
      <span className="text-black text-[10px] text-center leading-tight">{label}</span>
    </div>
  );
}