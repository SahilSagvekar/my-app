import React from 'react';
import Link from 'next/link';
import { Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';
import logo from '@/../public/assets/about/E8FIRELOGO.jpg';
import Image from 'next/image';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-black/5 py-12 px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Company Name */}
          <div className="flex-shrink-0">
            {/* <Image src={logo} alt="E8 Productions" className="h-8 w-auto" /> */}
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/services" className="text-black/60 transition-colors hover:text-black text-sm">
              Our Services
            </Link>
            <Link href="/shows" className="text-black/60 transition-colors hover:text-black text-sm">
              Original Shows
            </Link>
            <Link href="/work" className="text-black/60 transition-colors hover:text-black text-sm">
              Results
            </Link>
            <Link href="/about" className="text-black/60 transition-colors hover:text-black text-sm">
              About Us
            </Link>
            <Link href="/contact" className="text-black/60 transition-colors hover:text-black text-sm">
              Contact
            </Link>
            <a href="#privacy" className="text-black/60 transition-colors hover:text-black text-sm">
              Privacy
            </a>
            <a href="#terms" className="text-black/60 transition-colors hover:text-black text-sm">
              Terms
            </a>
          </div>

          {/* Social Icons */}
          <div className="flex items-center gap-4">
            <a 
              href="#" 
              className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center transition-all hover:bg-black hover:text-white"
              aria-label="Twitter"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a 
              href="#" 
              className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center transition-all hover:bg-black hover:text-white"
              aria-label="Instagram"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a 
              href="#" 
              className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center transition-all hover:bg-black hover:text-white"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </a>
            <a 
              href="#" 
              className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center transition-all hover:bg-black hover:text-white"
              aria-label="YouTube"
            >
              <Youtube className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-black/5 text-center">
          <p className="text-black/40 text-sm">
            © {currentYear} E8 Productions. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}