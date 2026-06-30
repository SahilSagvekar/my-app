import { Navigation } from "@/components/landing/Navigation";
import { CallToAction } from "@/components/landing/CallToAction";
import { Footer } from "@/components/landing/Footer";
import { QnA } from "@/components/landing/QnA";
import { DollarSign, TrendingUp, Eye, Target, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Monetized Accounts",
  description:
    "Build and grow revenue-generating social media accounts that turn views into income.",
  pathname: "/services/monetized-accounts",
});

const features = [
  {
    icon: TrendingUp,
    title: 'Growth Strategy',
    description: 'Proven tactics to rapidly grow your audience with engaged, monetizable followers who stick around.',
    from: 'from-amber-500',
    to: 'to-amber-700',
    light: 'bg-amber-50 border-amber-100',
    text: 'text-amber-600',
  },
  {
    icon: Eye,
    title: 'Viral Content Creation',
    description: 'Content engineered to go viral and maximize your reach and monetization potential across platforms.',
    from: 'from-emerald-500',
    to: 'to-emerald-700',
    light: 'bg-emerald-50 border-emerald-100',
    text: 'text-emerald-600',
  },
  {
    icon: Target,
    title: 'Niche Selection',
    description: 'Strategic niche positioning to attract the most valuable audience for long-term monetization.',
    from: 'from-blue-500',
    to: 'to-blue-700',
    light: 'bg-blue-50 border-blue-100',
    text: 'text-blue-600',
  },
  {
    icon: DollarSign,
    title: 'Revenue Optimization',
    description: 'Maximize earnings through strategic monetization across multiple revenue streams and platforms.',
    from: 'from-orange-500',
    to: 'to-orange-700',
    light: 'bg-orange-50 border-orange-100',
    text: 'text-orange-600',
  },
];

const benefits = [
  'Build passive income from social media',
  'Multiple revenue streams per account',
  'Scalable growth strategies',
  'Expert guidance on monetization programs',
  'Brand partnership opportunities',
  'Long-term sustainable income',
];

const portfolioItems = [
  { img: '/assets/blind-date-thumbnail.jpg',           label: 'Monetized Channel',  client: 'TDBS' },
  { img: '/assets/CAROUSEL-2/STAYFIT305.jpg',          label: 'YouTube Partner',    client: 'StayFit305' },
  { img: '/assets/CAROUSEL-2/TURPONE.png',             label: 'Monetized Channel',  client: 'Turpone' },
  { img: '/assets/CAROUSEL-2/ContractorPlus-04-01.png', label: 'YouTube Partner',   client: 'ContractorPlus' },
];

const qnaItems = [
  {
    question: "What monetization methods do you support?",
    answer: "We support all major platforms including YouTube ads/revenue, TikTok Creator Fund, Instagram/Facebook monetization, brand partnerships, affiliate marketing, merchandise, and sponsored content."
  },
  {
    question: "How do you help grow accounts to monetization thresholds?",
    answer: "We develop comprehensive growth strategies including content optimization, audience targeting, cross-platform promotion, collaboration opportunities, and algorithmic optimization to reach platform monetization requirements."
  },
  {
    question: "What's the typical timeline to start monetizing?",
    answer: "Timeline varies by platform and starting point. YouTube typically requires 1,000 subscribers and 4,000 watch hours. TikTok needs 10,000 followers. We provide realistic timelines based on your current metrics."
  },
  {
    question: "Do you handle brand partnerships and sponsorships?",
    answer: "Yes, we manage the entire partnership process from outreach to contract negotiation, content creation, and performance tracking. We have established relationships with brands across various industries."
  },
  {
    question: "How do you maximize earnings across platforms?",
    answer: "We create diversified revenue streams, optimize content for each platform's algorithm, time posts for maximum engagement, and continuously test strategies to maximize earnings potential."
  }
];

