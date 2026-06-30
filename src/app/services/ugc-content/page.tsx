import { Navigation } from "@/components/landing/Navigation";
import { CallToAction } from "@/components/landing/CallToAction";
import { Footer } from "@/components/landing/Footer";
import { QnA } from "@/components/landing/QnA";
import { Camera, Heart, Smartphone, Users, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "UGC Content",
  description:
    "Authentic user-generated style content that resonates with audiences and drives engagement.",
  pathname: "/services/ugc-content",
});

const features = [
    { icon: Smartphone, title: 'Authentic Style', description: 'Content that looks and feels organic, just like real user-generated posts.' },
    { icon: Heart, title: 'High Engagement', description: 'UGC-style content consistently outperforms polished ads in engagement metrics.' },
    { icon: Users, title: 'Creator Network', description: 'Access to our network of talented creators who can represent your brand authentically.' },
    { icon: Camera, title: 'Rapid Production', description: 'Quick turnaround on UGC content to keep your content calendar full.' },
];

const benefits = ['Higher engagement than traditional ads', 'Builds trust and authenticity', 'Cost-effective content production', 'Works across all platforms', 'A/B testing with multiple creators', 'Scalable content strategy'];

const qnaItems = [
    {
        question: "What is UGC content?",
        answer: "UGC (User-Generated Content) is authentic content created by real users, influencers, or customers featuring your product or service. It's more trustworthy than traditional advertising."
    },
    {
        question: "How do you find UGC creators?",
        answer: "We use a combination of creator databases, social media research, and our network of influencers. We match creators whose audience and style align with your brand."
    },
    {
        question: "What's the typical timeline for UGC campaigns?",
        answer: "Most UGC campaigns take 2-4 weeks from concept to delivery. This includes creator outreach, content creation, approval, and final delivery."
    },
    {
        question: "Do creators keep the rights to their content?",
        answer: "No, when working with us, creators grant you full usage rights for commercial purposes across all platforms. We handle all legal agreements and licensing."
    },
    {
        question: "How do you ensure quality control?",
        answer: "We provide detailed briefs to creators, review all content before approval, and can request revisions. We also offer editing services to polish the final content."
    }
];

export default function UGCContentPage() {
    return (
        <div className="min-h-screen bg-white">
            <Navigation />
            <div className="pt-20 sm:pt-24">
                <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            <div>
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/5 rounded-full text-sm text-black/70 mb-6">
                                    <Camera className="w-4 h-4" />UGC Content
                                </div>
                                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                                    Authentic Content That <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-700 to-black">Converts</span>
                                </h1>
                                <p className="text-lg sm:text-xl text-black/60 mb-8 leading-relaxed">User-generated style content that feels authentic and drives higher engagement than traditional advertising.</p>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <Link href="/contact" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-white rounded-full hover:bg-black/90 transition-all hover:scale-105 font-medium">Get Started<ArrowRight className="w-5 h-5" /></Link>
                                    <Link href="/work" className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-black/10 text-black rounded-full hover:border-black/30 transition-all font-medium">View Our Work</Link>
                                </div>
                            </div>
                            <div className="relative"><div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl overflow-hidden"><div className="absolute inset-0 flex items-center justify-center"><div className="w-32 h-32 bg-gradient-to-br from-gray-900 to-black rounded-3xl flex items-center justify-center shadow-2xl"><Camera className="w-16 h-16 text-white" /></div></div></div></div>
                        </div>
                    </div>
                </section>
                <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24 bg-gray-50">
                    <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-12"><h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">What&apos;s Included</h2><p className="text-lg text-black/60 max-w-2xl mx-auto">Everything you need for authentic UGC content.</p></div>
                        <div className="grid md:grid-cols-2 gap-6">
                            {features.map((feature, index) => (<div key={index} className="p-8 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"><div className="w-14 h-14 bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center mb-6"><feature.icon className="w-7 h-7 text-white" /></div><h3 className="text-xl font-semibold text-black mb-3">{feature.title}</h3><p className="text-black/60 leading-relaxed">{feature.description}</p></div>))}
                        </div>
                    </div>
                </section>
                <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            <div>
                                <h2 className="text-3xl sm:text-4xl font-bold text-black mb-6">Why Choose Our UGC Service</h2>
                                <p className="text-lg text-black/60 mb-8">Consumers trust content that looks authentic. Our UGC-style content delivers the trust factor that drives conversions.</p>
                                <ul className="space-y-4">{benefits.map((benefit, index) => (<li key={index} className="flex items-center gap-3"><CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" /><span className="text-black/80">{benefit}</span></li>))}</ul>
                            </div>
                            <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 text-white">
                                <h3 className="text-2xl font-bold mb-4">Ready to get started?</h3>
                                <p className="text-white/70 mb-6">Let&apos;s create authentic content that resonates with your audience.</p>
                                <Link href="/contact" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full hover:bg-white/90 transition-all font-medium">Schedule a Call<ArrowRight className="w-5 h-5" /></Link>
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
