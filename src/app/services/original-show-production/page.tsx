import { Navigation } from "@/components/landing/Navigation";
import { CallToAction } from "@/components/landing/CallToAction";
import { Footer } from "@/components/landing/Footer";
import { QnA } from "@/components/landing/QnA";
import { Tv, Film, Video, Wand2, Share2, CheckCircle, ArrowRight, Play } from 'lucide-react';
import Link from 'next/link';
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Original Show Production",
  description:
    "Full-scale production of original content series and shows that captivate audiences.",
  pathname: "/services/original-show-production",
});

const features = [
  {
    icon: Film,
    title: 'Concept Development',
    description: 'From initial idea to fully developed show concepts with compelling narratives and audience hooks that keep viewers coming back.',
    iconGradient: 'from-red-500 to-red-600',
    cardBg: 'bg-red-50/60',
    cardBorder: 'border-red-100',
  },
  {
    icon: Video,
    title: 'Production Management',
    description: 'End-to-end crew coordination, scheduling, and on-set management for seamless shoot days that stay on budget and on schedule.',
    iconGradient: 'from-orange-400 to-orange-600',
    cardBg: 'bg-orange-50/60',
    cardBorder: 'border-orange-100',
  },
  {
    icon: Wand2,
    title: 'Post-Production',
    description: 'Professional editing, color grading, sound design, and motion graphics that give your show a polished, cinematic finish.',
    iconGradient: 'from-violet-500 to-violet-700',
    cardBg: 'bg-violet-50/60',
    cardBorder: 'border-violet-100',
  },
  {
    icon: Share2,
    title: 'Distribution Strategy',
    description: 'Strategic placement across YouTube, social platforms, and streaming services to maximize reach, engagement, and audience growth.',
    iconGradient: 'from-rose-500 to-rose-600',
    cardBg: 'bg-rose-50/60',
    cardBorder: 'border-rose-100',
  },
];

const benefits = [
  'From concept to finished episode',
  'Multi-camera setups available',
  'Professional audio recording',
  'Full post-production workflow',
  'Distribution across all platforms',
  'Ongoing series support',
];

const portfolioItems = [
  { src: '/assets/blind-date-thumbnail.jpg', label: 'Blind Date' },
  { src: '/assets/about/1.png', label: 'Behind the Scenes' },
  { src: '/assets/about/2.png', label: 'On Set' },
  { src: '/assets/about/IMG_0468.jpg', label: 'Production Day' },
];

const qnaItems = [
  {
    question: "What types of original shows do you produce?",
    answer: "We produce various formats including web series, branded content series, educational shows, entertainment programs, behind-the-scenes content, and custom formats tailored to your brand and audience."
  },
  {
    question: "What's the production process like?",
    answer: "1) Concept development and scripting, 2) Pre-production planning, 3) Professional filming with crew, 4) Post-production editing, 5) Sound design and music, 6) Multi-platform distribution and promotion."
  },
  {
    question: "How long does it take to produce a show?",
    answer: "Production timelines vary by format and complexity. A short web series might take 4-6 weeks, while a longer format could take 8-12 weeks. We provide detailed timelines based on your specific project."
  },
  {
    question: "Do you handle distribution and promotion?",
    answer: "Yes, we manage distribution across YouTube, social platforms, and streaming services. We also handle promotional campaigns, teaser content, and audience building strategies."
  },
  {
    question: "Can you work with existing IP or create original concepts?",
    answer: "We do both! We can develop completely original concepts or adapt your existing intellectual property into engaging video series that align with your brand and audience."
  }
];

export default function OriginalShowProductionPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="pt-20 sm:pt-24">

        {/* Hero Section */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-full text-sm text-red-700 mb-6">
                  <Tv className="w-4 h-4" />
                  Original Show Production
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                  We Build{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                    Original Shows
                  </span>{' '}
                  That Captivate
                </h1>
                <p className="text-lg sm:text-xl text-black/60 mb-8 leading-relaxed">
                  Full-scale production of original content series — from concept to screen — that build loyal audiences and lasting brand recognition.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                    href="https://calendly.com/e8llc/eric-davis-introduction-meeting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full hover:shadow-lg hover:shadow-red-200 transition-all hover:scale-105 font-medium"
                  >
                    Schedule a Call
                    <ArrowRight className="w-5 h-5" />
                  </a>
                  <Link
                    href="/shows"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-black/10 text-black rounded-full hover:border-red-300 hover:text-red-600 transition-all font-medium"
                  >
                    View Our Shows
                  </Link>
                </div>
              </div>

              {/* Hero Image Collage */}
              <div className="space-y-3">
                {/* Main featured image with play button */}
                <div className="relative rounded-2xl overflow-hidden aspect-[16/10] bg-gray-900">
                  <div className="absolute inset-0 w-full h-full object-cover opacity-90 bg-zinc-200" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  {/* Play button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-18 h-18 w-[72px] h-[72px] bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center shadow-2xl shadow-red-500/50 cursor-pointer hover:scale-110 transition-transform duration-200">
                      <Play className="w-8 h-8 text-white fill-white ml-1" />
                    </div>
                  </div>
                  {/* Show label */}
                  <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-full text-white text-sm font-medium">
                    The Daily Blind Date Show
                  </div>
                </div>
                {/* Two smaller production stills */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative rounded-xl overflow-hidden aspect-video bg-gray-100">
                    <div className="w-full h-full object-cover bg-zinc-200" />
                  </div>
                  <div className="relative rounded-xl overflow-hidden aspect-video bg-gray-100">
                    <div className="w-full h-full object-cover bg-zinc-200" />
                  </div>
                </div>
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
                Complete show production from concept to distribution, handled end-to-end by our team.
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
              <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">Our Productions</h2>
              <p className="text-lg text-black/60 max-w-2xl mx-auto">
                Real shows, real audiences, real results.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {portfolioItems.map((item, index) => (
                <div key={index} className="group relative rounded-2xl overflow-hidden aspect-square bg-gray-100 cursor-pointer">
                  <div className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 bg-zinc-200" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <span className="text-white text-sm font-semibold drop-shadow-sm">{item.label}</span>
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
                <h2 className="text-3xl sm:text-4xl font-bold text-black mb-6">Why Choose Our Show Production</h2>
                <p className="text-lg text-black/60 mb-8">
                  We&apos;ve produced successful original shows from the ground up — building loyal audiences and delivering cinematic quality that elevates every brand we work with.
                </p>
                <ul className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                      <span className="text-black/80">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-4">
                <div className="relative rounded-2xl overflow-hidden aspect-video bg-gray-100">
                  <div className="w-full h-full object-cover bg-zinc-200" />
                </div>
                <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl p-8 text-white flex flex-col items-center text-center">
                  <h3 className="text-2xl font-bold mb-3">Ready to create your show?</h3>
                  <p className="text-white/80 mb-6">
                    Let&apos;s talk about your concept and bring it to life — from pilot to full series.
                  </p>
                  <a
                    href="https://calendly.com/e8llc/eric-davis-introduction-meeting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white text-red-600 rounded-full hover:bg-white/90 transition-all font-semibold shadow-lg"
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
