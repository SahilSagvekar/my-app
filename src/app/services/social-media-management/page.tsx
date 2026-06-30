import { Navigation } from "@/components/landing/Navigation";
import { CallToAction } from "@/components/landing/CallToAction";
import { Footer } from "@/components/landing/Footer";
import { QnA } from "@/components/landing/QnA";
import {
  Share2,
  BarChart2,
  MessageCircle,
  Layers,
  PenLine,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Social Media Management",
  description:
    "Strategic management of your social presence across all platforms to maximize engagement.",
  pathname: "/services/social-media-management",
});

const features = [
  {
    icon: PenLine,
    title: "Content Creation",
    description:
      "Scroll-stopping posts, reels, and stories crafted to match your brand voice and captivate your audience on every platform.",
    iconGradient: "from-pink-500 to-pink-600",
    cardBg: "bg-pink-50/50",
    cardBorder: "border-pink-200",
  },
  {
    icon: MessageCircle,
    title: "Community Management",
    description:
      "Active engagement with your audience — responding to comments, DMs, and building real relationships that foster loyalty.",
    iconGradient: "from-purple-500 to-purple-700",
    cardBg: "bg-purple-50/50",
    cardBorder: "border-purple-200",
  },
  {
    icon: BarChart2,
    title: "Analytics & Reporting",
    description:
      "Detailed monthly insights into reach, engagement, follower growth, and content performance with clear action items.",
    iconGradient: "from-blue-500 to-blue-600",
    cardBg: "bg-blue-50/50",
    cardBorder: "border-blue-200",
  },
  {
    icon: Layers,
    title: "Platform Strategy",
    description:
      "Coordinated multi-platform strategy for Instagram, TikTok, Facebook, YouTube, and beyond — tailored to each channel.",
    iconGradient: "from-emerald-500 to-emerald-600",
    cardBg: "bg-emerald-50/50",
    cardBorder: "border-emerald-200",
  },
];

const benefits = [
  "Consistent brand voice across platforms",
  "Regular posting schedule",
  "Engaged community building",
  "Data-driven content decisions",
  "Trend monitoring and adaptation",
  "Monthly performance reports",
];

const portfolioItems = [
  {
    src: "/assets/CAROUSEL-2/STAYFIT305.jpg",
    client: "StayFit305",
    type: "Social Media",
  },
  {
    src: "/assets/SODACITYSIMPSON.jpg",
    client: "Soda City Simpson",
    type: "Social Media",
  },
  {
    src: "/assets/CAROUSEL-2/ContractorPlus-04-01.png",
    client: "Contractor+",
    type: "Social Media",
  },
  {
    src: "/assets/kirgo-thumbnail.jpg",
    client: "Kirgo",
    type: "Social Media",
  },
];

const qnaItems = [
  {
    question: "What's included in social media management?",
    answer:
      "Our service includes content creation, scheduling, community management, engagement monitoring, performance analytics, and strategic planning across all major platforms.",
  },
  {
    question: "How often do you post content?",
    answer:
      "Posting frequency depends on your goals and platform. Typically 3-7 posts per week per platform, optimized for engagement rather than quantity. We focus on quality over quantity.",
  },
  {
    question: "What's the onboarding process like?",
    answer:
      "1) Strategy consultation and goal setting, 2) Account audit and brand guidelines review, 3) Content calendar planning, 4) Access setup and training, 5) Launch and ongoing optimization.",
  },
  {
    question: "Do you handle community management?",
    answer:
      "Yes, we monitor comments, messages, and mentions 24/7. We respond professionally, handle customer service issues, and build relationships with your audience.",
  },
  {
    question: "How do you measure success?",
    answer:
      "We track engagement rates, reach, follower growth, website traffic from social, conversion rates, and ROI. Monthly reports show progress toward your goals.",
  },
];

export default function SocialMediaManagementPage() {
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
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-pink-50 border border-pink-200 rounded-full text-sm text-pink-700 font-medium mb-6">
                  <Share2 className="w-4 h-4" />
                  Social Media Management
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                  Dominate Every{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600">
                    Social Platform
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-black/60 mb-8 leading-relaxed">
                  Strategic social media management that builds communities, drives
                  engagement, and turns followers into loyal customers.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="https://calendly.com/e8llc/eric-davis-introduction-meeting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full hover:opacity-90 transition-all hover:scale-105 font-medium shadow-lg shadow-pink-200"
                  >
                    Schedule a Call
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/work"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-black/10 text-black rounded-full hover:border-pink-300 transition-all font-medium"
                  >
                    View Our Work
                  </Link>
                </div>
              </div>

              {/* Right: phone-style portrait cards staggered */}
              <div className="flex items-end justify-center gap-3">
                {/* Card 1 — StayFit305 / Instagram */}
                <div className="relative w-28 h-64 rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/10 self-end flex-shrink-0">
                  <div className="w-full h-full object-cover bg-zinc-200" />
                  <div className="absolute top-2 left-2">
                    <span className="inline-flex items-center px-2 py-0.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[10px] font-bold rounded-full shadow">
                      Instagram
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-white text-[10px] font-semibold">@stayfit305</p>
                  </div>
                </div>

                {/* Card 2 — Soda City Simpson / TikTok (tallest, center) */}
                <div className="relative w-28 h-80 rounded-2xl overflow-hidden shadow-2xl ring-2 ring-pink-300/60 flex-shrink-0">
                  <div className="w-full h-full object-cover bg-zinc-200" />
                  <div className="absolute top-2 left-2">
                    <span className="inline-flex items-center px-2 py-0.5 bg-black text-white text-[10px] font-bold rounded-full shadow">
                      TikTok
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-white text-[10px] font-semibold">@sodacitysimpson</p>
                  </div>
                </div>

                {/* Card 3 — Contractor+ / Facebook */}
                <div className="relative w-28 h-64 rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/10 self-end flex-shrink-0">
                  <div className="w-full h-full object-cover bg-zinc-200" />
                  <div className="absolute top-2 left-2">
                    <span className="inline-flex items-center px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full shadow">
                      Facebook
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-white text-[10px] font-semibold">@contractorplus</p>
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
                Complete social media management to grow your brand presence across every platform.
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
              <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">Our Work</h2>
              <p className="text-lg text-black/60 max-w-2xl mx-auto">
                Real results for real brands across all major social platforms.
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
                  Why Choose Our Social Media Management
                </h2>
                <p className="text-lg text-black/60 mb-8">
                  We don&apos;t just post content — we build communities and create meaningful
                  connections between your brand and your audience.
                </p>
                <ul className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-pink-500 flex-shrink-0" />
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
                <div className="rounded-2xl p-8 bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-xl shadow-pink-200 flex flex-col items-center text-center">
                  <h3 className="text-2xl font-bold mb-3">Ready to grow your audience?</h3>
                  <p className="text-white/80 mb-6">
                    Let&apos;s discuss how we can transform your social media presence into a
                    revenue-generating machine.
                  </p>
                  <Link
                    href="https://calendly.com/e8llc/eric-davis-introduction-meeting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white text-pink-600 rounded-full hover:bg-white/90 transition-all font-semibold"
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
