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
        description: 'Proven tactics to rapidly grow your audience with engaged, monetizable followers.',
    },
    {
        icon: Eye,
        title: 'Viral Content Creation',
        description: 'Content engineered to go viral and maximize your reach and monetization potential.',
    },
    {
        icon: Target,
        title: 'Niche Selection',
        description: 'Strategic niche positioning to attract the most valuable audience for monetization.',
    },
    {
        icon: DollarSign,
        title: 'Revenue Optimization',
        description: 'Maximize earnings through strategic monetization across multiple revenue streams.',
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
                {/* Hero Section */}
                <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            <div>
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/5 rounded-full text-sm text-black/70 mb-6">
                                    <DollarSign className="w-4 h-4" />
                                    Monetized Accounts
                                </div>
                                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                                    Turn Views Into{' '}
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-700 to-black">
                                        Revenue
                                    </span>
                                </h1>
                                <p className="text-lg sm:text-xl text-black/60 mb-8 leading-relaxed">
                                    Build and scale revenue-generating social media accounts that create
                                    sustainable income streams from your content.
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
                                            <DollarSign className="w-16 h-16 text-white" />
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
                                Everything you need to build profitable social media accounts.
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
                                    Why Choose Our Monetization Service
                                </h2>
                                <p className="text-lg text-black/60 mb-8">
                                    We&apos;ve helped countless creators and brands build sustainable income
                                    from their social media presence. Let us do the same for you.
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
                                    Let&apos;s discuss how we can help you monetize your social media presence.
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
