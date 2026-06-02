"use client";

import React from "react";
import Link from "next/link";

export default function CookiePolicy() {
  const lastUpdated = "June 2, 2026";
  const companyName = "E8 Productions";
  const contactEmail = "privacy@e8productions.com";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white hover:text-white/80 transition-colors">
            {companyName}
          </Link>
          <nav className="flex items-center gap-6 text-sm text-white/60">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/legal" className="hover:text-white transition-colors">Legal</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/60 text-xs font-medium mb-6">
            Last updated: {lastUpdated}
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            Cookie Policy
          </h1>
          <p className="text-white/60 text-base md:text-lg max-w-2xl leading-relaxed">
            This policy explains what cookies are, which ones we set, why we set them,
            and how you can control them.
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="space-y-12 text-gray-400 leading-relaxed">

          {/* 1 */}
          <section className="pb-12 border-b border-white/10">
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-6">1. What Are Cookies?</h2>
            <p className="mb-4">
              Cookies are small text files placed on your device when you visit a website. They are widely
              used to make websites work, improve efficiency, and provide information to site owners.
              Cookies cannot run programs or deliver viruses to your device.
            </p>
            <p>
              Similar technologies include local storage, session storage, and pixels — we refer to all
              of these collectively as &ldquo;cookies&rdquo; in this policy.
            </p>
          </section>

          {/* 2 */}
          <section className="pb-12 border-b border-white/10">
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-6">2. Cookies We Set</h2>
            <p className="mb-6">
              The following table lists every cookie or storage key set by {companyName}, its purpose,
              and how long it persists.
            </p>

            <h3 className="text-white font-semibold text-lg mb-4">Essential Cookies</h3>
            <p className="mb-4">
              These are required for the service to function. They cannot be disabled without breaking
              core features like login and security.
            </p>
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-sm border border-white/10 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-white/5 text-white">
                    <th className="text-left px-4 py-3 font-medium border-b border-white/10">Name</th>
                    <th className="text-left px-4 py-3 font-medium border-b border-white/10">Purpose</th>
                    <th className="text-left px-4 py-3 font-medium border-b border-white/10">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="px-4 py-3 font-mono text-white/70">next-auth.session-token</td>
                    <td className="px-4 py-3">Authenticates your session after login. Required to stay signed in.</td>
                    <td className="px-4 py-3 whitespace-nowrap">Session / 30 days</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-white/70">next-auth.csrf-token</td>
                    <td className="px-4 py-3">Protects against cross-site request forgery attacks.</td>
                    <td className="px-4 py-3 whitespace-nowrap">Session</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-white/70">next-auth.callback-url</td>
                    <td className="px-4 py-3">Remembers the page you were trying to reach before login.</td>
                    <td className="px-4 py-3 whitespace-nowrap">Session</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-white/70">__Secure-next-auth.*</td>
                    <td className="px-4 py-3">Secure variants of the above on HTTPS connections.</td>
                    <td className="px-4 py-3 whitespace-nowrap">Session / 30 days</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-white font-semibold text-lg mb-4">Functional Cookies</h3>
            <p className="mb-4">
              These remember your preferences and improve your experience.
            </p>
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-sm border border-white/10 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-white/5 text-white">
                    <th className="text-left px-4 py-3 font-medium border-b border-white/10">Name</th>
                    <th className="text-left px-4 py-3 font-medium border-b border-white/10">Purpose</th>
                    <th className="text-left px-4 py-3 font-medium border-b border-white/10">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="px-4 py-3 font-mono text-white/70">e8_cookie_consent</td>
                    <td className="px-4 py-3">Stores your cookie consent choice (accepted / declined) so we don&apos;t ask again.</td>
                    <td className="px-4 py-3 whitespace-nowrap">1 year (localStorage)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-white font-semibold text-lg mb-4">Analytics Cookies</h3>
            <p className="mb-4">
              Set only if you accept cookies. These help us understand how visitors use the site.
              No personally identifiable information is stored.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-white/10 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-white/5 text-white">
                    <th className="text-left px-4 py-3 font-medium border-b border-white/10">Name</th>
                    <th className="text-left px-4 py-3 font-medium border-b border-white/10">Provider</th>
                    <th className="text-left px-4 py-3 font-medium border-b border-white/10">Purpose</th>
                    <th className="text-left px-4 py-3 font-medium border-b border-white/10">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="px-4 py-3 font-mono text-white/70">_ga</td>
                    <td className="px-4 py-3">Google Analytics</td>
                    <td className="px-4 py-3">Distinguishes unique users by assigning a randomly generated client identifier.</td>
                    <td className="px-4 py-3 whitespace-nowrap">2 years</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-white/70">_ga_E7HJLKVEPQ</td>
                    <td className="px-4 py-3">Google Analytics</td>
                    <td className="px-4 py-3">Persists session state for Google Analytics 4 (GA4).</td>
                    <td className="px-4 py-3 whitespace-nowrap">2 years</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-white/70">_gid</td>
                    <td className="px-4 py-3">Google Analytics</td>
                    <td className="px-4 py-3">Distinguishes users. Used to throttle request rate.</td>
                    <td className="px-4 py-3 whitespace-nowrap">24 hours</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 3 */}
          <section className="pb-12 border-b border-white/10">
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-6">3. Third-Party Cookies</h2>
            <p className="mb-4">
              Some pages embed content or functionality from third parties who may set their own cookies.
              We do not control these cookies. Current third parties include:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <span className="text-white">Google Analytics</span> — web analytics.{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                  Google Privacy Policy
                </a>
              </li>
              <li>
                <span className="text-white">Calendly</span> — scheduling embeds on certain pages.{" "}
                <a href="https://calendly.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                  Calendly Privacy Policy
                </a>
              </li>
            </ul>
          </section>

          {/* 4 */}
          <section className="pb-12 border-b border-white/10">
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-6">4. How to Control Cookies</h2>

            <h3 className="text-white font-semibold mb-3">Via our consent banner</h3>
            <p className="mb-6">
              When you first visit the site, a banner asks for your consent to analytics cookies.
              You can change your choice at any time by clearing your browser&apos;s localStorage
              (key: <code className="font-mono text-white/70 bg-white/5 px-1 rounded">e8_cookie_consent</code>) and
              refreshing the page — the banner will reappear.
            </p>

            <h3 className="text-white font-semibold mb-3">Via your browser</h3>
            <p className="mb-4">All major browsers let you view, block, and delete cookies:</p>
            <ul className="list-disc pl-6 space-y-2 mb-6">
              <li>
                <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">Google Chrome</a>
              </li>
              <li>
                <a href="https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">Mozilla Firefox</a>
              </li>
              <li>
                <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">Apple Safari</a>
              </li>
              <li>
                <a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">Microsoft Edge</a>
              </li>
            </ul>
            <p className="mb-6">Note: blocking essential cookies will prevent login to the client portal.</p>

            <h3 className="text-white font-semibold mb-3">Opt out of Google Analytics</h3>
            <p>
              You can opt out across all websites using the{" "}
              <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                Google Analytics Opt-out Browser Add-on
              </a>.
            </p>
          </section>

          {/* 5 */}
          <section className="pb-12 border-b border-white/10">
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-6">5. Updates to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time. The &ldquo;Last updated&rdquo; date at
              the top of this page reflects the most recent revision. Continued use of the site after
              changes constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-6">6. Contact Us</h2>
            <p>
              Questions about this Cookie Policy? Email us at{" "}
              <a href={`mailto:${contactEmail}`} className="text-blue-400 hover:text-blue-300 transition-colors">
                {contactEmail}
              </a>.
            </p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-sm">
              © {new Date().getFullYear()} {companyName}. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="text-white/60 hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="text-white/60 hover:text-white transition-colors">Terms</Link>
              <Link href="/privacy#do-not-sell" className="text-white/60 hover:text-white transition-colors">Do Not Sell My Data</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}