export default function MonetizedAccountsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="pt-20 sm:pt-24">

        {/* Hero */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: copy */}
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/5 rounded-full text-sm text-black/70 mb-6">
                  <DollarSign className="w-4 h-4" />
                  Monetized Accounts
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                  Turn Views Into{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-yellow-400">
                    Real Revenue
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-black/60 mb-8 leading-relaxed">
                  Build and scale revenue-generating social media accounts that create
                  sustainable income streams from your content and audience.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/contact"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-white rounded-full hover:bg-black/90 transition-all hover:scale-105 font-medium"
                  >
                    Get Started
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/work"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-black/10 text-black rounded-full hover:border-black/30 transition-all font-medium"
                  >
                    View Our Work
                  </Link>
                </div>
              </div>

              {/* Right: main featured image + two stacked beside it */}
              <div className="flex gap-3 items-stretch">
                {/* Main large image */}
                <div className="relative rounded-2xl overflow-hidden flex-[1.6] aspect-video shadow-xl group">
                  <div className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 bg-zinc-200" />
                  <div className="absolute inset-0 bg-gradient-to-t from-amber-900/70 via-black/10 to-transparent" />
                  <div className="absolute top-3 left-3">
                    <span className="text-[9px] font-bold text-white bg-amber-500/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
                      Monetized Channel
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-white text-xs font-bold">TDBS</p>
                    <p className="text-white/70 text-[10px]">YouTube Partner Program</p>
                  </div>
                </div>
                {/* Two stacked images */}
                <div className="flex flex-col gap-3 flex-1">
                  <div className="relative rounded-2xl overflow-hidden flex-1 shadow-xl group">
                    <div className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 bg-zinc-200" />
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/70 via-black/10 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-white text-[10px] font-bold leading-tight">StayFit305</p>
                    </div>
                  </div>
                  <div className="relative rounded-2xl overflow-hidden flex-1 shadow-xl group">
                    <div className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 bg-zinc-200" />
                    <div className="absolute inset-0 bg-gradient-to-t from-amber-900/70 via-black/10 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-white text-[10px] font-bold leading-tight">Kirgo</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">What&apos;s Included</h2>
              <p className="text-lg text-black/60 max-w-2xl mx-auto">
                Everything you need to build profitable social media accounts and unlock platform monetization.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className={`p-8 bg-white rounded-2xl border ${feature.light} shadow-sm hover:shadow-md transition-shadow`}
                >
                  <div className={`w-14 h-14 bg-gradient-to-br ${feature.from} ${feature.to} rounded-xl flex items-center justify-center mb-6 shadow-lg`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-black mb-3">{feature.title}</h3>
                  <p className="text-black/60 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Portfolio strip */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">Recent Work</h2>
              <p className="text-lg text-black/60">Channels we&apos;ve helped reach partner status and beyond.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {portfolioItems.map((item) => (
                <div key={item.client} className="relative rounded-2xl overflow-hidden aspect-video group shadow-md hover:shadow-xl transition-shadow">
                  <div className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 bg-zinc-200" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-xs font-bold leading-tight">{item.client}</p>
                    <p className="text-white/70 text-[10px]">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href="/work" className="inline-flex items-center gap-2 text-sm font-medium text-black/60 hover:text-black transition-colors">
                View full portfolio <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-black mb-6">
                  Why Choose Our Monetization Service
                </h2>
                <p className="text-lg text-black/60 mb-8">
                  We&apos;ve helped creators and brands build sustainable income from their social
                  media presence. From hitting partner thresholds to unlocking brand deals, we
                  guide you through every step.
                </p>
                <ul className="space-y-4">
                  {benefits.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      <span className="text-black/80">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: image + CTA card */}
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden aspect-video shadow-xl">
                  <div className="w-full h-full object-cover bg-zinc-200" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-white font-bold text-lg">The Dating Below Standards</p>
                    <p className="text-white/70 text-sm">From zero to YouTube Partner Program</p>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-emerald-500 rounded-2xl p-6 text-white flex flex-col items-center text-center">
                  <h3 className="text-xl font-bold mb-2">Ready to start earning?</h3>
                  <p className="text-white/80 text-sm mb-4">Let&apos;s map out your path to monetization and build an account that pays you back.</p>
                  <Link
                    href="https://calendly.com/e8llc/eric-davis-introduction-meeting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-full hover:bg-white/90 transition-all font-medium text-sm"
                  >
                    Schedule a Call <ArrowRight className="w-4 h-4" />
                  </Link>
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
