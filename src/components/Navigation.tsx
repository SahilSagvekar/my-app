import React from 'react';
import Link from 'next/link';
import logo from '@/../public/assets/575743c7bd0af4189cb4a7349ecfe505c6699243.png';
import Image from 'next/image';

export function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/" className="text-black transition-opacity hover:opacity-60">
                <Image src={logo} alt="E8 Productions" className="h-8 w-auto" />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8 font-bold">
              <Link href="/services" className="text-black/70 transition-colors hover:text-black">
                Our Services
              </Link>
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

            {/* Sign In Button */}
            <div className="flex items-center">
              <button className="hidden md:inline-flex px-5 py-2 bg-black text-white rounded-full transition-all hover:bg-black/90 hover:scale-105">
                Sign In
              </button>
              {/* Mobile menu button */}
              <button className="md:hidden p-2 text-black">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}