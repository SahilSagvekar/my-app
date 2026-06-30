import { Navigation } from "@/components/landing/Navigation";
import { CallToAction } from "@/components/landing/CallToAction";
import { Footer } from "@/components/landing/Footer";
import { QnA } from "@/components/landing/QnA";
import { Share2, BarChart, MessageCircle, Users, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Social Media Management",
  description:
    "Strategic management of your social presence across all platforms to maximize engagement.",
  pathname: "/services/social-media-management",
});

const features = [
    {
        icon: BarChart,
        title: 'Analytics & Reporting',
        description: 'Detailed insights into your social performance with actionable recommendations.',
    },
    {
        icon: MessageCircle,
        title: 'Community Management',
        description: 'Active engagement with your audience to build loyalty and trust.',
    },
    {
        icon: Users,
        title: 'Audience Growth',
        description: 'Strategic tactics to grow your following with engaged, relevant users.',
    },
    {
        icon: Share2,
        title: 'Multi-Platform Strategy',
        description: 'Coordinated presence across Instagram, TikTok, YouTube, and more.',
    },
];

const benefits = [
    'Consistent, professional brand presence',
    'Increased engagement and reach',
    'Data-driven content decisions',
    'Community building and loyalty',
    'Time saved on social management',
    'Expert platform-specific strategies',
];

const qnaItems = [
    {
        question: "What's included in social media management?",
        answer: "Our service includes content creation, scheduling, community management, engagement monitoring, performance analytics, and strategic planning across all major platforms."
    },
    {
        question: "How often do you post content?",
        answer: "Posting frequency depends on your goals and platform. Typically 3-7 posts per week per platform, optimized for engagement rather than quantity. We focus on quality over quantity."
    },
    {
        question: "What's the onboarding process like?",
        answer: "1) Strategy consultation and goal setting, 2) Account audit and brand guidelines review, 3) Content calendar planning, 4) Access setup and training, 5) Launch and ongoing optimization."
    },
    {
        question: "Do you handle community management?",
        answer: "Yes, we monitor comments, messages, and mentions 24/7. We respond professionally, handle customer service issues, and build relationships with your audience."
    },
    {
        question: "How do you measure success?",
        answer: "We track engagement rates, reach, follower growth, website traffic from social, conversion rates, and ROI. Monthly reports show progress toward your goals."
    }
];

export default function SocialMediaManagementPage() {
    return (
        <div className="min-h-screen bg-white">
            <Navigation />
            <div className="pt-20 sm:pt-24">
                {/* Hero Section */}
                <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            <div>
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/5 rounded-full text-sm text-black/70 mb-6">
                                    <Share2 className="w-4 h-4" />
                                    Social Media Management
                                </div>
                                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                                    Dominate{' '}
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-700 to-black">
                                        Social Media
                                    </span>
                                </h1>
                                <p className="text-lg sm:text-xl text-black/60 mb-8 leading-relaxed">
                                    Strategic social media management that builds communities, drives engagement,
                                    and turns followers into customers.
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
                            <div className="relative">
                                <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl overflow-hidden">
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-32 h-32 bg-gradient-to-br from-gray-900 to-black rounded-3xl flex items-center justify-center shadow-2xl">
                                            <Share2 className="w-16 h-16 text-white" />
                                        </div>
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
                                Complete social media management to grow your brand presence.
                            </p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                            {features.map((feature, index) => (
                                <div
                                    key={index}
                                    className="p-8 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div className="w-14 h-14 bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center mb-6">
                                        <feature.icon className="w-7 h-7 text-white" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-black mb-3">{feature.title}</h3>
                                    <p className="text-black/60 leading-relaxed">{feature.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Benefits Section */}
                <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            <div>
                                <h2 className="text-3xl sm:text-4xl font-bold text-black mb-6">
                                    Why Choose Our Social Media Management
                                </h2>
                                <p className="text-lg text-black/60 mb-8">
                                    We don&apos;t just post content—we build communities and create meaningful
                                    connections between your brand and your audience.
                                </p>
                                <ul className="space-y-4">
                                    {benefits.map((benefit, index) => (
                                        <li key={index} className="flex items-center gap-3">
                                            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                                            <span className="text-black/80">{benefit}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 text-white">
                                <h3 className="text-2xl font-bold mb-4">Ready to get started?</h3>
                                <p className="text-white/70 mb-6">
                                    Let&apos;s discuss how we can transform your social media presence.
                                </p>
                                <Link
                                    href="/contact"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full hover:bg-white/90 transition-all font-medium"
                                >
                                    Schedule a Call
                                    <ArrowRight className="w-5 h-5" />
                                </Link>
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
