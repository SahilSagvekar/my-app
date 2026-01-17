"use client";

import React from "react";
import Link from "next/link";

const TermsOfService = () => {
  const lastUpdated = "January 16, 2025";
  const companyName = "E8 Productions";
  const companyAddress = "Fort Lauderdale, Florida, United States";
  const contactEmail = "legal@e8productions.com"; // Update this
  const websiteUrl = "https://e8productions.com";

  const sections = [
    {
      title: "1. Introduction and Acceptance of Terms",
      content: (
        <>
          <p>
            Welcome to {companyName}. These Terms of Service (&quot;Terms&quot;)
            govern your access to and use of the {companyName} platform,
            including our website at{" "}
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
            By accessing or using our Service, whether as an employee,
            contractor, client, or any other user, you agree to be bound by
            these Terms. If you do not agree to these Terms, you may not access
            or use the Service.
          </p>
        </>
      ),
    },
    {
      title: "2. Description of Service",
      content: (
        <p>
          {companyName} provides a production workflow management platform
          designed to facilitate project coordination, file management,
          scheduling, quality control, and communication between team members
          and clients. The Service includes features such as role-based
          dashboards, real-time notifications, file uploads, task management,
          and production tracking.
        </p>
      ),
    },
    {
      title: "3. User Accounts and Registration",
      content: (
        <>
          <p>
            To access certain features of the Service, you must register for an
            account. When creating an account, you agree to:
          </p>
          <ul>
            <li>
              Provide accurate, current, and complete information during
              registration
            </li>
            <li>
              Maintain and promptly update your account information to keep it
              accurate and complete
            </li>
            <li>
              Maintain the security and confidentiality of your login
              credentials
            </li>
            <li>
              Accept responsibility for all activities that occur under your
              account
            </li>
            <li>
              Notify us immediately of any unauthorized use of your account
            </li>
          </ul>
          <p>
            We reserve the right to suspend or terminate your account if any
            information provided proves to be inaccurate, false, or in violation
            of these Terms.
          </p>
        </>
      ),
    },
    {
      title: "4. User Roles and Access Levels",
      content: (
        <>
          <p>
            The Service operates on a role-based access system. Users are
            assigned specific roles (such as Admin, Manager, Editor, QC,
            Scheduler, Videographer, or Client) that determine their access
            permissions and capabilities within the platform. You agree to:
          </p>
          <ul>
            <li>
              Use the Service only within the scope of your assigned role and
              permissions
            </li>
            <li>
              Not attempt to access features or data beyond your authorized
              access level
            </li>
            <li>
              Not share your account credentials to allow unauthorized persons
              to access the Service
            </li>
            <li>
              Report any access-related issues or discrepancies to your
              administrator
            </li>
          </ul>
        </>
      ),
    },
    {
      title: "5. Acceptable Use Policy",
      content: (
        <>
          <p>
            You agree to use the Service only for lawful purposes and in
            accordance with these Terms. You agree NOT to:
          </p>
          <ul>
            <li>
              Use the Service in any way that violates any applicable federal,
              state, local, or international law or regulation
            </li>
            <li>
              Upload, transmit, or distribute any viruses, malware, or other
              harmful code
            </li>
            <li>
              Attempt to gain unauthorized access to any portion of the Service,
              other accounts, or computer systems
            </li>
            <li>
              Interfere with or disrupt the integrity or performance of the
              Service
            </li>
            <li>
              Use any automated means (bots, scrapers, etc.) to access the
              Service without our express written permission
            </li>
            <li>
              Reproduce, duplicate, copy, sell, or resell any portion of the
              Service
            </li>
            <li>
              Harass, abuse, or harm another person through your use of the
              Service
            </li>
            <li>
              Upload or share content that infringes on intellectual property
              rights of others
            </li>
          </ul>
        </>
      ),
    },
    {
      title: "6. Intellectual Property Rights",
      content: (
        <>
          <p>
            The Service and its entire contents, features, and functionality
            (including but not limited to all information, software, text,
            displays, images, video, and audio, and the design, selection, and
            arrangement thereof) are owned by {companyName}, its licensors, or
            other providers of such material and are protected by United States
            and international copyright, trademark, patent, trade secret, and
            other intellectual property or proprietary rights laws.
          </p>
          <p>
            <strong className="text-white">Client Content:</strong> Clients
            retain ownership of all content, materials, and intellectual
            property they upload to or create through the Service. By uploading
            content, clients grant {companyName} a limited license to use,
            process, and store such content solely for the purpose of providing
            the Service.
          </p>
          <p>
            <strong className="text-white">Work Product:</strong> Unless
            otherwise agreed in writing, all work product created by{" "}
            {companyName} employees or contractors using the Service shall be
            owned by {companyName} or its clients as specified in applicable
            service agreements.
          </p>
        </>
      ),
    },
    {
      title: "7. Confidentiality",
      content: (
        <>
          <p>
            Users acknowledge that they may have access to confidential
            information through the Service, including but not limited to
            production schedules, client information, project details,
            unreleased content, and business processes. You agree to:
          </p>
          <ul>
            <li>
              Maintain the confidentiality of all non-public information
              accessed through the Service
            </li>
            <li>
              Not disclose confidential information to any third party without
              proper authorization
            </li>
            <li>
              Use confidential information only for purposes related to your
              authorized use of the Service
            </li>
            <li>
              Return or destroy all confidential information upon termination of
              your access to the Service
            </li>
          </ul>
        </>
      ),
    },
    {
      title: "8. Privacy and Data Protection",
      content: (
        <>
          <p>
            Your use of the Service is also governed by our Privacy Policy.
            Please review our Privacy Policy to understand our practices
            regarding the collection, use, and disclosure of your personal
            information.
          </p>
          <p>
            By using the Service, you consent to the collection and use of
            information as described in our Privacy Policy.
          </p>
        </>
      ),
    },
    {
      title: "9. Third-Party Services and Links",
      content: (
        <p>
          The Service may contain links to third-party websites or services that
          are not owned or controlled by {companyName}. We have no control over,
          and assume no responsibility for, the content, privacy policies, or
          practices of any third-party websites or services. You acknowledge and
          agree that {companyName} shall not be responsible or liable for any
          damage or loss caused by or in connection with the use of any such
          third-party content, goods, or services.
        </p>
      ),
    },
    {
      title: "10. Disclaimer of Warranties",
      content: (
        <>
          <p className="uppercase text-sm">
            THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS
            AVAILABLE&quot; BASIS, WITHOUT ANY WARRANTIES OF ANY KIND, EITHER
            EXPRESS OR IMPLIED. NEITHER {companyName.toUpperCase()} NOR ANY
            PERSON ASSOCIATED WITH {companyName.toUpperCase()} MAKES ANY
            WARRANTY OR REPRESENTATION WITH RESPECT TO THE COMPLETENESS,
            SECURITY, RELIABILITY, QUALITY, ACCURACY, OR AVAILABILITY OF THE
            SERVICE.
          </p>
          <p className="uppercase text-sm">
            THE FOREGOING DOES NOT AFFECT ANY WARRANTIES THAT CANNOT BE EXCLUDED
            OR LIMITED UNDER APPLICABLE LAW.
          </p>
        </>
      ),
    },
    {
      title: "11. Limitation of Liability",
      content: (
        <p className="uppercase text-sm">
          TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL{" "}
          {companyName.toUpperCase()}, ITS AFFILIATES, OR THEIR LICENSORS,
          SERVICE PROVIDERS, EMPLOYEES, AGENTS, OFFICERS, OR DIRECTORS BE LIABLE
          FOR DAMAGES OF ANY KIND, UNDER ANY LEGAL THEORY, ARISING OUT OF OR IN
          CONNECTION WITH YOUR USE, OR INABILITY TO USE, THE SERVICE, INCLUDING
          ANY DIRECT, INDIRECT, SPECIAL, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES.
        </p>
      ),
    },
    {
      title: "12. Indemnification",
      content: (
        <p>
          You agree to defend, indemnify, and hold harmless {companyName}, its
          affiliates, licensors, and service providers, and its and their
          respective officers, directors, employees, contractors, agents,
          licensors, suppliers, successors, and assigns from and against any
          claims, liabilities, damages, judgments, awards, losses, costs,
          expenses, or fees (including reasonable attorneys&apos; fees) arising
          out of or relating to your violation of these Terms or your use of the
          Service.
        </p>
      ),
    },
    {
      title: "13. Termination",
      content: (
        <>
          <p>
            We may terminate or suspend your account and access to the Service
            immediately, without prior notice or liability, for any reason
            whatsoever, including without limitation if you breach these Terms.
          </p>
          <p>
            Upon termination, your right to use the Service will cease
            immediately. If you wish to terminate your account, you may contact
            your administrator or our support team.
          </p>
          <p>
            All provisions of these Terms which by their nature should survive
            termination shall survive termination, including, without
            limitation, ownership provisions, warranty disclaimers,
            indemnification, and limitations of liability.
          </p>
        </>
      ),
    },
    {
      title: "14. Governing Law and Jurisdiction",
      content: (
        <>
          <p>
            These Terms shall be governed by and construed in accordance with
            the laws of the State of Florida, United States, without regard to
            its conflict of law provisions.
          </p>
          <p>
            Any legal suit, action, or proceeding arising out of or related to
            these Terms or the Service shall be instituted exclusively in the
            federal courts of the United States or the courts of the State of
            Florida, in each case located in Broward County. You waive any and
            all objections to the exercise of jurisdiction over you by such
            courts and to venue in such courts.
          </p>
        </>
      ),
    },
    {
      title: "15. Changes to Terms of Service",
      content: (
        <>
          <p>
            We reserve the right, at our sole discretion, to modify or replace
            these Terms at any time. If a revision is material, we will provide
            at least 30 days&apos; notice prior to any new terms taking effect.
            What constitutes a material change will be determined at our sole
            discretion.
          </p>
          <p>
            By continuing to access or use our Service after those revisions
            become effective, you agree to be bound by the revised terms. If you
            do not agree to the new terms, please stop using the Service.
          </p>
        </>
      ),
    },
    {
      title: "16. Severability",
      content: (
        <p>
          If any provision of these Terms is held to be unenforceable or
          invalid, such provision will be changed and interpreted to accomplish
          the objectives of such provision to the greatest extent possible under
          applicable law, and the remaining provisions will continue in full
          force and effect.
        </p>
      ),
    },
    {
      title: "17. Entire Agreement",
      content: (
        <p>
          These Terms, together with our Privacy Policy and any other legal
          notices published by us on the Service, constitute the entire
          agreement between you and {companyName} concerning your use of the
          Service and supersede all prior and contemporaneous understandings,
          agreements, representations, and warranties, both written and oral,
          regarding the Service.
        </p>
      ),
    },
    {
      title: "18. Contact Information",
      content: (
        <>
          <p>
            If you have any questions about these Terms of Service, please
            contact us at:
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
            Terms of Service
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
              <div className="space-y-4 text-gray-400 leading-relaxed [&>p]:mb-4 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:space-y-2 [&>ul]:mb-4">
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
                  <Link
                    href="/privacy"
                    className="text-gray-500 hover:text-white transition-colors text-sm"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="text-white text-sm"
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

export default TermsOfService;