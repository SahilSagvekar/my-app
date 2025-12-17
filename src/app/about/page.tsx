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
      <div className="pt-24 pb-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-black mb-6">
              About E8 Productions
            </h1>
            <p className="text-black/60 max-w-2xl mx-auto text-lg">
              We're democratizing access to world-class media production, helping small businesses 
              tell their stories with the same quality and impact as the biggest brands.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-20">
            {values.map((value, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-black rounded-2xl mb-6">
                  <value.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-black mb-3">
                  {value.title}
                </h3>
                <p className="text-black/60">
                  {value.description}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-black/[0.02] rounded-3xl p-12 text-center">
            <h2 className="text-black mb-4">
              Built for Modern Businesses
            </h2>
            <p className="text-black/60 max-w-2xl mx-auto">
              Founded in the digital age, E8 Productions understands the unique challenges small 
              businesses face. We've built our company from the ground up to deliver enterprise-level 
              quality with startup-level agility and pricing.
            </p>
          </div>

          {/* Careers Section */}
          <div className="mt-20">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-black rounded-2xl mb-6">
                <Briefcase className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-black mb-4">
                Join Our Team
              </h2>
              <p className="text-black/60 max-w-2xl mx-auto">
                We're always looking for talented individuals who are passionate about helping small 
                businesses succeed through creative storytelling and innovative technology.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {positions.map((position, index) => (
                <div
                  key={index}
                  className="bg-white border border-black/5 rounded-2xl p-6 transition-all hover:border-black/20 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-black">
                      {position.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-1 bg-black/5 rounded-full text-xs text-black/70">
                      {position.type}
                    </span>
                    <span className="px-3 py-1 bg-black/5 rounded-full text-xs text-black/70">
                      {position.location}
                    </span>
                  </div>
                  <p className="text-black/60 text-sm mb-6">
                    {position.description}
                  </p>
                  <button className="group inline-flex items-center gap-2 text-black text-sm transition-all hover:gap-3">
                    Learn More
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="text-center bg-black rounded-3xl p-8">
              <h3 className="text-white mb-3">
                Don't see a perfect fit?
              </h3>
              <p className="text-white/70 mb-6 max-w-xl mx-auto">
                We're always interested in meeting talented people. Send us your resume and tell us 
                how you'd like to contribute to E8 Productions.
              </p>
              <button className="px-8 py-4 bg-white text-black rounded-full transition-all hover:bg-white/90 hover:scale-105">
                Send Your Resume
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}