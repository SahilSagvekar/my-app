import { Navigation } from "@/components/landing/Navigation";
import { CallToAction } from "@/components/landing/CallToAction";
import { Footer } from "@/components/landing/Footer";
import { QnA } from "@/components/landing/QnA";
import { Scissors, Sparkles, Layers, Zap, CheckCircle, ArrowRight, Play } from 'lucide-react';
import Link from 'next/link';
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Video Editing",
  description:
    "Polished, professional editing that transforms raw footage into compelling stories.",
  pathname: "/services/video-editing",
});

const features = [
  {
    icon: Scissors,
    title: 'Professional Editing',
    description: 'Expert editing that paces your content perfectly and keeps viewers engaged from start to finish.',
    from: 'from-blue-500',
    to: 'to-blue-700',
    light: 'bg-blue-50 border-blue-100',
    text: 'text-blue-600',
  },
  {
    icon: Sparkles,
    title: 'Motion Graphics',
    description: 'Eye-catching animations and graphics that elevate your content and reinforce your brand.',
    from: 'from-violet-500',
    to: 'to-violet-700',
    light: 'bg-violet-50 border-violet-100',
    text: 'text-violet-600',
  },
  {
    icon: Layers,
    title: 'Color Grading',
    description: 'Professional color correction and grading that gives your videos a cinematic look.',
    from: 'from-amber-500',
    to: 'to-orange-600',
    light: 'bg-amber-50 border-amber-100',
    text: 'text-amber-600',
  },
  {
    icon: Zap,
    title: 'Quick Turnaround',
    description: 'Fast delivery without sacrificing quality—perfect for time-sensitive campaigns.',
    from: 'from-emerald-500',
    to: 'to-emerald-700',
    light: 'bg-emerald-50 border-emerald-100',
    text: 'text-emerald-600',
  },
];

const benefits = [
  'Transform raw footage into polished content',
  'Consistent style across all your videos',
  'Platform-optimized exports for every channel',
  'Engaging pacing that holds attention',
  'Professional graphics and animations',
  'Unlimited revisions until you\'re happy',
];

const portfolioItems = [
  { img: '/assets/blind-date-thumbnail.jpg', label: 'Long-Form Series',  client: 'TDBS' },
  { img: '/assets/kirgo-thumbnail.jpg',       label: 'Brand Video',       client: 'Kirgo' },
  { img: '/assets/CAROUSEL-2/STAYFIT305.jpg', label: 'Social Content',    client: 'StayFit305' },
  { img: '/assets/results/SODACITYSIMPSON.jpg', label: 'Results Reel',    client: 'Soda City' },
];

const qnaItems = [
  {
    question: "What's included in your video editing service?",
    answer: "Our video editing service includes professional editing, motion graphics, color grading, and platform-optimized exports. We work with your raw footage to create compelling narratives that engage your audience."
  },
  {
    question: "How long does the video editing process take?",
    answer: "Typical turnaround time is 3-5 business days depending on the complexity and length of your video. Rush orders and simple edits can often be completed in 1-2 days."
  },
  {
    question: "What's the process for getting my video edited?",
    answer: "1) Contact us with your project details, 2) Send us your raw footage and any reference materials, 3) We provide a timeline and start working, 4) Review drafts and provide feedback, 5) Final delivery with all necessary formats."
  },
  {
    question: "Do you offer revisions?",
    answer: "Yes, we offer unlimited revisions until you're completely satisfied with the final result. We believe in getting it right and want you to love your video."
  },
  {
    question: "What file formats do you deliver?",
    answer: "We deliver in multiple formats optimized for different platforms including MP4, MOV, and web-optimized versions. All files are compressed for fast loading while maintaining quality."
  }
];

export default function VideoEditingPage() {
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
                  <Scissors className="w-4 h-4" />
                  Video Editing
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                  Raw Footage to{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600">
                    Polished Stories
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-black/60 mb-8 leading-relaxed">
                  Our expert editors transform your raw footage into compelling narratives
                  that captivate audiences and drive engagement across every platform.
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

              {/* Right: short-form portrait cards */}
              <div className="flex gap-3 justify-center items-end">
                {[
                  { img: '/assets/CAROUSEL-2/STAYFIT305.jpg',         label: 'StayFit305',      platform: 'Instagram Reels', scale: 'h-72'  },
                  { img: '/assets/CAROUSEL-2/ContractorPlus-04-01.png', label: 'ContractorPlus', platform: 'TikTok',          scale: 'h-80'  },
                  { img: '/assets/SODACITYSIMPSON.jpg',                label: 'Soda City',       platform: 'YouTube Shorts',  scale: 'h-72'  },
                ].map((item) => (
                  <div key={item.label} className={`relative rounded-2xl overflow-hidden ${item.scale} aspect-[9/16] flex-1 shadow-xl group`}>
                    <div className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 bg-zinc-200" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    {/* Play button */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                    {/* Platform badge */}
                    <div className="absolute top-3 left-3">
                      <span className="text-[9px] font-bold text-white bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
                        {item.platform}
                      </span>
                    </div>
                    {/* Client name */}
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="text-white text-xs font-bold">{item.label}</p>
                    </div>
                  </div>
                ))}
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
                Comprehensive video editing services to make your content shine.
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
              <p className="text-lg text-black/60">A sample of what we've crafted for our clients.</p>
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
                  Why Choose Our Video Editing
                </h2>
                <p className="text-lg text-black/60 mb-8">
                  Great editing is invisible — it makes your content feel natural and engaging
                  while guiding viewers through your story seamlessly.
                </p>
                <ul className="space-y-4">
                  {benefits.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
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
                    <p className="text-white/70 text-sm">Results-driven editing for social growth</p>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-600 to-violet-600 rounded-2xl p-6 text-white flex flex-col items-center text-center">
                  <h3 className="text-xl font-bold mb-2">Ready to get started?</h3>
                  <p className="text-white/70 text-sm mb-4">Send us your footage and let our editors work their magic.</p>
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
