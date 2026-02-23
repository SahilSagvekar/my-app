import { Navigation } from "@/components/landing/Navigation";
import { CallToAction } from "@/components/landing/CallToAction";
import { Footer } from "@/components/landing/Footer";
import { Video, Camera, Film, Mic, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
    title: 'Video Production | E8 Productions',
    description: 'Professional video content that makes your business look bigger than it is. From ads to brand stories.',
};

const features = [
    {
        icon: Camera,
        title: 'Professional Filming',
        description: 'High-quality video production with cinema-grade equipment and experienced crews.',
    },
    {
        icon: Film,
        title: 'Commercial Production',
        description: 'Eye-catching commercials and advertisements that drive action and conversions.',
    },
    {
        icon: Mic,
        title: 'Brand Documentaries',
        description: 'Tell your brand story in a compelling way that connects with your audience emotionally.',
    },
    {
        icon: Video,
        title: 'Product Videos',
        description: 'Showcase your products in the best light with professional demonstrations and features.',
    },
];

const benefits = [
    'Professional quality that rivals major brands',
    'Engaging content that captures attention',
    'Versatile videos for multiple platforms',
    'Fast turnaround without compromising quality',
    'Full creative support from concept to delivery',
    'Scalable production for any budget',
];

export default function VideoProductionPage() {
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
                                    <Video className="w-4 h-4" />
                                    Video Production
                                </div>
                                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                                    Professional Video{' '}
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-700 to-black">
                                        That Converts
                                    </span>
                                </h1>
                                <p className="text-lg sm:text-xl text-black/60 mb-8 leading-relaxed">
                                    From concept to final cut, we create video content that makes your business
                                    look bigger than it is and drives real results.
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
                                            <Video className="w-16 h-16 text-white" />
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
                                Full-service video production from pre-production planning to final delivery.
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
                                    Why Choose Our Video Production
                                </h2>
                                <p className="text-lg text-black/60 mb-8">
                                    We combine creative excellence with strategic thinking to produce videos
                                    that don&apos;t just look great—they deliver measurable business results.
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
                                    Let&apos;s discuss your video production needs and bring your vision to life.
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
            </div>
            <Footer />
        </div>
    );
}
