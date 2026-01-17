import { Navigation } from '@/components/landing/Navigation';
import { Footer } from '@/components/landing/Footer';
import { Target, Users, Zap, Briefcase, ArrowRight } from 'lucide-react';

const values = [
  {
    icon: Target,
    title: 'Our Mission',
    description: 'To empower small businesses with professional media production that was once only accessible to large corporations.',
  },
  {
    icon: Users,
    title: 'Our Team',
    description: 'A diverse collective of creators, strategists, and technologists passionate about storytelling and innovation.',
  },
  {
    icon: Zap,
    title: 'Our Approach',
    description: 'We combine creative excellence with efficient systems to deliver high-quality content at accessible price points.',
  },
];

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
      <div className="pt-12 sm:pt-14">
        <section className="pt-12 sm:pt-14 pb-12 sm:pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl text-black mb-3 sm:mb-4">
            About E8 Productions
          </h1>
          <p className="text-base sm:text-base text-black/60 max-w-2xl mx-auto px-4 sm:px-0">
            We don’t just make videos — we build media that works.E8 Productions creates original shows, brand content, and social systems designed to earn attention, build trust, and turn audiences into real value.
          </p>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 sm:gap-12 mb-12 sm:mb-20 px-4 sm:px-0">
            {values.map((value, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-black rounded-xl sm:rounded-2xl mb-4 sm:mb-6">
                  <value.icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <h3 className="text-lg sm:text-lg text-black mb-2 sm:mb-3">
                  {value.title}
                </h3>
                <p className="text-base sm:text-base text-black/60">
                  {value.description}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-black/[0.02] rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center px-4 sm:px-6 border border-black/5">
            <h2 className="text-xl sm:text-2xl lg:text-3xl text-black mb-3 sm:mb-4">
              Built for Modern Businesses
            </h2>
            <p className="text-base sm:text-base text-black/60 max-w-2xl mx-auto">
              Founded in the digital age, E8 Productions understands the unique challenges small 
              businesses face. We've built our company from the ground up to deliver enterprise-level 
              quality with startup-level agility and pricing.
            </p>
          </div>

          {/* Careers Section */}
          <div className="mt-12 sm:mt-20">
            <div className="text-center mb-6 sm:mb-10">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-black rounded-xl sm:rounded-2xl mb-4 sm:mb-6">
                <Briefcase className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl text-black mb-3 sm:mb-4">
                Join Our Team
              </h2>
              <p className="text-base sm:text-base text-black/60 max-w-2xl mx-auto px-4 sm:px-0">
                We're always looking for talented individuals who are passionate about helping small 
                businesses succeed through creative storytelling and innovative technology.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-10 px-4 sm:px-0">
              {positions.map((position, index) => (
                <div
                  key={index}
                  className="bg-white border border-black/5 rounded-xl sm:rounded-2xl p-6 sm:p-6 transition-all hover:border-black/20 hover:shadow-lg active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <h3 className="text-lg sm:text-lg text-black">
                      {position.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 mb-3 sm:mb-4 flex-wrap">
                    <span className="px-2.5 sm:px-3 py-1 bg-black/5 rounded-full text-sm text-black/70">
                      {position.type}
                    </span>
                    <span className="px-2.5 sm:px-3 py-1 bg-black/5 rounded-full text-sm text-black/70">
                      {position.location}
                    </span>
                  </div>
                  <p className="text-black/60 text-sm sm:text-sm mb-4 sm:mb-6">
                    {position.description}
                  </p>
                  <button className="group inline-flex items-center gap-2 text-black text-sm sm:text-sm transition-all hover:gap-3">
                    Learn More
                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="text-center bg-black rounded-2xl sm:rounded-3xl p-8 sm:p-8 mx-4 sm:mx-0 shadow-xl">
              <h3 className="text-base sm:text-lg text-white mb-2 sm:mb-3">
                Don't see a perfect fit?
              </h3>
              <p className="text-base sm:text-base text-white/70 mb-4 sm:mb-6 max-w-xl mx-auto">
                We're always interested in meeting talented people. Send us your resume and tell us 
                how you'd like to contribute to E8 Productions.
              </p>
              <button className="px-6 sm:px-8 py-3.5 sm:py-4 text-base sm:text-base bg-white text-black rounded-full transition-all hover:bg-white/90 active:scale-95 w-full sm:w-auto font-medium">
                Send Your Resume
              </button>
            </div>
          </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}