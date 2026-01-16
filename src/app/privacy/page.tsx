"use client";

import React from "react";
import Link from "next/link";

const PrivacyPolicy = () => {
  const lastUpdated = "January 16, 2025";
  const companyName = "E8 Productions";
  const companyAddress = "Fort Lauderdale, Florida, United States";
  const contactEmail = "privacy@e8productions.com"; // Update this
  const websiteUrl = "https://e8productions.com";

  const sections = [
    {
      title: "1. Introduction",
      content: (
        <>
          <p>
            {companyName} (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is
            committed to protecting your privacy. This Privacy Policy explains
            how we collect, use, disclose, and safeguard your information when
            you use our website at{" "}
            <a
              href={websiteUrl}
              className="text-blue-400 hover:text-blue-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {websiteUrl}
            </a>{" "}
            and our production workflow management application (collectively,
            the &quot;Service&quot;).
          </p>
          <p>
            Please read this Privacy Policy carefully. By accessing or using our
            Service, you acknowledge that you have read, understood, and agree
            to be bound by this Privacy Policy. If you do not agree with the
            terms of this Privacy Policy, please do not access or use the
            Service.
          </p>
        </>
      ),
    },
    {
      title: "2. Information We Collect",
      content: (
        <>
          <p>
            We collect information that you provide directly to us, information
            we obtain automatically when you use our Service, and information
            from third-party sources.
          </p>

          <h3 className="text-white font-semibold mt-6 mb-3">
            2.1 Information You Provide Directly
          </h3>
          <ul>
            <li>
              <strong className="text-white">Account Information:</strong> When
              you create an account, we collect your name, email address, phone
              number, job title, and password.
            </li>
            <li>
              <strong className="text-white">Profile Information:</strong>{" "}
              Information you add to your profile, such as a profile photo,
              company name, and role preferences.
            </li>
            <li>
              <strong className="text-white">Content and Files:</strong> Files,
              documents, videos, images, and other content you upload to the
              Service.
            </li>
            <li>
              <strong className="text-white">Communications:</strong> Information
              you provide when you contact us for support, send us messages, or
              communicate with other users through the Service.
            </li>
            <li>
              <strong className="text-white">Payment Information:</strong> If you
              make payments through our Service, we collect billing information
              such as billing address and payment method details. Payment
              processing is handled by third-party payment processors.
            </li>
          </ul>

          <h3 className="text-white font-semibold mt-6 mb-3">
            2.2 Information Collected Automatically
          </h3>
          <ul>
            <li>
              <strong className="text-white">Usage Data:</strong> Information
              about how you use the Service, including features accessed, pages
              viewed, actions taken, and time spent on the Service.
            </li>
            <li>
              <strong className="text-white">Device Information:</strong>{" "}
              Information about the device you use to access the Service,
              including device type, operating system, browser type, and unique
              device identifiers.
            </li>
            <li>
              <strong className="text-white">Log Data:</strong> Server logs that
              record information such as your IP address, access times, and
              referring URLs.
            </li>
            <li>
              <strong className="text-white">
                Cookies and Similar Technologies:
              </strong>{" "}
              We use cookies, pixels, and similar technologies to collect
              information about your browsing activities. See Section 7 for more
              details.
            </li>
          </ul>

          <h3 className="text-white font-semibold mt-6 mb-3">
            2.3 Information from Third Parties
          </h3>
          <ul>
            <li>
              <strong className="text-white">Third-Party Services:</strong> If
              you connect third-party services to your account, we may receive
              information from those services as permitted by your settings.
            </li>
            <li>
              <strong className="text-white">Business Partners:</strong> We may
              receive information about you from our business partners, such as
              clients who add you to their projects.
            </li>
          </ul>
        </>
      ),
    },
    {
      title: "3. How We Use Your Information",
      content: (
        <>
          <p>We use the information we collect for the following purposes:</p>
          <ul>
            <li>
              <strong className="text-white">Provide and Maintain the Service:</strong>{" "}
              To operate, maintain, and improve the Service, including
              processing transactions and managing your account.
            </li>
            <li>
              <strong className="text-white">Communication:</strong> To send you
              technical notices, updates, security alerts, support messages, and
              administrative communications.
            </li>
            <li>
              <strong className="text-white">Personalization:</strong> To
              personalize your experience and deliver content and features
              relevant to your role and preferences.
            </li>
            <li>
              <strong className="text-white">Analytics:</strong> To analyze usage
              patterns, monitor trends, and improve the Service&apos;s
              functionality and user experience.
            </li>
            <li>
              <strong className="text-white">Security:</strong> To detect,
              prevent, and address fraud, abuse, security risks, and technical
              issues.
            </li>
            <li>
              <strong className="text-white">Legal Compliance:</strong> To comply
              with applicable laws, regulations, and legal processes.
            </li>
            <li>
              <strong className="text-white">Marketing:</strong> With your
              consent, to send you promotional communications about our products
              and services. You can opt out at any time.
            </li>
          </ul>
        </>
      ),
    },
    {
      title: "4. How We Share Your Information",
      content: (
        <>
          <p>
            We do not sell your personal information. We may share your
            information in the following circumstances:
          </p>
          <ul>
            <li>
              <strong className="text-white">With Your Consent:</strong> We may
              share information when you direct us to do so or provide consent.
            </li>
            <li>
              <strong className="text-white">Service Providers:</strong> We share
              information with third-party vendors, consultants, and service
              providers who perform services on our behalf, such as hosting,
              analytics, customer support, and payment processing.
            </li>
            <li>
              <strong className="text-white">Team Members and Clients:</strong>{" "}
              Information may be shared with other users within your
              organization or project as necessary for collaboration through the
              Service.
            </li>
            <li>
              <strong className="text-white">Business Transfers:</strong> If we
              are involved in a merger, acquisition, or sale of assets, your
              information may be transferred as part of that transaction.
            </li>
            <li>
              <strong className="text-white">Legal Requirements:</strong> We may
              disclose information if required by law, regulation, legal
              process, or governmental request, or to protect the rights,
              property, or safety of {companyName}, our users, or others.
            </li>
            <li>
              <strong className="text-white">Aggregated or De-identified Data:</strong>{" "}
              We may share aggregated or de-identified information that cannot
              reasonably be used to identify you.
            </li>
          </ul>
        </>
      ),
    },
    {
      title: "5. Data Retention",
      content: (
        <>
          <p>
            We retain your personal information for as long as necessary to
            fulfill the purposes for which it was collected, including to
            satisfy legal, accounting, or reporting requirements.
          </p>
          <p>
            The retention period may vary depending on the context of our
            relationship with you and the type of information. When determining
            retention periods, we consider:
          </p>
          <ul>
            <li>The nature and sensitivity of the information</li>
            <li>The purposes for which we process the information</li>
            <li>Applicable legal requirements</li>
            <li>
              Whether the purpose of processing can be achieved by other means
            </li>
          </ul>
          <p>
            When your account is terminated, we will delete or anonymize your
            personal information within a reasonable timeframe, except where we
            are required to retain it for legal or legitimate business purposes.
          </p>
        </>
      ),
    },
    {
      title: "6. Data Security",
      content: (
        <>
          <p>
            We implement appropriate technical and organizational security
            measures designed to protect your personal information against
            unauthorized access, alteration, disclosure, or destruction. These
            measures include:
          </p>
          <ul>
            <li>Encryption of data in transit and at rest</li>
            <li>Regular security assessments and audits</li>
            <li>Access controls and authentication mechanisms</li>
            <li>Employee training on data protection practices</li>
            <li>Incident response procedures</li>
          </ul>
          <p>
            However, no method of transmission over the Internet or electronic
            storage is 100% secure. While we strive to use commercially
            acceptable means to protect your personal information, we cannot
            guarantee its absolute security.
          </p>
        </>
      ),
    },
    {
      title: "7. Cookies and Tracking Technologies",
      content: (
        <>
          <p>
            We use cookies and similar tracking technologies to collect and
            store information about your interactions with our Service.
          </p>

          <h3 className="text-white font-semibold mt-6 mb-3">
            Types of Cookies We Use
          </h3>
          <ul>
            <li>
              <strong className="text-white">Essential Cookies:</strong> Required
              for the Service to function properly, including authentication and
              security cookies.
            </li>
            <li>
              <strong className="text-white">Functional Cookies:</strong> Enable
              personalized features and remember your preferences.
            </li>
            <li>
              <strong className="text-white">Analytics Cookies:</strong> Help us
              understand how users interact with the Service so we can improve
              it.
            </li>
            <li>
              <strong className="text-white">Marketing Cookies:</strong> Used to
              deliver relevant advertisements and track campaign effectiveness.
            </li>
          </ul>

          <h3 className="text-white font-semibold mt-6 mb-3">
            Managing Cookies
          </h3>
          <p>
            Most web browsers allow you to control cookies through their
            settings. You can set your browser to refuse all or some cookies, or
            to alert you when cookies are being sent. However, if you disable or
            refuse cookies, some parts of the Service may become inaccessible or
            not function properly.
          </p>
        </>
      ),
    },
    {
      title: "8. Your Privacy Rights",
      content: (
        <>
          <p>
            Depending on your location, you may have certain rights regarding
            your personal information:
          </p>
          <ul>
            <li>
              <strong className="text-white">Access:</strong> The right to
              request access to the personal information we hold about you.
            </li>
            <li>
              <strong className="text-white">Correction:</strong> The right to
              request correction of inaccurate or incomplete personal
              information.
            </li>
            <li>
              <strong className="text-white">Deletion:</strong> The right to
              request deletion of your personal information, subject to certain
              exceptions.
            </li>
            <li>
              <strong className="text-white">Portability:</strong> The right to
              receive a copy of your personal information in a structured,
              commonly used, and machine-readable format.
            </li>
            <li>
              <strong className="text-white">Opt-Out:</strong> The right to
              opt-out of certain processing activities, such as marketing
              communications.
            </li>
            <li>
              <strong className="text-white">Restriction:</strong> The right to
              request restriction of processing of your personal information in
              certain circumstances.
            </li>
          </ul>
          <p>
            To exercise any of these rights, please contact us using the contact
            information provided below. We will respond to your request within
            the timeframe required by applicable law.
          </p>
        </>
      ),
    },
    {
      title: "9. California Privacy Rights",
      content: (
        <>
          <p>
            If you are a California resident, you have additional rights under
            the California Consumer Privacy Act (CCPA) and the California
            Privacy Rights Act (CPRA):
          </p>
          <ul>
            <li>
              <strong className="text-white">Right to Know:</strong> You have the
              right to request information about the categories and specific
              pieces of personal information we have collected about you.
            </li>
            <li>
              <strong className="text-white">Right to Delete:</strong> You have
              the right to request deletion of your personal information,
              subject to certain exceptions.
            </li>
            <li>
              <strong className="text-white">Right to Opt-Out of Sale:</strong>{" "}
              We do not sell personal information. However, you have the right
              to opt-out if we ever do.
            </li>
            <li>
              <strong className="text-white">Right to Non-Discrimination:</strong>{" "}
              We will not discriminate against you for exercising your privacy
              rights.
            </li>
          </ul>
          <p>
            To submit a request, please contact us using the information below.
            You may designate an authorized agent to make a request on your
            behalf.
          </p>
        </>
      ),
    },
    {
      title: "10. International Data Transfers",
      content: (
        <>
          <p>
            Your information may be transferred to and processed in countries
            other than the country in which you reside. These countries may have
            data protection laws that are different from the laws of your
            country.
          </p>
          <p>
            When we transfer personal information outside of your jurisdiction,
            we implement appropriate safeguards to ensure your information
            remains protected in accordance with this Privacy Policy and
            applicable law.
          </p>
        </>
      ),
    },
    {
      title: "11. Children&apos;s Privacy",
      content: (
        <p>
          Our Service is not directed to children under the age of 16, and we do
          not knowingly collect personal information from children under 16. If
          we learn that we have collected personal information from a child
          under 16, we will take steps to delete that information as quickly as
          possible. If you believe we may have collected information from a
          child under 16, please contact us.
        </p>
      ),
    },
    {
      title: "12. Third-Party Links and Services",
      content: (
        <p>
          Our Service may contain links to third-party websites, services, or
          applications that are not operated by us. This Privacy Policy does not
          apply to those third-party services, and we are not responsible for
          their privacy practices. We encourage you to review the privacy
          policies of any third-party services you access.
        </p>
      ),
    },
    {
      title: "13. Changes to This Privacy Policy",
      content: (
        <>
          <p>
            We may update this Privacy Policy from time to time to reflect
            changes in our practices or for other operational, legal, or
            regulatory reasons. We will notify you of any material changes by
            posting the new Privacy Policy on this page and updating the
            &quot;Last Updated&quot; date.
          </p>
          <p>
            We encourage you to review this Privacy Policy periodically to stay
            informed about how we are protecting your information. Your
            continued use of the Service after any changes constitutes your
            acceptance of the updated Privacy Policy.
          </p>
        </>
      ),
    },
    {
      title: "14. Contact Us",
      content: (
        <>
          <p>
            If you have any questions, concerns, or requests regarding this
            Privacy Policy or our privacy practices, please contact us at:
          </p>
          <div className="mt-4 p-6 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-white font-semibold text-lg">{companyName}</p>
            <p className="text-gray-400 mt-1">{companyAddress}</p>
            <p className="text-gray-400 mt-1">
              Email:{" "}
              <a
                href={`mailto:${contactEmail}`}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                {contactEmail}
              </a>
            </p>
            <p className="text-gray-400 mt-1">
              Website:{" "}
              <a
                href={websiteUrl}
                className="text-blue-400 hover:text-blue-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                {websiteUrl}
              </a>
            </p>
          </div>
          <p className="mt-4">
            We will respond to your inquiry within a reasonable timeframe and in
            accordance with applicable law.
          </p>
        </>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-black text-gray-300">
      {/* Navigation */}
      {/* <nav className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-white font-bold text-xl">
              E8 Productions
            </Link>
            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="/services"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Our Services
              </Link>
              <Link
                href="/shows"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Original Shows
              </Link>
              <Link
                href="/work"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Results
              </Link>
              <Link
                href="/about"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                About Us
              </Link>
              <Link
                href="/contact"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Contact
              </Link>
              <Link
                href="/dashboard"
                className="bg-white text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav> */}

      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-gray-500">Last Updated: {lastUpdated}</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="space-y-12">
          {sections.map((section, index) => (
            <section
              key={index}
              className="pb-12 border-b border-white/10 last:border-0"
            >
              <h2 className="text-xl md:text-2xl font-semibold text-white mb-6">
                {section.title}
              </h2>
              <div className="space-y-4 text-gray-400 leading-relaxed [&>p]:mb-4 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:space-y-2 [&>ul]:mb-4 [&>h3]:mt-6 [&>h3]:mb-3">
                {section.content}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <h3 className="text-white font-bold text-lg mb-4">
                E8 Productions
              </h3>
              <p className="text-gray-500 text-sm">
                Creating content that drives real results for businesses
                worldwide.
              </p>
            </div>

            {/* Services */}
            <div>
              <h4 className="text-white font-semibold mb-4">Services</h4>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/services"
                    className="text-gray-500 hover:text-white transition-colors text-sm"
                  >
                    Video Production
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services"
                    className="text-gray-500 hover:text-white transition-colors text-sm"
                  >
                    Social Media Management
                  </Link>
                </li>
                <li>
                  <Link
                    href="/services"
                    className="text-gray-500 hover:text-white transition-colors text-sm"
                  >
                    Content Strategy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/shows"
                    className="text-gray-500 hover:text-white transition-colors text-sm"
                  >
                    Original Shows
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/about"
                    className="text-gray-500 hover:text-white transition-colors text-sm"
                  >
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    href="/work"
                    className="text-gray-500 hover:text-white transition-colors text-sm"
                  >
                    Our Work
                  </Link>
                </li>
                <li>
                  <Link
                    href="/shows"
                    className="text-gray-500 hover:text-white transition-colors text-sm"
                  >
                    Original Shows
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="text-gray-500 hover:text-white transition-colors text-sm"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/dashboard"
                    className="text-gray-500 hover:text-white transition-colors text-sm"
                  >
                    Client Portal
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-white text-sm">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="text-gray-500 hover:text-white transition-colors text-sm"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    href="/support"
                    className="text-gray-500 hover:text-white transition-colors text-sm"
                  >
                    Support
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-600 text-sm">
              © {new Date().getFullYear()} E8 Productions. All rights reserved.
            </p>
            <div className="flex items-center space-x-6">
              <Link
                href="/privacy"
                className="text-gray-600 hover:text-white transition-colors text-sm"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-gray-600 hover:text-white transition-colors text-sm"
              >
                Terms
              </Link>
              <Link
                href="/cookies"
                className="text-gray-600 hover:text-white transition-colors text-sm"
              >
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;