import { Navigation } from "@/components/landing/Navigation";
import { CallToAction } from "@/components/landing/CallToAction";
import { Footer } from "@/components/landing/Footer";
import { QnA } from "@/components/landing/QnA";
import { Scissors, Sparkles, Layers, Zap, CheckCircle, ArrowRight } from 'lucide-react';
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
    },
    {
        icon: Sparkles,
        title: 'Motion Graphics',
        description: 'Eye-catching animations and graphics that elevate your content and reinforce your brand.',
    },
    {
        icon: Layers,
        title: 'Color Grading',
        description: 'Professional color correction and grading that gives your videos a cinematic look.',
    },
    {
        icon: Zap,
        title: 'Quick Turnaround',
        description: 'Fast delivery without sacrificing quality—perfect for time-sensitive campaigns.',
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
                {/* Hero Section */}
                <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            <div>
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/5 rounded-full text-sm text-black/70 mb-6">
                                    <Scissors className="w-4 h-4" />
                                    Video Editing
                                </div>
                                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                                    Raw Footage to{' '}
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-700 to-black">
                                        Polished Stories
                                    </span>
                                </h1>
                                <p className="text-lg sm:text-xl text-black/60 mb-8 leading-relaxed">
                                    Our expert editors transform your raw footage into compelling narratives
                                    that captivate audiences and drive engagement.
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
                                            <Scissors className="w-16 h-16 text-white" />
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
                                Comprehensive video editing services to make your content shine.
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
                                    Why Choose Our Video Editing
                                </h2>
                                <p className="text-lg text-black/60 mb-8">
                                    Great editing is invisible—it makes your content feel natural and engaging
                                    while guiding viewers through your story seamlessly.
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
                                    Send us your footage and let our editors work their magic.
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
