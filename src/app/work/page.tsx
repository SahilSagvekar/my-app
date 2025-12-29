import { Navigation } from '@/components/landing/Navigation';
import { WhoWeWorkWith } from '@/components/landing/WhoWeWorkWith';
import { Footer } from '@/components/landing/Footer';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { Play, TrendingUp, Users, Eye } from 'lucide-react';

const caseStudies = [
  {
    title: 'Urban Bistro',
    category: 'Restaurant',
    description: 'Complete brand video series showcasing their farm-to-table story and seasonal menu',
    image: 'https://images.unsplash.com/photo-1685040235380-a42a129ade4e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjByZXN0YXVyYW50JTIwaW50ZXJpb3J8ZW58MXx8fHwxNzY1ODIxOTQ2fDA&ixlib=rb-4.1.0&q=80&w=1080',
    results: [
      { label: 'Social Engagement', value: '+245%' },
      { label: 'New Customers', value: '+180%' },
      { label: 'Video Views', value: '2.4M' },
    ],
  },
  {
    title: 'FitCore Training',
    category: 'Fitness',
    description: 'Monthly content strategy with workout tutorials and member success stories',
    image: 'https://images.unsplash.com/photo-1584827386916-b5351d3ba34b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXRuZXNzJTIwZ3ltJTIwd29ya291dHxlbnwxfHx8fDE3NjU4OTAxNDl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    results: [
      { label: 'Membership Growth', value: '+320%' },
      { label: 'Content Reach', value: '1.8M' },
      { label: 'Engagement Rate', value: '+190%' },
    ],
  },
  {
    title: 'Brew & Co.',
    category: 'Coffee Shop',
    description: 'Social media management and daily content creation for Instagram and TikTok',
    image: 'https://images.unsplash.com/photo-1550071659-f7c7dc95e180?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBzaG9wJTIwYnVzaW5lc3N8ZW58MXx8fHwxNzY1ODQ3MzE5fDA&ixlib=rb-4.1.0&q=80&w=1080',
    results: [
      { label: 'Followers', value: '+450%' },
      { label: 'Store Visits', value: '+125%' },
      { label: 'Brand Awareness', value: '+280%' },
    ],
  },
  {
    title: 'Style Collective',
    category: 'Retail',
    description: 'Product videos and seasonal campaign content for online and in-store promotion',
    image: 'https://images.unsplash.com/photo-1562280963-8a5475740a10?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXRhaWwlMjBzdG9yZSUyMHNob3BwaW5nfGVufDF8fHx8MTc2NTgwODQ2OXww&ixlib=rb-4.1.0&q=80&w=1080',
    results: [
      { label: 'Online Sales', value: '+385%' },
      { label: 'Video Views', value: '3.2M' },
      { label: 'Conversion Rate', value: '+215%' },
    ],
  },
];

const videoShowcase = [
  {
    title: 'Brand Story Series',
    description: 'A 5-part documentary series showcasing local business founders',
    thumbnail: 'https://images.unsplash.com/photo-1683770997177-0603bd44d070?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBvZmZpY2UlMjB0ZWFtfGVufDF8fHx8MTc2NTg0ODMyOHww&ixlib=rb-4.1.0&q=80&w=1080',
    duration: '3:45',
  },
  {
    title: 'Product Launch Campaign',
    description: 'Multi-platform video campaign for a tech startup product launch',
    thumbnail: 'https://images.unsplash.com/photo-1654288891700-95f67982cbcc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWRlbyUyMHByb2R1Y3Rpb24lMjBjYW1lcmF8ZW58MXx8fHwxNzY1ODMwMTczfDA&ixlib=rb-4.1.0&q=80&w=1080',
    duration: '2:30',
  },
];

export default function WorkPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      {/* Hero Section */}
      <div className="pt-24 pb-16 px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-black mb-4">
            Results That Speak for Themselves
          </h1>
          <p className="text-black/60 max-w-2xl mx-auto">
            Real businesses. Real growth. See how our content strategies and production services 
            have helped small businesses achieve remarkable results.
          </p>
        </div>
      </div>

      {/* Case Studies Grid */}
      <div className="pb-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {caseStudies.map((study, index) => (
              <div
                key={index}
                className="group bg-white border border-black/5 rounded-3xl overflow-hidden hover:shadow-2xl transition-all duration-300"
              >
                {/* Image */}
                <div className="relative aspect-video overflow-hidden">
                  <ImageWithFallback
                    src={study.image}
                    alt={study.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-black text-sm rounded-full">
                      {study.category}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-8">
                  <h3 className="text-black mb-2">
                    {study.title}
                  </h3>
                  <p className="text-black/60 mb-6">
                    {study.description}
                  </p>

                  {/* Results */}
                  <div className="grid grid-cols-3 gap-4">
                    {study.results.map((result, idx) => (
                      <div key={idx} className="text-center">
                        <div className="text-black font-semibold mb-1">
                          {result.value}
                        </div>
                        <div className="text-black/50 text-sm">
                          {result.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Video Showcase */}
      <div className="py-24 px-6 lg:px-8 bg-black/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-black mb-4">
              Featured Projects
            </h2>
            <p className="text-black/60 max-w-2xl mx-auto">
              A selection of our video production work across different industries
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {videoShowcase.map((video, index) => (
              <div
                key={index}
                className="group bg-white border border-black/5 rounded-3xl overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer"
              >
                <div className="relative aspect-video overflow-hidden bg-black/5">
                  <ImageWithFallback
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center transition-transform group-hover:scale-110">
                      <Play className="w-6 h-6 text-black ml-1" fill="black" />
                    </div>
                  </div>
                  <div className="absolute bottom-4 right-4">
                    <span className="px-3 py-1 bg-black/80 backdrop-blur-sm text-white text-sm rounded-full">
                      {video.duration}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-black mb-2">
                    {video.title}
                  </h3>
                  <p className="text-black/60 text-sm">
                    {video.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-black mb-4">
              Impact by the Numbers
            </h2>
            <p className="text-black/60">
              Aggregate results across our client portfolio
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center p-6 bg-black/[0.02] rounded-3xl">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-black rounded-2xl mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="text-black mb-2">
                285%
              </div>
              <div className="text-black/60">
                Average Growth
              </div>
            </div>

            <div className="text-center p-6 bg-black/[0.02] rounded-3xl">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-black rounded-2xl mb-4">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <div className="text-black mb-2">
                12.5M+
              </div>
              <div className="text-black/60">
                Total Video Views
              </div>
            </div>

            <div className="text-center p-6 bg-black/[0.02] rounded-3xl">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-black rounded-2xl mb-4">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="text-black mb-2">
                50+
              </div>
              <div className="text-black/60">
                Happy Clients
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Who We Work With */}
      <div className="pb-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <WhoWeWorkWith />
        </div>
      </div>

      <Footer />
    </div>
  );
}