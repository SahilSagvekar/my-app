import { Navigation } from '@/components/landing/Navigation';
import { Footer } from '@/components/landing/Footer';
import { Mail, Phone, MapPin } from 'lucide-react';

export default function ContactPage() {  // ← Changed: Added "default"
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="pt-24 pb-20 px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-black mb-4">
              Get in Touch
            </h1>
            <p className="text-black/60 max-w-2xl mx-auto">
              Ready to start your project? Have questions about our services? We'd love to hear from you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div className="bg-white border border-black/5 rounded-3xl p-8">
              <h3 className="text-black mb-6">
                Send us a message
              </h3>
              <form className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm text-black/70 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    className="w-full px-4 py-3 border border-black/10 rounded-xl focus:outline-none focus:border-black/30 transition-colors"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm text-black/70 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="w-full px-4 py-3 border border-black/10 rounded-xl focus:outline-none focus:border-black/30 transition-colors"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm text-black/70 mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    rows={5}
                    className="w-full px-4 py-3 border border-black/10 rounded-xl focus:outline-none focus:border-black/30 transition-colors resize-none"
                    placeholder="Tell us about your project..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-6 py-4 bg-black text-white rounded-full transition-all hover:bg-black/90 hover:scale-105"
                >
                  Send Message
                </button>
              </form>
            </div>

            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <h3 className="text-black mb-6">
                  Contact Information
                </h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-black/70" />
                    </div>
                    <div>
                      <p className="text-black mb-1">Email</p>
                      <a href="mailto:info@e8productions.com" className="text-black/60 hover:text-black transition-colors">
                        info@e8productions.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-black/70" />
                    </div>
                    <div>
                      <p className="text-black mb-1">Phone</p>
                      <a href="tel:+18088590875" className="text-black/60 hover:text-black transition-colors">
                        (808) 859-0875
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-black/70" />
                    </div>
                    <div>
                      <p className="text-black mb-1">Location</p>
                      <p className="text-black/60">
                        Remote-first team<br />
                        Serving clients globally
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-black rounded-3xl p-8 text-white">
                <h4 className="mb-3">
                  Quick Response
                </h4>
                <p className="text-white/70">
                  We typically respond to all inquiries within 24 hours during business days.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}