"use client";

import React from "react";
import Link from "next/link";

const TermsOfService = () => {
  const lastUpdated = "March 31, 2026";
  const companyName = "E8 Productions";
  const companyAddress = "Fort Lauderdale, Florida, United States";
  const contactEmail = "legal@e8productions.com";
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
            these Terms. This includes users who access the Service through
            third-party authentication providers such as Google (Google Sign-In)
            or Meta (Facebook Login). If you do not agree to these Terms, you
            may not access or use the Service.
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
      title: "3a. Google Sign-In Authentication",
      content: (
        <>
          <p>
            The Service offers the option to authenticate using Google Sign-In
            (OAuth 2.0), provided by Google LLC. By choosing to sign in with
            Google, you authorize {companyName} to receive certain basic profile
            information from your Google Account, including your name and email
            address, solely for the purpose of account authentication and
            identification within the Service.
          </p>
          <p>
            Your use of Google Sign-In is subject to Google&apos;s{" "}
            <a
              href="https://policies.google.com/terms"
              className="text-blue-400 hover:text-blue-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms of Service
            </a>{" "}
            and Google&apos;s{" "}
            <a
              href="https://policies.google.com/privacy"
              className="text-blue-400 hover:text-blue-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
            . {companyName} does not receive or store your Google password. We
            will only use data obtained through Google Sign-In as described in
            our Privacy Policy and will not use it for any purpose beyond
            authenticating and managing your account.
          </p>
          <p>
            You may disconnect your Google account from the Service at any time
            by contacting us at{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              {contactEmail}
            </a>{" "}
            or by managing your connected applications through your Google
            Account settings at{" "}
            <a
              href="https://myaccount.google.com/permissions"
              className="text-blue-400 hover:text-blue-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://myaccount.google.com/permissions
            </a>
            .
          </p>
        </>
      ),
    },
    {
      title: "3b. Meta (Facebook) Login Authentication",
      content: (
        <>
          <p>
            The Service also offers the option to authenticate using Meta
            (Facebook) Login. By choosing to sign in with Meta, you authorize{" "}
            {companyName} to receive certain basic profile information from your
            Meta account, including your name, email address, profile photo, and
            a unique Meta User ID, solely for the purpose of account
            authentication and identification within the Service.
          </p>
          <p>
            Your use of Meta Login is subject to Meta&apos;s{" "}
            <a
              href="https://www.facebook.com/terms"
              className="text-blue-400 hover:text-blue-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms of Service
            </a>{" "}
            and Meta&apos;s{" "}
            <a
              href="https://www.facebook.com/privacy/policy"
              className="text-blue-400 hover:text-blue-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
            . {companyName} does not receive or store your Meta password. We
            will only use data obtained through Meta Login as described in our
            Privacy Policy and in compliance with Meta&apos;s Platform Terms and
            Developer Data Use Policy. We do not use Meta user data for
            advertising, profiling, or any secondary purpose.
          </p>
          <p>
            You may disconnect your Meta account from the Service at any time by
            contacting us at{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              {contactEmail}
            </a>{" "}
            or by managing your connected applications through your Facebook
            settings at{" "}
            <a
              href="https://www.facebook.com/settings?tab=applications"
              className="text-blue-400 hover:text-blue-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://www.facebook.com/settings?tab=applications
            </a>
            .
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
            <li>
              Use data obtained through third-party login integrations (Google,
              Meta) for any purpose beyond your authorized use of the Service
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
            The Service and its entire contents, features, and functionality are
            owned by {companyName}, its licensors, or other providers and are
            protected by United States and international intellectual property
            laws.
          </p>
          <p>
            <strong className="text-white">Client Content:</strong> Clients
            retain ownership of all content and intellectual property they
            upload to or create through the Service. By uploading content,
            clients grant {companyName} a limited license to use, process, and
            store such content solely for the purpose of providing the Service.
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
            Users may have access to confidential information through the
            Service, including production schedules, client information, project
            details, unreleased content, and business processes. You agree to:
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
            Your use of the Service is governed by our Privacy Policy, available
            at{" "}
            <a
              href="https://e8productions.com/privacy-policy"
              className="text-blue-400 hover:text-blue-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://e8productions.com/privacy-policy
            </a>
            . Please review it to understand how we collect, use, store, and
            disclose your personal information, including any data obtained
            through Google Sign-In or Meta Login.
          </p>
          <p>
            By using the Service, you consent to the collection and use of
            information as described in our Privacy Policy. Our Privacy Policy
            complies with Google&apos;s API Services User Data Policy and
            Meta&apos;s Platform Terms and Developer Data Use Policy.
          </p>
        </>
      ),
    },
    {
      title: "9. Data Security and Breach Notification",
      content: (
        <>
          <p>
            We implement commercially reasonable technical and organizational
            security measures to protect your data. In the event of a data
            security breach that affects your personal information, we will:
          </p>
          <ul>
            <li>Notify affected users as required by applicable law</li>
            <li>
              Notify relevant regulatory authorities where required
            </li>
            <li>
              Notify applicable platform providers (including Google and Meta)
              in accordance with their developer policies
            </li>
            <li>
              Begin remediation immediately upon discovery of the incident
            </li>
          </ul>
          <p>
            If you discover or suspect any security vulnerability or
            unauthorized access to your account, you must notify us immediately
            at{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              {contactEmail}
            </a>
            .
          </p>
        </>
      ),
    },
    {
      title: "10. Third-Party Services and Links",
      content: (
        <>
          <p>
            The Service integrates with or may contain links to third-party
            websites or services not owned or controlled by {companyName},
            including Google (Sign-In) and Meta (Facebook Login). We have no
            control over, and assume no responsibility for, the content, privacy
            policies, or practices of any third-party services. Your
            interactions with these services are governed by their own terms and
            privacy policies:
          </p>
          <ul>
            <li>
              Google:{" "}
              <a
                href="https://policies.google.com/terms"
                className="text-blue-400 hover:text-blue-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://policies.google.com/terms
              </a>
            </li>
            <li>
              Meta / Facebook:{" "}
              <a
                href="https://www.facebook.com/terms"
                className="text-blue-400 hover:text-blue-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://www.facebook.com/terms
              </a>
            </li>
          </ul>
          <p>
            You acknowledge and agree that {companyName} is not responsible or
            liable for any damage or loss caused by your use of any third-party
            services.
          </p>
        </>
      ),
    },
    {
      title: "11. Disclaimer of Warranties",
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
      title: "12. Limitation of Liability",
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
      title: "13. Indemnification",
      content: (
        <p>
          You agree to defend, indemnify, and hold harmless {companyName}, its
          affiliates, licensors, and service providers, and their respective
          officers, directors, employees, contractors, agents, successors, and
          assigns from and against any claims, liabilities, damages, judgments,
          awards, losses, costs, expenses, or fees (including reasonable
          attorneys&apos; fees) arising out of or relating to your violation of
          these Terms or your use of the Service, including any misuse of
          third-party authentication credentials or platform data.
        </p>
      ),
    },
    {
      title: "14. Termination",
      content: (
        <>
          <p>
            We may terminate or suspend your account and access to the Service
            immediately, without prior notice or liability, for any reason,
            including if you breach these Terms or violate any applicable
            third-party platform policy (including Meta&apos;s or Google&apos;s
            developer policies).
          </p>
          <p>
            Upon termination, your right to use the Service will cease
            immediately. We will delete or anonymize your personal data in
            accordance with our Privacy Policy and applicable platform policies.
            If you wish to terminate your account, contact us at{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              {contactEmail}
            </a>
            .
          </p>
          <p>
            All provisions of these Terms which by their nature should survive
            termination shall survive, including ownership provisions, warranty
            disclaimers, indemnification, and limitations of liability.
          </p>
        </>
      ),
    },
    {
      title: "15. Governing Law and Jurisdiction",
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
            Florida, in each case located in Broward County. You waive any
            objections to jurisdiction or venue in such courts.
          </p>
        </>
      ),
    },
    {
      title: "16. Changes to Terms of Service",
      content: (
        <p>
          We reserve the right, at our sole discretion, to modify or replace
          these Terms at any time. If a revision is material, we will provide
          at least 30 days&apos; notice prior to any new terms taking effect. By
          continuing to use the Service after revisions become effective, you
          agree to be bound by the updated terms.
        </p>
      ),
    },
    {
      title: "17. Severability",
      content: (
        <p>
          If any provision of these Terms is held to be unenforceable or
          invalid, it will be modified to accomplish its objectives to the
          greatest extent possible under applicable law, and the remaining
          provisions will continue in full force and effect.
        </p>
      ),
    },
    {
      title: "18. Entire Agreement",
      content: (
        <p>
          These Terms, together with our Privacy Policy and any other legal
          notices published on the Service, constitute the entire agreement
          between you and {companyName} concerning your use of the Service and
          supersede all prior agreements, representations, and warranties
          regarding the Service.
        </p>
      ),
    },
    {
      title: "19. Contact Information",
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