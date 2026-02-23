import { Navigation } from '@/components/landing/Navigation';
import Image from 'next/image';
import { Hero } from '@/components/landing/Hero';
import { Footer } from '@/components/landing/Footer';
import Link from "next/link";
import { ArrowRight, Tv, TrendingUp, Users, Video, Target, Scissors, Send, DollarSign, Camera } from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import showsImage from '../../public/assets/c6ec00e7c877a01cc4af52907abc860d47df5b5d.png';
import Image2 from '../../public/assets/landing/photo.jpg';

const featuredServices = [
  {
    icon: Video,
    title: 'Video Production',
    description: 'Professional video content from concept to final cut',
  },
  {
    icon: Users,
    title: 'Social Media Management',
    description: 'Complete social strategy and daily content creation',
  },
  {
    icon: Tv,
    title: 'Original Show Production',
    description: 'Custom series and episodic content for your brand',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <Hero />

      {/* Services Preview */}
      <section className="py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8 bg-black/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-8 sm:gap-10 lg:gap-12">
            <div className="flex-1 order-2 md:order-1 w-full">
              <div className="aspect-[4/3] sm:aspect-video rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl bg-white p-4 sm:p-6">
                <div className="grid grid-cols-3 gap-2 sm:gap-3 h-full auto-rows-fr">
                  {/* Content Strategy */}
                  <div className="bg-black/[0.04] rounded-xl sm:rounded-xl flex flex-col items-center justify-center p-2.5 sm:p-3 hover:bg-black/10 active:scale-95 transition-all">
                    <Target className="w-5 h-5 sm:w-6 sm:h-6 text-black mb-1 sm:mb-1.5" />
                    <span className="text-black text-[11px] sm:text-xs text-center leading-tight font-medium">Content Strategy</span>
                  </div>

                  {/* Video Production */}
                  <div className="bg-black/[0.04] rounded-xl sm:rounded-xl flex flex-col items-center justify-center p-2.5 sm:p-3 hover:bg-black/10 active:scale-95 transition-all">
                    <Video className="w-5 h-5 sm:w-6 sm:h-6 text-black mb-1 sm:mb-1.5" />
                    <span className="text-black text-[11px] sm:text-xs text-center leading-tight font-medium">Video Production</span>
                  </div>

                  {/* Video Editing */}
                  <div className="bg-black/[0.04] rounded-xl sm:rounded-xl flex flex-col items-center justify-center p-2.5 sm:p-3 hover:bg-black/10 active:scale-95 transition-all">
                    <Scissors className="w-5 h-5 sm:w-6 sm:h-6 text-black mb-1 sm:mb-1.5" />
                    <span className="text-black text-[11px] sm:text-xs text-center leading-tight font-medium">Video Editing</span>
                  </div>

                  {/* Social Media Management */}
                  <div className="bg-black/[0.04] rounded-xl sm:rounded-xl flex flex-col items-center justify-center p-2.5 sm:p-3 hover:bg-black/10 active:scale-95 transition-all">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-black mb-1 sm:mb-1.5" />
                    <span className="text-black text-[11px] sm:text-xs text-center leading-tight font-medium">Social Media</span>
                  </div>

                  {/* Posting & Distribution */}
                  <div className="bg-black/[0.04] rounded-xl sm:rounded-xl flex flex-col items-center justify-center p-2.5 sm:p-3 hover:bg-black/10 active:scale-95 transition-all">
                    <Send className="w-5 h-5 sm:w-6 sm:h-6 text-black mb-1 sm:mb-1.5" />
                    <span className="text-black text-[11px] sm:text-xs text-center leading-tight font-medium">Distribution</span>
                  </div>

                  {/* Monetized Accounts */}
                  <div className="bg-black/[0.04] rounded-xl sm:rounded-xl flex flex-col items-center justify-center p-2.5 sm:p-3 hover:bg-black/10 active:scale-95 transition-all">
                    <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-black mb-1 sm:mb-1.5" />
                    <span className="text-black text-[11px] sm:text-xs text-center leading-tight font-medium">Monetization</span>
                  </div>

                  {/* Original Show Production */}
                  <div className="bg-black/[0.04] rounded-xl sm:rounded-xl flex flex-col items-center justify-center p-2.5 sm:p-3 hover:bg-black/10 active:scale-95 transition-all">
                    <Tv className="w-5 h-5 sm:w-6 sm:h-6 text-black mb-1 sm:mb-1.5" />
                    <span className="text-black text-[11px] sm:text-xs text-center leading-tight font-medium">Show Production</span>
                  </div>

                  {/* UGC Content */}
                  <div className="bg-black/[0.04] rounded-xl sm:rounded-xl flex flex-col items-center justify-center p-2.5 sm:p-3 hover:bg-black/10 active:scale-95 transition-all">
                    <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-black mb-1 sm:mb-1.5" />
                    <span className="text-black text-[11px] sm:text-xs text-center leading-tight font-medium">UGC Content</span>
                  </div>

                  {/* Blank Tile */}
                  <div className="bg-black/[0.02] rounded-xl sm:rounded-xl"></div>
                </div>
              </div>
            </div>

            <div className="flex-1 order-1 md:order-2 w-full md:w-auto">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-black mb-3 sm:mb-4 text-center md:text-left">What We Do</h2>
              <p className="text-sm sm:text-base text-black/60 mb-5 sm:mb-6 text-center md:text-left leading-relaxed">
                We provide end-to-end social media and content solutions for modern businesses. From strategy and video production to editing, posting, distribution, and ongoing management, we help brands grow through consistent, high-quality content and original shows.
              </p>

              <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 max-w-xs mx-auto md:max-w-none md:mx-0">
                <div className="text-center md:text-left">
                  <div className="text-lg sm:text-xl text-black mb-0.5 font-bold">8 Services</div>
                  <div className="text-black/50 text-xs sm:text-sm">Complete Solutions</div>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-lg sm:text-xl text-black mb-0.5 font-bold">End-to-End</div>
                  <div className="text-black/50 text-xs sm:text-sm">Full Production</div>
                </div>
              </div>

              <div className="flex justify-center md:justify-start">
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 px-6 py-3.5 sm:py-3 text-sm sm:text-base bg-black text-white rounded-full hover:bg-black/90 active:scale-95 transition-all group w-full sm:w-auto justify-center md:justify-start font-medium shadow-lg shadow-black/10"
                >
                  View All Services
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Results Preview */}
      <section className="py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-8 sm:gap-10 lg:gap-12">
            <div className="flex-1 w-full md:w-auto">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-black mb-3 sm:mb-4 text-center md:text-left">
                Real Results for Real Businesses
              </h2>
              <p className="text-sm sm:text-base text-black/60 mb-5 sm:mb-6 text-center md:text-left leading-relaxed">
                From banks to fitness events, we've partnered with small businesses to drive growth through strategic content and video production.
              </p>

              <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 max-w-xs mx-auto md:max-w-none md:mx-0">
                <div className="text-center md:text-left">
                  <div className="text-lg sm:text-xl text-black mb-0.5 font-bold">205%</div>
                  <div className="text-black/50 text-xs sm:text-sm">Average Growth</div>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-lg sm:text-xl text-black mb-0.5 font-bold">12.5M+</div>
                  <div className="text-black/50 text-xs sm:text-sm">Total Views</div>
                </div>
              </div>

              <div className="flex justify-center md:justify-start">
                <Link
                  href="/work"
                  className="inline-flex items-center gap-2 px-6 py-3.5 sm:py-3 text-sm sm:text-base bg-black text-white rounded-full hover:bg-black/90 active:scale-95 transition-all group w-full sm:w-auto justify-center md:justify-start font-medium shadow-lg shadow-black/10"
                >
                  See Case Studies
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            <div className="flex-1 w-full md:w-auto">
              <div className="aspect-video rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl">
                <ImageWithFallback
                  src="/assets/landing/photo.jpg"
                  alt="Content creation"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Original Shows Preview */}
      <section className="py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8 bg-black/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-8 sm:gap-10 lg:gap-12">
            <div className="flex-1 order-2 md:order-1 w-full md:w-auto">
              <div className="aspect-video rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl">
                <Image src={showsImage} alt="Original show production"
                  className="w-full h-full object-cover" />
              </div>
            </div>

            <div className="flex-1 order-1 md:order-2 w-full md:w-auto">
              <div className="flex justify-center md:justify-start mb-3 sm:mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-black text-white text-xs sm:text-sm rounded-full">
                  <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Original Content
                </div>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-black mb-3 sm:mb-4 text-center md:text-left">
                Original Shows
              </h2>
              <p className="text-sm sm:text-base text-black/60 mb-5 sm:mb-6 text-center md:text-left leading-relaxed">
                We produce and own original E8 shows built to attract attention, generate consistent views, and keep audiences coming back for more.
              </p>

              <div className="flex justify-center md:justify-start">
                <Link
                  href="/shows"
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm sm:text-base text-black hover:gap-3 active:scale-95 transition-all group font-medium"
                >
                  Explore Our Shows
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Preview */}
      <section className="py-10 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-black mb-3 sm:mb-4">
            Why E8 Productions?
          </h2>
          <p className="text-sm sm:text-base text-black/60 mb-8 sm:mb-10 leading-relaxed max-w-2xl mx-auto">
            Our consistent results and proven track record of growth speak for itself.
            We've helped countless small businesses and entrepenurs achieve measurable success through strategic
            content and video production that delivers real, sustainable growth.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/about"
              className="inline-flex items-center gap-2 px-6 py-3.5 sm:py-3 text-sm sm:text-base bg-white text-black border-2 border-black/10 rounded-full hover:border-black/30 hover:shadow-lg active:scale-95 transition-all group w-full sm:w-auto justify-center font-medium"
            >
              Learn About Us
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3.5 sm:py-3 text-sm sm:text-base bg-black text-white rounded-full hover:bg-black/90 active:scale-95 transition-all group w-full sm:w-auto justify-center font-medium shadow-lg shadow-black/10"
            >
              Get in Touch
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}