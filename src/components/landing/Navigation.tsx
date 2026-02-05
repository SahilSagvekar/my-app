'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, Video, Lightbulb, Share2, Cpu, Scissors, DollarSign, Tv, Camera } from 'lucide-react';
import logoImage from '../../../public/assets/575743c7bd0af4189cb4a7349ecfe505c6699243.png';

const services = [
  {
    icon: Lightbulb,
    title: 'Content Strategy',
    description: 'Smart planning for your market',
    href: '/services/content-strategy',
  },
  {
    icon: Video,
    title: 'Video Production',
    description: 'Professional video content',
    href: '/services/video-production',
  },
  {
    icon: Scissors,
    title: 'Video Editing',
    description: 'Polished, professional editing',
    href: '/services/video-editing',
  },
  {
    icon: Share2,
    title: 'Social Media Management',
    description: 'Strategic social presence',
    href: '/services/social-media-management',
  },
  {
    icon: Cpu,
    title: 'Posting & Distribution',
    description: 'Automated scheduling',
    href: '/services/posting-distribution',
  },
  {
    icon: DollarSign,
    title: 'Monetized Accounts',
    description: 'Revenue-generating accounts',
    href: '/services/monetized-accounts',
  },
  {
    icon: Tv,
    title: 'Original Show Production',
    description: 'Full-scale show production',
    href: '/services/original-show-production',
  },
  {
    icon: Camera,
    title: 'UGC Content',
    description: 'Authentic user-generated content',
    href: '/services/ugc-content',
  },
];

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/" className="text-black transition-opacity hover:opacity-60">
                <Image
                  src={logoImage}
                  alt="E8 Productions"
                  width={120}
                  height={32}
                  className="h-6 sm:h-8 w-auto"
                />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8 font-bold">
              {/* Services Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setServicesDropdownOpen(true)}
                onMouseLeave={() => setServicesDropdownOpen(false)}
              >
                <button
                  className="flex items-center gap-1 text-black/70 transition-colors hover:text-black"
                  onClick={() => setServicesDropdownOpen(!servicesDropdownOpen)}
                >
                  Our Services
                  {/* <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${servicesDropdownOpen ? 'rotate-180' : ''}`} /> */}
                </button>

                {/* Dropdown Menu */}
                <div
                  className={`absolute top-full left-1/2 -translate-x-1/2 pt-4 transition-all duration-200 ${servicesDropdownOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'
                    }`}
                >
                  <div className="bg-white rounded-2xl shadow-xl border border-black/5 p-4 w-[480px] grid grid-cols-2 gap-1">
                    {/* View All Services Link */}
                    <Link
                      href="/services"
                      className="col-span-2 flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-black/5 transition-colors group mb-2 border-b border-black/5 pb-4"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Video className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <span className="block text-sm font-semibold text-black group-hover:text-black">
                          All Services Overview
                        </span>
                        <span className="block text-xs text-black/50 font-normal">
                          See everything we offer
                        </span>
                      </div>
                    </Link>

                    {/* Individual Services */}
                    {services.map((service) => (
                      <Link
                        key={service.href}
                        href={service.href}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 transition-colors group"
                      >
                        <div className="w-9 h-9 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                          <service.icon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <span className="block text-sm font-medium text-black group-hover:text-black">
                            {service.title}
                          </span>
                          <span className="block text-xs text-black/50 font-normal">
                            {service.description}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <Link href="/shows" className="text-black/70 transition-colors hover:text-black">
                Original Shows
              </Link>
              <Link href="/work" className="text-black/70 transition-colors hover:text-black">
                Results
              </Link>
              <Link href="/about" className="text-black/70 transition-colors hover:text-black">
                About Us
              </Link>
              <Link href="/contact" className="text-black/70 transition-colors hover:text-black">
                Contact
              </Link>
            </div>

            {/* Sign In Button - Redirects to Dashboard */}
            <div className="flex items-center gap-2 sm:gap-0">
              <Link
                href="/dashboard"
                className="hidden md:inline-flex px-4 sm:px-5 py-1.5 sm:py-2 text-sm sm:text-base bg-black text-white rounded-full transition-all hover:bg-black/90 hover:scale-105"
              >
                Sign In
              </Link>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-black"
                aria-label="Toggle menu"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-6 space-y-1 border-t border-black/5 mt-2">
              {/* Mobile Services Dropdown */}
              <div>
                <button
                  onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
                  className="flex items-center justify-between w-full px-5 py-3.5 text-base text-black/70 hover:text-black hover:bg-black/5 rounded-xl transition-all"
                >
                  <span>Our Services</span>
                  <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${mobileServicesOpen ? 'rotate-180' : ''}`} />
                </button>

                {mobileServicesOpen && (
                  <div className="pl-5 pb-2 space-y-1">
                    <Link
                      href="/services"
                      className="flex items-center gap-3 px-5 py-3 text-sm text-black hover:bg-black/5 rounded-xl transition-all font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Video className="w-4 h-4" />
                      All Services
                    </Link>
                    {services.map((service) => (
                      <Link
                        key={service.href}
                        href={service.href}
                        className="flex items-center gap-3 px-5 py-2.5 text-sm text-black/70 hover:text-black hover:bg-black/5 rounded-xl transition-all"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <service.icon className="w-4 h-4" />
                        {service.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link
                href="/shows"
                className="block px-5 py-3.5 text-base text-black/70 hover:text-black hover:bg-black/5 rounded-xl transition-all active:bg-black/10"
                onClick={() => setMobileMenuOpen(false)}
              >
                Original Shows
              </Link>
              <Link
                href="/work"
                className="block px-5 py-3.5 text-base text-black/70 hover:text-black hover:bg-black/5 rounded-xl transition-all active:bg-black/10"
                onClick={() => setMobileMenuOpen(false)}
              >
                Results
              </Link>
              <Link
                href="/about"
                className="block px-5 py-3.5 text-base text-black/70 hover:text-black hover:bg-black/5 rounded-xl transition-all active:bg-black/10"
                onClick={() => setMobileMenuOpen(false)}
              >
                About Us
              </Link>
              <Link
                href="/contact"
                className="block px-5 py-3.5 text-base text-black/70 hover:text-black hover:bg-black/5 rounded-xl transition-all active:bg-black/10"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
              </Link>
              <Link
                href="/dashboard"
                className="block w-full mt-6 px-5 py-3.5 text-base bg-black text-white text-center rounded-full hover:bg-black/90 active:scale-95 transition-all font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}