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
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-black/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-8 sm:gap-10 lg:gap-12">
            <div className="flex-1 order-2 md:order-1 w-full">
              <div className="aspect-video rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl bg-white p-3 sm:p-6">
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 h-full">
                  {/* Content Strategy */}
                  <div className="bg-black/5 rounded-lg sm:rounded-xl flex flex-col items-center justify-center p-2 sm:p-3 hover:bg-black/10 transition-all">
                    <Target className="w-4 h-4 sm:w-6 sm:h-6 text-black mb-0.5 sm:mb-1" />
                    <span className="text-black text-[8px] sm:text-[10px] text-center leading-tight">Content Strategy</span>
                  </div>
                  
                  {/* Video Production */}
                  <div className="bg-black/5 rounded-lg sm:rounded-xl flex flex-col items-center justify-center p-2 sm:p-3 hover:bg-black/10 transition-all">
                    <Video className="w-4 h-4 sm:w-6 sm:h-6 text-black mb-0.5 sm:mb-1" />
                    <span className="text-black text-[8px] sm:text-[10px] text-center leading-tight">Video Production</span>
                  </div>
                  
                  {/* Video Editing */}
                  <div className="bg-black/5 rounded-lg sm:rounded-xl flex flex-col items-center justify-center p-2 sm:p-3 hover:bg-black/10 transition-all">
                    <Scissors className="w-4 h-4 sm:w-6 sm:h-6 text-black mb-0.5 sm:mb-1" />
                    <span className="text-black text-[8px] sm:text-[10px] text-center leading-tight">Video Editing</span>
                  </div>
                  
                  {/* Social Media Management */}
                  <div className="bg-black/5 rounded-lg sm:rounded-xl flex flex-col items-center justify-center p-2 sm:p-3 hover:bg-black/10 transition-all">
                    <Users className="w-4 h-4 sm:w-6 sm:h-6 text-black mb-0.5 sm:mb-1" />
                    <span className="text-black text-[8px] sm:text-[10px] text-center leading-tight">Social Media Management</span>
                  </div>
                  
                  {/* Posting & Distribution */}
                  <div className="bg-black/5 rounded-lg sm:rounded-xl flex flex-col items-center justify-center p-2 sm:p-3 hover:bg-black/10 transition-all">
                    <Send className="w-4 h-4 sm:w-6 sm:h-6 text-black mb-0.5 sm:mb-1" />
                    <span className="text-black text-[8px] sm:text-[10px] text-center leading-tight">Posting & Distribution</span>
                  </div>
                  
                  {/* Monetized Accounts */}
                  <div className="bg-black/5 rounded-lg sm:rounded-xl flex flex-col items-center justify-center p-2 sm:p-3 hover:bg-black/10 transition-all">
                    <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-black mb-0.5 sm:mb-1" />
                    <span className="text-black text-[8px] sm:text-[10px] text-center leading-tight">Monetized Accounts</span>
                  </div>
                  
                  {/* Original Show Production */}
                  <div className="bg-black/5 rounded-lg sm:rounded-xl flex flex-col items-center justify-center p-2 sm:p-3 hover:bg-black/10 transition-all">
                    <Tv className="w-4 h-4 sm:w-6 sm:h-6 text-black mb-0.5 sm:mb-1" />
                    <span className="text-black text-[8px] sm:text-[10px] text-center leading-tight">Original Show Production</span>
                  </div>
                  
                  {/* UGC Content */}
                  <div className="bg-black/5 rounded-lg sm:rounded-xl flex flex-col items-center justify-center p-2 sm:p-3 hover:bg-black/10 transition-all">
                    <Camera className="w-4 h-4 sm:w-6 sm:h-6 text-black mb-0.5 sm:mb-1" />
                    <span className="text-black text-[8px] sm:text-[10px] text-center leading-tight">UGC Content</span>
                  </div>
                  
                  {/* Blank Tile */}
                  <div className="bg-black/[0.02] rounded-lg sm:rounded-xl"></div>
                </div>
              </div>
            </div>

            <div className="flex-1 order-1 md:order-2 w-full md:w-auto px-4 sm:px-0">
              <h2 className="text-xl sm:text-2xl lg:text-3xl text-black mb-3 sm:mb-4 text-center md:text-left">What We Do</h2>
              <p className="text-sm sm:text-base text-black/60 mb-4 sm:mb-6 text-center md:text-left">
                We provide end-to-end social media and content solutions for modern businesses. From strategy and video production to editing, posting, distribution, and ongoing management, we help brands grow through consistent, high-quality content and original shows.
              </p>
              
              <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 max-w-xs mx-auto md:max-w-none md:mx-0">
                <div>
                  <div className="text-base sm:text-lg text-black mb-1 font-semibold">8 Services</div>
                  <div className="text-black/50 text-xs sm:text-sm">Complete Solutions</div>
                </div>
                <div>
                  <div className="text-base sm:text-lg text-black mb-1 font-semibold">End-to-End</div>
                  <div className="text-black/50 text-xs sm:text-sm">Full Production</div>
                </div>
              </div>

              <Link
                href="/services"
                className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-black text-white rounded-full hover:bg-black/90 transition-all group w-full sm:w-auto justify-center md:justify-start"
              >
                View All Services
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Results Preview */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-8 sm:gap-10 lg:gap-12">
            <div className="flex-1 w-full md:w-auto px-4 sm:px-0">
              <h2 className="text-xl sm:text-2xl lg:text-3xl text-black mb-3 sm:mb-4 text-center md:text-left">
                Real Results for Real Businesses
              </h2>
              <p className="text-sm sm:text-base text-black/60 mb-4 sm:mb-6 text-center md:text-left">
                From banks to fitness events, we've partnered with small businesses to drive growth through strategic content and video production.
              </p>
              
              <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 max-w-xs mx-auto md:max-w-none md:mx-0">
                <div>
                  <div className="text-base sm:text-lg text-black mb-1 font-semibold">205%</div>
                  <div className="text-black/50 text-xs sm:text-sm">Average Growth</div>
                </div>
                <div>
                  <div className="text-base sm:text-lg text-black mb-1 font-semibold">12.5M+</div>
                  <div className="text-black/50 text-xs sm:text-sm">Total Views</div>
                </div>
              </div>

              <Link
                href="/work"
                className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base bg-black text-white rounded-full hover:bg-black/90 transition-all group w-full sm:w-auto justify-center md:justify-start"
              >
                See Case Studies
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            <div className="flex-1 w-full md:w-auto">
              <div className="aspect-video rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1611926653458-09294b3142bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzb2NpYWwlMjBtZWRpYSUyMGNvbnRlbnR8ZW58MXx8fHwxNzY1OTA5MTE1fDA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Content creation"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Original Shows Preview */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-black/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-8 sm:gap-10 lg:gap-12">
            <div className="flex-1 order-2 md:order-1 w-full md:w-auto">
              <div className="aspect-video rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl">
                {/* <ImageWithFallback
                  src={showsImage}
                  alt="Original show production"
                  className="w-full h-full object-cover"
                /> */}
                <Image src={showsImage} alt="Original show production"
                  className="w-full h-full object-cover" ></Image>
              </div>
            </div>

            <div className="flex-1 order-1 md:order-2 w-full md:w-auto px-4 sm:px-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-black text-white text-xs sm:text-sm rounded-full mb-3 sm:mb-4 mx-auto md:mx-0 block w-fit">
                <Tv className="w-3 h-3 sm:w-4 sm:h-4" />
                Original Content
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl text-black mb-3 sm:mb-4 text-center md:text-left">
                Original Shows
              </h2>
              <p className="text-sm sm:text-base text-black/60 mb-4 sm:mb-6 text-center md:text-left">
                We produce and own original E8 shows built to attract attention, generate consistent views, and keep audiences coming back for more.
              </p>

              <Link
                href="/shows"
                className="inline-flex items-center gap-2 text-sm sm:text-base text-black hover:gap-3 transition-all group mx-auto md:mx-0 block w-fit"
              >
                Explore Our Shows
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About Preview */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl lg:text-3xl text-black mb-3 sm:mb-4">
            Why E8 Productions?
          </h2>
          <p className="text-sm sm:text-base text-black/60 mb-6 sm:mb-8 px-4 sm:px-0">
            Our consistent results and proven track record of growth speak for itself. 
            We've helped countless small businesses and entrepenurs achieve measurable success through strategic 
            content and video production that delivers real, sustainable growth.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4 sm:px-0">
            <Link
              href="/about"
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base bg-white text-black border border-black/10 rounded-full hover:border-black/30 hover:shadow-lg transition-all group w-full sm:w-auto justify-center"
            >
              Learn About Us
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base bg-black text-white rounded-full hover:bg-black/90 transition-all group w-full sm:w-auto justify-center"
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