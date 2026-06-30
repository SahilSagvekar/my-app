import { Navigation } from "@/components/landing/Navigation";
import { CallToAction } from "@/components/landing/CallToAction";
import { Footer } from "@/components/landing/Footer";
import { QnA } from "@/components/landing/QnA";
import { Share2, Globe, Clock, BarChart2, RefreshCw, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Posting & Distribution",
  description:
    "Automated scheduling and distribution to ensure your content reaches the right audience at the right time.",
  pathname: "/services/posting-distribution",
});

const features = [
  {
    icon: Globe,
    title: 'Multi-Platform Posting',
    description: 'Seamless distribution across Instagram, TikTok, YouTube, Facebook, LinkedIn, and more — all from one workflow.',
    iconGradient: 'from-emerald-500 to-emerald-600',
    cardBg: 'bg-emerald-50/60',
    cardBorder: 'border-emerald-100',
  },
  {
    icon: Clock,
    title: 'Optimal Timing',
    description: 'Data-driven posting windows based on your specific audience behavior patterns — every platform, every time zone.',
    iconGradient: 'from-blue-500 to-blue-600',
    cardBg: 'bg-blue-50/60',
    cardBorder: 'border-blue-100',
  },
  {
    icon: BarChart2,
    title: 'Analytics Tracking',
    description: 'Real-time performance dashboards that surface what is working, what is not, and exactly where to double down.',
    iconGradient: 'from-violet-500 to-violet-700',
    cardBg: 'bg-violet-50/60',
    cardBorder: 'border-violet-100',
  },
  {
    icon: RefreshCw,
    title: 'Content Repurposing',
    description: 'Turn one piece of content into five. We adapt every asset for each platform so nothing goes to waste.',
    iconGradient: 'from-orange-400 to-orange-600',
    cardBg: 'bg-orange-50/60',
    cardBorder: 'border-orange-100',
  },
];

const benefits = [
  'Consistent posting schedule',
  'Optimized timing for each platform',
  'Cross-platform content adaptation',
  'Performance tracking and reporting',
  'Hashtag and SEO optimization',
  'Engagement monitoring',
];

const platformCards = [
  {
    src: '/assets/CAROUSEL-2/STAYFIT305.jpg',
    client: 'StayFit 305',
    platform: 'Instagram',
    badgeBg: 'bg-gradient-to-r from-pink-500 to-rose-500',
  },
  {
    src: '/assets/blind-date-thumbnail.jpg',
    client: 'Blind Date Show',
    platform: 'YouTube',
    badgeBg: 'bg-red-600',
  },
  {
    src: '/assets/CAROUSEL-2/ContractorPlus-04-01.png',
    client: 'Contractor Plus',
    platform: 'TikTok',
    badgeBg: 'bg-black',
  },
  {
    src: '/assets/kirgo-thumbnail.jpg',
    client: 'Kirgo',
    platform: 'Multi-Platform',
    badgeBg: 'bg-blue-700',
  },
];

const portfolioItems = [
  { src: '/assets/CAROUSEL-2/STAYFIT305.jpg', client: 'StayFit 305', platforms: '5 Platforms' },
  { src: '/assets/blind-date-thumbnail.jpg', client: 'Blind Date Show', platforms: '4 Platforms' },
  { src: '/assets/SODACITYSIMPSON.jpg', client: 'Soda City Simpson', platforms: '3 Platforms' },
  { src: '/assets/kirgo-thumbnail.jpg', client: 'Kirgo', platforms: '4 Platforms' },
];

const qnaItems = [
  {
    question: "How does automated posting work?",
    answer: "We set up scheduling systems that automatically publish your content at optimal times across different platforms. Once configured, posts go live without any manual intervention."
  },
  {
    question: "Which platforms do you support?",
    answer: "We support all major platforms including Instagram, TikTok, YouTube, LinkedIn, Twitter/X, Facebook, and Pinterest. Each platform gets optimized content and scheduling."
  },
  {
    question: "How do you determine the best posting times?",
    answer: "We analyze your audience data, platform algorithms, and engagement patterns to identify optimal posting times. This is continuously optimized based on performance data."
  },
  {
    question: "Can I still post manually sometimes?",
    answer: "Absolutely! Our automated system runs alongside your manual posting. You can override automated posts or add additional content whenever you want."
  },
  {
    question: "What happens if there's an error or platform issue?",
    answer: "We monitor all posts in real-time and have backup systems in place. If a post fails, we receive immediate notifications and can repost or troubleshoot quickly."
  }
];

