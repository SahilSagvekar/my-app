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
    },
    {
        icon: TrendingUp,
        title: 'Competitive Research',
        description: 'Analyze what works for competitors and identify opportunities to differentiate your brand.',
    },
    {
        icon: Users,
        title: 'Content Calendar',
        description: 'Strategic planning of content themes, topics, and publishing schedules for maximum impact.',
    },
    {
        icon: Lightbulb,
        title: 'Creative Direction',
        description: 'Develop a unique visual and narrative style that sets your brand apart.',
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
                {/* Hero Section */}
                <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            <div>
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/5 rounded-full text-sm text-black/70 mb-6">
                                    <Lightbulb className="w-4 h-4" />
                                    Content Strategy
                                </div>
                                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                                    Smart Planning for{' '}
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-700 to-black">
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
                            <div className="relative">
                                <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl overflow-hidden">
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-32 h-32 bg-gradient-to-br from-gray-900 to-black rounded-3xl flex items-center justify-center shadow-2xl">
                                            <Lightbulb className="w-16 h-16 text-white" />
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
                                Our comprehensive content strategy service covers everything you need to build a successful content presence.
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
                                    Why Content Strategy Matters
                                </h2>
                                <p className="text-lg text-black/60 mb-8">
                                    Without a clear strategy, you&apos;re just creating content and hoping it works.
                                    With our strategic approach, every piece of content serves a purpose and moves
                                    you closer to your business goals.
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
                                    Let&apos;s discuss how our content strategy services can help your business grow.
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
