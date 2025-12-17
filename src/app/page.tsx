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
      <section className="py-16 px-6 lg:px-8 bg-black/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 order-2 md:order-1">
              <div className="aspect-video rounded-3xl overflow-hidden shadow-xl bg-white p-6">
                <div className="grid grid-cols-3 gap-2 h-full">
                  {/* Content Strategy */}
                  <div className="bg-black/5 rounded-xl flex flex-col items-center justify-center p-3 hover:bg-black/10 transition-all">
                    <Target className="w-6 h-6 text-black mb-1" />
                    <span className="text-black text-[10px] text-center leading-tight">Content Strategy</span>
                  </div>
                  
                  {/* Video Production */}
                  <div className="bg-black/5 rounded-xl flex flex-col items-center justify-center p-3 hover:bg-black/10 transition-all">
                    <Video className="w-6 h-6 text-black mb-1" />
                    <span className="text-black text-[10px] text-center leading-tight">Video Production</span>
                  </div>
                  
                  {/* Video Editing */}
                  <div className="bg-black/5 rounded-xl flex flex-col items-center justify-center p-3 hover:bg-black/10 transition-all">
                    <Scissors className="w-6 h-6 text-black mb-1" />
                    <span className="text-black text-[10px] text-center leading-tight">Video Editing</span>
                  </div>
                  
                  {/* Social Media Management */}
                  <div className="bg-black/5 rounded-xl flex flex-col items-center justify-center p-3 hover:bg-black/10 transition-all">
                    <Users className="w-6 h-6 text-black mb-1" />
                    <span className="text-black text-[10px] text-center leading-tight">Social Media Management</span>
                  </div>
                  
                  {/* Posting & Distribution */}
                  <div className="bg-black/5 rounded-xl flex flex-col items-center justify-center p-3 hover:bg-black/10 transition-all">
                    <Send className="w-6 h-6 text-black mb-1" />
                    <span className="text-black text-[10px] text-center leading-tight">Posting & Distribution</span>
                  </div>
                  
                  {/* Monetized Accounts */}
                  <div className="bg-black/5 rounded-xl flex flex-col items-center justify-center p-3 hover:bg-black/10 transition-all">
                    <DollarSign className="w-6 h-6 text-black mb-1" />
                    <span className="text-black text-[10px] text-center leading-tight">Monetized Accounts</span>
                  </div>
                  
                  {/* Original Show Production */}
                  <div className="bg-black/5 rounded-xl flex flex-col items-center justify-center p-3 hover:bg-black/10 transition-all">
                    <Tv className="w-6 h-6 text-black mb-1" />
                    <span className="text-black text-[10px] text-center leading-tight">Original Show Production</span>
                  </div>
                  
                  {/* UGC Content */}
                  <div className="bg-black/5 rounded-xl flex flex-col items-center justify-center p-3 hover:bg-black/10 transition-all">
                    <Camera className="w-6 h-6 text-black mb-1" />
                    <span className="text-black text-[10px] text-center leading-tight">UGC Content</span>
                  </div>
                  
                  {/* Blank Tile */}
                  <div className="bg-black/[0.02] rounded-xl"></div>
                </div>
              </div>
            </div>

            <div className="flex-1 order-1 md:order-2">
              <h2 className="text-black mb-4">What We Do</h2>
              <p className="text-black/60 mb-6">
                We provide end-to-end social media and content solutions for modern businesses. From strategy and video production to editing, posting, distribution, and ongoing management, we help brands grow through consistent, high-quality content and original shows.
              </p>
              
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div>
                  <div className="text-black mb-1">8 Services</div>
                  <div className="text-black/50 text-sm">Complete Solutions</div>
                </div>
                <div>
                  <div className="text-black mb-1">End-to-End</div>
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

      {/* Results Preview */}
      <section className="py-16 px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <h2 className="text-black mb-4">
                Real Results for Real Businesses
              </h2>
              <p className="text-black/60 mb-6">
                From banks to fitness events, we’ve partnered with small businesses to drive growth through strategic content and video production.
              </p>
              
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div>
                  <div className="text-black mb-1">205%</div>
                  <div className="text-black/50 text-sm">Average Growth</div>
                </div>
                <div>
                  <div className="text-black mb-1">12.5M+</div>
                  <div className="text-black/50 text-sm">Total Views</div>
                </div>
              </div>

              <Link
                href="/work"
                className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full hover:bg-black/90 transition-all group"
              >
                See Case Studies
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            <div className="flex-1">
              <div className="aspect-video rounded-3xl overflow-hidden shadow-xl">
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
      <section className="py-16 px-6 lg:px-8 bg-black/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 order-2 md:order-1">
              <div className="aspect-video rounded-3xl overflow-hidden shadow-xl">
                {/* <ImageWithFallback
                  src={showsImage}
                  alt="Original show production"
                  className="w-full h-full object-cover"
                /> */}
                <Image src={showsImage} alt="Original show production"
                  className="w-full h-full object-cover" ></Image>
              </div>
            </div>

            <div className="flex-1 order-1 md:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-black text-white text-sm rounded-full mb-4">
                <Tv className="w-4 h-4" />
                Original Content
              </div>
              <h2 className="text-black mb-4">
                Original Shows
              </h2>
              <p className="text-black/60 mb-6">
                We produce and own original E8 shows built to attract attention, generate consistent views, and keep audiences coming back for more.
              </p>

              <Link
                href="/shows"
                className="inline-flex items-center gap-2 text-black hover:gap-3 transition-all group"
              >
                Explore Our Shows
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About Preview */}
      <section className="py-16 px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-black mb-4">
            Why E8 Productions?
          </h2>
          <p className="text-black/60 mb-8">
            Our consistent results and proven track record of growth speak for itself. 
            We've helped countless small businesses and entrepenurs achieve measurable success through strategic 
            content and video production that delivers real, sustainable growth.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/about"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black border border-black/10 rounded-full hover:border-black/30 hover:shadow-lg transition-all group"
            >
              Learn About Us
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full hover:bg-black/90 transition-all group"
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