export default function PostingDistributionPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="pt-20 sm:pt-24">

        {/* Hero Section */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full text-sm text-emerald-700 mb-6">
                  <Share2 className="w-4 h-4" />
                  Posting &amp; Distribution
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                  Your Content,{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-blue-500">
                    Everywhere
                  </span>{' '}
                  It Needs to Be
                </h1>
                <p className="text-lg sm:text-xl text-black/60 mb-8 leading-relaxed">
                  Automated scheduling and multi-platform distribution so your content reaches the right audience at exactly the right time — without lifting a finger.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                    href="https://calendly.com/e8llc/eric-davis-introduction-meeting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-full hover:shadow-lg hover:shadow-emerald-200 transition-all hover:scale-105 font-medium"
                  >
                    Schedule a Call
                    <ArrowRight className="w-5 h-5" />
                  </a>
                  <Link
                    href="/work"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-black/10 text-black rounded-full hover:border-emerald-300 hover:text-emerald-600 transition-all font-medium"
                  >
                    View Our Work
                  </Link>
                </div>
              </div>

              {/* Hero Platform Card Grid */}
              <div className="grid grid-cols-2 gap-4">
                {platformCards.map((card, index) => (
                  <div key={index} className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-gray-100 group">
                    <div className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 bg-zinc-200" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    {/* Platform badge */}
                    <div className={`absolute top-3 right-3 px-2.5 py-1 ${card.badgeBg} rounded-full text-white text-xs font-bold shadow-md`}>
                      {card.platform}
                    </div>
                    {/* Client name */}
                    <div className="absolute bottom-3 left-3">
                      <span className="text-white text-sm font-semibold drop-shadow-sm">{card.client}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">What&apos;s Included</h2>
              <p className="text-lg text-black/60 max-w-2xl mx-auto">
                End-to-end content distribution that maximizes your reach across every channel.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`p-8 rounded-2xl border shadow-sm hover:shadow-md transition-all hover:-translate-y-1 ${feature.cardBg} ${feature.cardBorder}`}
                >
                  <div className={`w-14 h-14 bg-gradient-to-br ${feature.iconGradient} rounded-xl flex items-center justify-center mb-6 shadow-sm`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-black mb-3">{feature.title}</h3>
                  <p className="text-black/60 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Portfolio Strip */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">Clients We Distribute For</h2>
              <p className="text-lg text-black/60 max-w-2xl mx-auto">
                Content reaching audiences across every major platform.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {portfolioItems.map((item, index) => (
                <div key={index} className="group relative rounded-2xl overflow-hidden aspect-square bg-gray-100 cursor-pointer">
                  <div className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 bg-zinc-200" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-sm font-semibold leading-tight drop-shadow-sm">{item.client}</p>
                    <p className="text-white/70 text-xs mt-0.5">Distributed across {item.platforms}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-black mb-6">Why Choose Our Distribution Service</h2>
                <p className="text-lg text-black/60 mb-8">
                  Consistency is the foundation of social media growth. Our automated distribution system ensures your content is delivered on time, every time — on every platform that matters.
                </p>
                <ul className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                      <span className="text-black/80">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-4">
                <div className="relative rounded-2xl overflow-hidden aspect-video bg-gray-100">
                  <div className="w-full h-full object-cover bg-zinc-200" />
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl p-8 text-white flex flex-col items-center text-center">
                  <h3 className="text-2xl font-bold mb-3">Ready to set up distribution?</h3>
                  <p className="text-white/80 mb-6">
                    Let&apos;s build your automated content distribution system and start growing your audience everywhere.
                  </p>
                  <a
                    href="https://calendly.com/e8llc/eric-davis-introduction-meeting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 rounded-full hover:bg-white/90 transition-all font-semibold shadow-lg"
                  >
                    Schedule a Call
                    <ArrowRight className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <CallToAction />
        <QnA items={qnaItems} />
      </div>
      <Footer />
    </div>
  );
}
