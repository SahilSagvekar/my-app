import { Navigation } from "@/components/landing/Navigation";
import { CallToAction } from "@/components/landing/CallToAction";
import { Footer } from "@/components/landing/Footer";
import { QnA } from "@/components/landing/QnA";
import {
  Video,
  ClipboardList,
  Camera,
  Users,
  Film,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Video Production",
  description:
    "Professional video content that makes your business look bigger than it is. From ads to brand stories.",
  pathname: "/services/video-production",
});

const features = [
  {
    icon: ClipboardList,
    title: "Pre-Production Planning",
    description:
      "Script development, storyboarding, shot lists, and full logistics coordination before a single frame is filmed.",
    iconGradient: "from-blue-500 to-blue-600",
    cardBg: "bg-blue-50/50",
    cardBorder: "border-blue-200",
  },
  {
    icon: Camera,
    title: "Professional Equipment",
    description:
      "Cinema-grade cameras, professional lighting rigs, and broadcast-quality audio gear — the tools that make the difference.",
    iconGradient: "from-violet-500 to-violet-600",
    cardBg: "bg-violet-50/50",
    cardBorder: "border-violet-200",
  },
  {
    icon: Users,
    title: "Expert Crew",
    description:
      "Experienced directors, cinematographers, sound engineers, and production assistants who bring your vision to life.",
    iconGradient: "from-indigo-500 to-indigo-600",
    cardBg: "bg-indigo-50/50",
    cardBorder: "border-indigo-200",
  },
  {
    icon: Film,
    title: "Post-Production",
    description:
      "Professional editing, color grading, sound mixing, and motion graphics — polished to broadcast-ready standards.",
    iconGradient: "from-cyan-500 to-cyan-600",
    cardBg: "bg-cyan-50/50",
    cardBorder: "border-cyan-200",
  },
];

const benefits = [
  "Cinema-quality footage",
  "Professional lighting and audio",
  "Experienced production team",
  "Location scouting and logistics",
  "Full post-production workflow",
  "Broadcast-ready deliverables",
];

const portfolioItems = [
  {
    src: "/assets/landing/photo.jpg",
    client: "E8 Productions",
    type: "Video Production",
  },
  {
    src: "/assets/about/IMG_0468.jpg",
    client: "On Set",
    type: "Video Production",
  },
  {
    src: "/assets/about/1.png",
    client: "Production Crew",
    type: "Video Production",
  },
  {
    src: "/assets/about/2.png",
    client: "Behind the Camera",
    type: "Video Production",
  },
];

const qnaItems = [
  {
    question: "What's included in your video production service?",
    answer:
      "Our video production service includes concept development, professional filming, lighting, sound design, and post-production editing. We handle everything from script to screen.",
  },
  {
    question: "How long does video production typically take?",
    answer:
      "Production timelines vary by project complexity. Simple videos take 1-2 weeks, while complex multi-location shoots can take 3-4 weeks. We provide detailed timelines upfront.",
  },
  {
    question: "What's the process for video production?",
    answer:
      "1) Initial consultation and concept development, 2) Script and storyboard creation, 3) Location scouting and crew assembly, 4) Professional filming, 5) Post-production editing and delivery.",
  },
  {
    question: "Do you provide equipment and crew?",
    answer:
      "Yes, we provide professional cameras, lighting, sound equipment, and experienced crew members. We can also work with your preferred equipment if needed.",
  },
  {
    question: "Can you produce videos for different platforms?",
    answer:
      "Absolutely! We optimize content for YouTube, TikTok, Instagram, LinkedIn, and other platforms, ensuring the best format, length, and style for each channel.",
  },
];

export default function VideoProductionPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="pt-20 sm:pt-24">

        {/* Hero Section */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24 overflow-hidden">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: text */}
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700 font-medium mb-6">
                  <Video className="w-4 h-4" />
                  Video Production
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                  Professional Video{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                    That Converts
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-black/60 mb-8 leading-relaxed">
                  From concept to final cut, we create video content that makes your business
                  look bigger than it is and drives real, measurable results.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="https://calendly.com/e8llc/eric-davis-introduction-meeting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full hover:opacity-90 transition-all hover:scale-105 font-medium shadow-lg shadow-blue-200"
                  >
                    Schedule a Call
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/work"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-black/10 text-black rounded-full hover:border-blue-300 transition-all font-medium"
                  >
                    View Our Work
                  </Link>
                </div>
              </div>

              {/* Right: main image left + two stacked images right */}
              <div className="grid grid-cols-2 gap-3 h-80">
                {/* Left column: big main image */}
                <div className="relative rounded-2xl overflow-hidden shadow-lg">
                  <div className="w-full h-full object-cover bg-zinc-200" />
                </div>
                {/* Right column: two stacked images */}
                <div className="flex flex-col gap-3 h-full">
                  <div className="relative flex-1 rounded-2xl overflow-hidden shadow-lg min-h-0">
                    <div className="w-full h-full object-cover bg-zinc-200" />
                  </div>
                  <div className="relative flex-1 rounded-2xl overflow-hidden shadow-lg min-h-0">
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
              <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">
                What&apos;s Included
              </h2>
              <p className="text-lg text-black/60 max-w-2xl mx-auto">
                Full-service video production from pre-production planning to final broadcast-ready delivery.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`p-8 rounded-2xl border ${feature.cardBorder} ${feature.cardBg} hover:shadow-md transition-shadow`}
                >
                  <div
                    className={`w-14 h-14 bg-gradient-to-br ${feature.iconGradient} rounded-xl flex items-center justify-center mb-6 shadow-sm`}
                  >
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
                A glimpse behind the scenes of what it looks like when we bring your vision to life.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {portfolioItems.map((item, index) => (
                <div
                  key={index}
                  className="relative aspect-video rounded-2xl overflow-hidden group cursor-pointer"
                >
                  <div className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 bg-zinc-200" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-sm font-semibold leading-tight">{item.client}</p>
                    <p className="text-white/70 text-xs">{item.type}</p>
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
              {/* Left: checklist */}
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-black mb-6">
                  Why Choose Our Video Production
                </h2>
                <p className="text-lg text-black/60 mb-8">
                  We combine creative excellence with strategic thinking to produce videos that
                  don&apos;t just look great — they deliver measurable business results.
                </p>
                <ul className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                      <span className="text-black/80">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: image + gradient CTA card */}
              <div className="flex flex-col gap-6">
                <div className="relative aspect-video rounded-2xl overflow-hidden shadow-lg">
                  <div className="w-full h-full object-cover bg-zinc-200" />
                </div>
                <div className="rounded-2xl p-8 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-200 flex flex-col items-center text-center">
                  <h3 className="text-2xl font-bold mb-3">Ready to bring your vision to life?</h3>
                  <p className="text-white/85 mb-6">
                    Let&apos;s discuss your video production needs and create something that
                    makes your brand impossible to ignore.
                  </p>
                  <Link
                    href="https://calendly.com/e8llc/eric-davis-introduction-meeting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-full hover:bg-white/90 transition-all font-semibold"
                  >
                    Schedule a Call
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <QnA items={qnaItems} />
        <CallToAction />
      </div>
      <Footer />
    </div>
  );
}
