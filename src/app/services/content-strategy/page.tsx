import { Navigation } from "@/components/landing/Navigation";
import { CallToAction } from "@/components/landing/CallToAction";
import { Footer } from "@/components/landing/Footer";
import { QnA } from "@/components/landing/QnA";
import { Lightbulb, Target, TrendingUp, Users, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Content Strategy",
  description:
    "Smart planning that helps you stand out in your market and connect with your customers.",
  pathname: "/services/content-strategy",
});

const features = [
  {
    icon: Target,
    title: 'Audience Analysis',
    description: 'Deep dive into your target demographics, behaviors, and preferences to create content that resonates.',
    from: 'from-teal-500',
    to: 'to-teal-700',
    light: 'bg-teal-50 border-teal-100',
    text: 'text-teal-600',
  },
  {
    icon: TrendingUp,
    title: 'Competitive Research',
    description: 'Analyze what works for competitors and identify opportunities to differentiate your brand.',
    from: 'from-blue-500',
    to: 'to-blue-700',
    light: 'bg-blue-50 border-blue-100',
    text: 'text-blue-600',
  },
  {
    icon: Users,
    title: 'Content Calendar',
    description: 'Strategic planning of content themes, topics, and publishing schedules for maximum impact.',
    from: 'from-violet-500',
    to: 'to-violet-700',
    light: 'bg-violet-50 border-violet-100',
    text: 'text-violet-600',
  },
  {
    icon: Lightbulb,
    title: 'Creative Direction',
    description: 'Develop a unique visual and narrative style that sets your brand apart from the competition.',
    from: 'from-emerald-500',
    to: 'to-emerald-700',
    light: 'bg-emerald-50 border-emerald-100',
    text: 'text-emerald-600',
  },
];

const benefits = [
  'Increased brand awareness and recognition',
  'Higher engagement rates across all platforms',
  'Consistent messaging that builds trust',
  'Data-driven decisions for better ROI',
  'Clear roadmap for content creation',
  'Aligned content with business goals',
];

const portfolioItems = [
  { img: '/assets/blind-date-thumbnail.jpg',    label: 'Content Strategy', client: 'TDBS' },
  { img: '/assets/kirgo-thumbnail.jpg',          label: 'Content Strategy', client: 'Kirgo' },
  { img: '/assets/CAROUSEL-2/STAYFIT305.jpg',   label: 'Content Strategy', client: 'StayFit305' },
  { img: '/assets/SODACITYSIMPSON.jpg',          label: 'Content Strategy', client: 'Soda City' },
];

const heroImages = [
  { img: '/assets/kirgo-thumbnail.jpg',        label: 'Strategy → Results', client: 'Kirgo Brand' },
  { img: '/assets/CAROUSEL-2/STAYFIT305.jpg', label: 'Strategy → Growth',  client: 'StayFit305' },
  { img: '/assets/SODACITYSIMPSON.jpg',         label: 'Strategy → Reach',  client: 'Soda City' },
];

const qnaItems = [
  {
    question: "What does content strategy include?",
    answer: "Content strategy encompasses audience research, brand voice development, content calendar planning, platform selection, performance tracking, and continuous optimization based on data."
  },
  {
    question: "How do you research our audience?",
    answer: "We analyze your existing customer data, social media insights, competitor analysis, and industry trends to create detailed audience personas and understand their preferences and behaviors."
  },
  {
    question: "What's the timeline for developing a content strategy?",
    answer: "A comprehensive content strategy typically takes 2-4 weeks to develop, including research, analysis, strategy creation, and implementation planning. This ensures it's thorough and effective."
  },
  {
    question: "How do you measure content strategy success?",
    answer: "We track engagement rates, reach, conversion rates, brand sentiment, website traffic from content, and ROI. Regular reports show progress toward your strategic goals."
  },
  {
    question: "Can you work with our existing content?",
    answer: "Absolutely! We audit your current content, identify what's working, and develop strategies to improve or repurpose existing assets while creating new content that aligns with your goals."
  }
];

export default function ContentStrategyPage() {
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
                  <Lightbulb className="w-4 h-4" />
                  Content Strategy
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                  Smart Planning for{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-cyan-500">
                    Maximum Impact
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-black/60 mb-8 leading-relaxed">
                  We don&apos;t just create content—we create strategic roadmaps that help you stand out
                  in your market and connect with your customers on a deeper level.
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

              {/* Right: staggered client result images */}
              <div className="grid grid-cols-2 gap-3">
                {/* Top-left: tall main image spanning 2 rows */}
                <div className="relative rounded-2xl overflow-hidden row-span-2 aspect-[4/5] shadow-xl group">
                  <div className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 bg-zinc-200" />
                  <div className="absolute inset-0 bg-gradient-to-t from-teal-900/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="text-[9px] font-bold text-white bg-teal-500/40 backdrop-blur-sm px-2 py-0.5 rounded-full block w-fit mb-1">
                      {heroImages[0].label}
                    </span>
                    <p className="text-white text-xs font-bold">{heroImages[0].client}</p>
                  </div>
                </div>
                {/* Top-right */}
                <div className="relative rounded-2xl overflow-hidden aspect-video shadow-xl group">
                  <div className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 bg-zinc-200" />
                  <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="text-[9px] font-bold text-white bg-cyan-500/40 backdrop-blur-sm px-2 py-0.5 rounded-full block w-fit mb-1">
                      {heroImages[1].label}
                    </span>
                    <p className="text-white text-xs font-bold">{heroImages[1].client}</p>
                  </div>
                </div>
                {/* Bottom-right */}
                <div className="relative rounded-2xl overflow-hidden aspect-video shadow-xl group">
                  <div className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 bg-zinc-200" />
                  <div className="absolute inset-0 bg-gradient-to-t from-teal-900/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="text-[9px] font-bold text-white bg-teal-500/40 backdrop-blur-sm px-2 py-0.5 rounded-full block w-fit mb-1">
                      {heroImages[2].label}
                    </span>
                    <p className="text-white text-xs font-bold">{heroImages[2].client}</p>
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
                Our comprehensive content strategy service covers everything you need to build a successful content presence.
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
              <p className="text-lg text-black/60">Strategy-driven results for our clients.</p>
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
                  Why Content Strategy Matters
                </h2>
                <p className="text-lg text-black/60 mb-8">
                  Without a clear strategy, you&apos;re just creating content and hoping it works.
                  With our strategic approach, every piece of content serves a purpose and moves
                  you closer to your business goals.
                </p>
                <ul className="space-y-4">
                  {benefits.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-teal-500 flex-shrink-0" />
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
                    <p className="text-white font-bold text-lg">Soda City Simpson</p>
                    <p className="text-white/70 text-sm">Strategy-driven growth across every platform</p>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl p-6 text-white flex flex-col items-center text-center">
                  <h3 className="text-xl font-bold mb-2">Ready to get started?</h3>
                  <p className="text-white/80 text-sm mb-4">Let&apos;s build a content roadmap that turns your goals into results.</p>
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
