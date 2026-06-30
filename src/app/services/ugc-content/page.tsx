import { Navigation } from "@/components/landing/Navigation";
import { CallToAction } from "@/components/landing/CallToAction";
import { Footer } from "@/components/landing/Footer";
import { QnA } from "@/components/landing/QnA";
import {
  Camera,
  Search,
  ClipboardList,
  ShieldCheck,
  FileCheck,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "UGC Content",
  description:
    "Authentic user-generated style content that resonates with audiences and drives engagement.",
  pathname: "/services/ugc-content",
});

const features = [
  {
    icon: Search,
    title: "Creator Sourcing",
    description:
      "We find and vet creators perfectly aligned with your brand values, target audience, and aesthetic — so every piece of content feels genuine.",
    iconGradient: "from-orange-500 to-orange-600",
    cardBg: "bg-orange-50/50",
    cardBorder: "border-orange-200",
  },
  {
    icon: ClipboardList,
    title: "Content Brief Creation",
    description:
      "Detailed, strategic briefs ensure every creator delivers content that meets your campaign objectives and brand guidelines from the first take.",
    iconGradient: "from-amber-400 to-amber-500",
    cardBg: "bg-amber-50/50",
    cardBorder: "border-amber-200",
  },
  {
    icon: ShieldCheck,
    title: "Quality Control",
    description:
      "Multi-stage review process ensures every piece of content meets your brand standards, with revision rounds built into the workflow.",
    iconGradient: "from-rose-500 to-rose-600",
    cardBg: "bg-rose-50/50",
    cardBorder: "border-rose-200",
  },
  {
    icon: FileCheck,
    title: "Usage Rights Management",
    description:
      "Full commercial usage rights secured across all platforms with clear licensing agreements — no surprises, no expired licenses.",
    iconGradient: "from-violet-500 to-violet-600",
    cardBg: "bg-violet-50/50",
    cardBorder: "border-violet-200",
  },
];

const benefits = [
  "Authentic content that converts",
  "Diverse creator perspectives",
  "Cost-effective production",
  "Quick content at scale",
  "Full usage rights included",
  "Multi-platform formats",
];

const heroGrid = [
  { src: "/assets/CAROUSEL-2/ContractorPlus-04-01.png", label: "Contractor+" },
  { src: "/assets/CAROUSEL-2/connectai.png", label: "ConnectAI" },
  { src: "/assets/CAROUSEL-2/TURPONE.png", label: "Turpone" },
  { src: "/assets/kirgo-thumbnail.jpg", label: "Kirgo" },
];

const portfolioItems = [
  {
    src: "/assets/CAROUSEL-2/ContractorPlus-04-01.png",
    client: "Contractor+",
    type: "UGC Campaign",
  },
  {
    src: "/assets/CAROUSEL-2/connectai.png",
    client: "ConnectAI",
    type: "UGC Campaign",
  },
  {
    src: "/assets/CAROUSEL-2/TURPONE.png",
    client: "Turpone",
    type: "UGC Campaign",
  },
  {
    src: "/assets/CAROUSEL-2/STAYFIT305.jpg",
    client: "StayFit305",
    type: "UGC Campaign",
  },
];

const qnaItems = [
  {
    question: "What is UGC content?",
    answer:
      "UGC (User-Generated Content) is authentic content created by real users, influencers, or customers featuring your product or service. It's more trustworthy than traditional advertising.",
  },
  {
    question: "How do you find UGC creators?",
    answer:
      "We use a combination of creator databases, social media research, and our network of influencers. We match creators whose audience and style align with your brand.",
  },
  {
    question: "What's the typical timeline for UGC campaigns?",
    answer:
      "Most UGC campaigns take 2-4 weeks from concept to delivery. This includes creator outreach, content creation, approval, and final delivery.",
  },
  {
    question: "Do creators keep the rights to their content?",
    answer:
      "No, when working with us, creators grant you full usage rights for commercial purposes across all platforms. We handle all legal agreements and licensing.",
  },
  {
    question: "How do you ensure quality control?",
    answer:
      "We provide detailed briefs to creators, review all content before approval, and can request revisions. We also offer editing services to polish the final content.",
  },
];

export default function UGCContentPage() {
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
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-full text-sm text-orange-700 font-medium mb-6">
                  <Camera className="w-4 h-4" />
                  UGC Content
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                  Authentic Content{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-400">
                    That Converts
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-black/60 mb-8 leading-relaxed">
                  User-generated style content that feels authentic and drives higher engagement
                  than traditional advertising — at a fraction of the cost.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="https://calendly.com/e8llc/eric-davis-introduction-meeting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-400 text-white rounded-full hover:opacity-90 transition-all hover:scale-105 font-medium shadow-lg shadow-orange-200"
                  >
                    Schedule a Call
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/work"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-black/10 text-black rounded-full hover:border-orange-300 transition-all font-medium"
                  >
                    View Our Work
                  </Link>
                </div>
              </div>

              {/* Right: 2x2 brand image grid */}
              <div className="grid grid-cols-2 gap-3">
                {heroGrid.map((item, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-2xl overflow-hidden shadow-lg group"
                  >
                    <div className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 bg-zinc-200" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
                    <div className="absolute bottom-3 left-3">
                      <span className="text-white text-sm font-semibold drop-shadow">
                        {item.label}
                      </span>
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
              <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">
                What&apos;s Included
              </h2>
              <p className="text-lg text-black/60 max-w-2xl mx-auto">
                Everything you need for authentic UGC content that performs across every channel.
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
              <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">UGC Portfolio</h2>
              <p className="text-lg text-black/60 max-w-2xl mx-auto">
                Campaigns that drove real results — authentic content our clients actually loved.
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
                  Why Choose Our UGC Service
                </h2>
                <p className="text-lg text-black/60 mb-8">
                  Consumers trust content that looks authentic. Our UGC-style content delivers
                  the trust factor that turns viewers into buyers.
                </p>
                <ul className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-orange-500 flex-shrink-0" />
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
                <div className="rounded-2xl p-8 bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-xl shadow-orange-200 flex flex-col items-center text-center">
                  <h3 className="text-2xl font-bold mb-3">Ready to create authentic content?</h3>
                  <p className="text-white/85 mb-6">
                    Let&apos;s build a UGC strategy that resonates with your audience and drives
                    real conversions at scale.
                  </p>
                  <Link
                    href="https://calendly.com/e8llc/eric-davis-introduction-meeting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white text-orange-600 rounded-full hover:bg-white/90 transition-all font-semibold"
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
