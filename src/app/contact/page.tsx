import { Navigation } from '@/components/landing/Navigation';
import { Footer } from '@/components/landing/Footer';
import ContactForm from '@/components/landing/ContactForm';
import { Mail, Phone, MapPin } from 'lucide-react';

export default function ContactPage() {  // ← Changed: Added "default"
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="pt-20 sm:pt-24 pb-16 sm:pb-20 px-5 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl text-black mb-3 sm:mb-4">
              Get in Touch
            </h1>
            <p className="text-base sm:text-base text-black/60 max-w-2xl mx-auto px-4 sm:px-0">
              Ready to start your project? Have questions about our services? We love to hear from you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 px-4 sm:px-0">
            {/* Contact Form */}
            <div className="bg-white border border-black/5 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-lg">
              <h3 className="text-lg sm:text-xl text-black mb-4 sm:mb-6">
                Send us a message
              </h3>
              <ContactForm />
            </div>

            {/* Contact Info */}
            <div className="space-y-6 sm:space-y-8">
              <div>
                <h3 className="text-lg sm:text-xl text-black mb-4 sm:mb-6">
                  Contact Information
                </h3>
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black/5 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-black/70" />
                    </div>
                    <div>
                      <p className="text-base sm:text-base text-black mb-1">Email</p>
                      <a href="mailto:info@e8productions.com" className="text-sm sm:text-sm text-black/60 hover:text-black transition-colors break-all">
                        info@e8productions.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black/5 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-black/70" />
                    </div>
                    <div>
                      <p className="text-base sm:text-base text-black mb-1">Phone</p>
                      <a href="tel:+18088590875" className="text-sm sm:text-sm text-black/60 hover:text-black transition-colors">
                        (808) 859-0875
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black/5 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-black/70" />
                    </div>
                    <div>
                      <p className="text-base sm:text-base text-black mb-1">Location</p>
                      <p className="text-sm sm:text-sm text-black/60">
                        Remote-first team<br />
                        Serving clients globally
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-black rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-white shadow-xl">
                <h4 className="text-base sm:text-lg mb-2 sm:mb-3">
                  Quick Response
                </h4>
                <p className="text-base sm:text-base text-white/70">
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
