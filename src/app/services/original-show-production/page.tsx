import { Navigation } from "@/components/landing/Navigation";
import { CallToAction } from "@/components/landing/CallToAction";
import { Footer } from "@/components/landing/Footer";
import { QnA } from "@/components/landing/QnA";
import { Tv, Film, Users, Star, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Original Show Production",
  description:
    "Full-scale production of original content series and shows that captivate audiences.",
  pathname: "/services/original-show-production",
});

const features = [
    { icon: Film, title: 'Concept Development', description: 'From initial idea to fully developed show concepts with compelling narratives.' },
    { icon: Tv, title: 'Full Production', description: 'End-to-end production including filming, editing, and post-production.' },
    { icon: Users, title: 'Talent Management', description: 'Casting, host selection, and talent coordination for your show.' },
    { icon: Star, title: 'Distribution Strategy', description: 'Strategic placement across platforms to maximize reach and engagement.' },
];

const benefits = ['Create unique, branded content series', 'Build audience loyalty through episodic content', 'Professional production quality', 'Multi-platform distribution', 'Full creative control', 'Revenue generation through sponsorships'];

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
                <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            <div>
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/5 rounded-full text-sm text-black/70 mb-6">
                                    <Tv className="w-4 h-4" />Original Show Production
                                </div>
                                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                                    Create Your Own <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-700 to-black">Original Show</span>
                                </h1>
                                <p className="text-lg sm:text-xl text-black/60 mb-8 leading-relaxed">Full-scale production of original content series that captivate audiences and build lasting brand recognition.</p>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <Link href="/contact" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-white rounded-full hover:bg-black/90 transition-all hover:scale-105 font-medium">Get Started<ArrowRight className="w-5 h-5" /></Link>
                                    <Link href="/shows" className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-black/10 text-black rounded-full hover:border-black/30 transition-all font-medium">View Our Shows</Link>
                                </div>
                            </div>
                            <div className="relative"><div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl overflow-hidden"><div className="absolute inset-0 flex items-center justify-center"><div className="w-32 h-32 bg-gradient-to-br from-gray-900 to-black rounded-3xl flex items-center justify-center shadow-2xl"><Tv className="w-16 h-16 text-white" /></div></div></div></div>
                        </div>
                    </div>
                </section>
                <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24 bg-gray-50">
                    <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-12"><h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">What&apos;s Included</h2><p className="text-lg text-black/60 max-w-2xl mx-auto">Complete show production from concept to distribution.</p></div>
                        <div className="grid md:grid-cols-2 gap-6">
                            {features.map((feature, index) => (<div key={index} className="p-8 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"><div className="w-14 h-14 bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center mb-6"><feature.icon className="w-7 h-7 text-white" /></div><h3 className="text-xl font-semibold text-black mb-3">{feature.title}</h3><p className="text-black/60 leading-relaxed">{feature.description}</p></div>))}
                        </div>
                    </div>
                </section>
                <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            <div>
                                <h2 className="text-3xl sm:text-4xl font-bold text-black mb-6">Why Choose Our Show Production</h2>
                                <p className="text-lg text-black/60 mb-8">We&apos;ve produced successful shows across multiple platforms, building loyal audiences and generating significant revenue for our partners.</p>
                                <ul className="space-y-4">{benefits.map((benefit, index) => (<li key={index} className="flex items-center gap-3"><CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" /><span className="text-black/80">{benefit}</span></li>))}</ul>
                            </div>
                            <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 text-white">
                                <h3 className="text-2xl font-bold mb-4">Ready to get started?</h3>
                                <p className="text-white/70 mb-6">Let&apos;s discuss your show concept and bring it to life.</p>
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
