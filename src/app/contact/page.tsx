import { Navigation } from '@/components/landing/Navigation';
import { Footer } from '@/components/landing/Footer';
import ContactForm from '@/components/landing/ContactForm';
import { Mail, Phone, MapPin, Instagram, Linkedin, Youtube } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Contact — E8 Productions',
  description: 'Get in touch with E8 Productions. Reach out for video production, social media management, and content strategy.',
  pathname: '/contact',
});

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <section className="pt-28 sm:pt-32 pb-20 sm:pb-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">

          {/* Page header */}
          <div className="text-center mb-14 sm:mb-20">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4">
              Let's Work Together
            </h1>
            <p className="text-base sm:text-lg text-black/60 max-w-2xl mx-auto">
              Ready to grow your brand? Reach out and we'll get back to you within 24 hours.
            </p>
          </div>

          {/* Two column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-20">

            {/* Left: contact info */}
            <div className="lg:col-span-2 space-y-10">
              {/* Contact details */}
              <div className="space-y-6">
                <a
                  href="mailto:info@e8productions.com"
                  className="flex items-center gap-4 group"
                >
                  <div className="w-11 h-11 bg-black rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-black/40 uppercase tracking-wider mb-0.5">General</p>
                    <p className="text-sm sm:text-base text-black group-hover:underline">info@e8productions.com</p>
                  </div>
                </a>

                <a
                  href="mailto:legal@e8productions.com"
                  className="flex items-center gap-4 group"
                >
                  <div className="w-11 h-11 bg-black rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-black/40 uppercase tracking-wider mb-0.5">Legal</p>
                    <p className="text-sm sm:text-base text-black group-hover:underline">legal@e8productions.com</p>
                  </div>
                </a>

                <a
                  href="tel:+18432672841"
                  className="flex items-center gap-4 group"
                >
                  <div className="w-11 h-11 bg-black rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-black/40 uppercase tracking-wider mb-0.5">Phone</p>
                    <p className="text-sm sm:text-base text-black group-hover:underline">(843) 267-2841</p>
                  </div>
                </a>

                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-black rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-black/40 uppercase tracking-wider mb-0.5">Location</p>
                    <p className="text-sm sm:text-base text-black">Based in Fort Lauderdale, Florida</p>
                    <p className="text-sm text-black/50">Remote-first · Serving clients globally</p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-black/5" />

              {/* Social links */}
              <div>
                <p className="text-xs font-semibold text-black/40 uppercase tracking-wider mb-4">Follow Us</p>
                <div className="flex gap-3">
                  <a
                    href="https://www.instagram.com/e8inc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-xl bg-black/5 hover:bg-black hover:text-white text-black flex items-center justify-center transition-all group"
                  >
                    <Instagram className="w-4 h-4" />
                  </a>
                  <a
                    href="https://www.linkedin.com/company/e8productionsllc/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-xl bg-black/5 hover:bg-black hover:text-white text-black flex items-center justify-center transition-all"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                  <a
                    href="https://www.youtube.com/@e8productions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-xl bg-black/5 hover:bg-black hover:text-white text-black flex items-center justify-center transition-all"
                  >
                    <Youtube className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>

            {/* Right: form */}
            <div className="lg:col-span-3">
              <ContactForm />
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
