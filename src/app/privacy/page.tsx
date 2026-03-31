"use client";

import React from "react";
import Link from "next/link";

const PrivacyPolicy = () => {
  const lastUpdated = "March 31, 2026";
  const companyName = "E8 Productions";
  const companyAddress = "Fort Lauderdale, Florida, United States";
  const contactEmail = "privacy@e8productions.com";
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
            the &quot;Service&quot;). This Policy applies to all users of the
            Service, including those who access it via third-party
            authentication providers such as Google or Meta (Facebook).
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
            from third-party sources such as Google or Meta when you choose to
            sign in using those platforms.
          </p>

          <h3 className="text-white font-semibold mt-6 mb-3">
            2.1 Information You Provide Directly
          </h3>
          <ul>
            <li>
              <strong className="text-white">Account Information:</strong> Your
              name, email address, phone number, job title, and password when
              you create an account.
            </li>
            <li>
              <strong className="text-white">Profile Information:</strong>{" "}
              Profile photo, company name, and role preferences you add to your
              profile.
            </li>
            <li>
              <strong className="text-white">Content and Files:</strong> Files,
              documents, videos, images, and other content you upload to the
              Service.
            </li>
            <li>
              <strong className="text-white">Communications:</strong> Messages,
              support requests, and other communications you send through or
              about the Service.
            </li>
            <li>
              <strong className="text-white">Payment Information:</strong>{" "}
              Billing address and payment method details if you make payments.
              Payment processing is handled by third-party processors.
            </li>
          </ul>

          <h3 className="text-white font-semibold mt-6 mb-3">
            2.2 Information Collected Automatically
          </h3>
          <p>
            When you use the Service, we automatically collect certain technical
            data, including:
          </p>
          <ul>
            <li>
              <strong className="text-white">Usage Data:</strong> Features
              accessed, pages viewed, actions taken, and time spent on the
              Service.
            </li>
            <li>
              <strong className="text-white">Device Information:</strong> Device
              type, operating system, browser type, and unique device
              identifiers.
            </li>
            <li>
              <strong className="text-white">Log Data:</strong> IP address,
              access times, and referring URLs recorded in server logs.
            </li>
            <li>
              <strong className="text-white">
                Cookies and Similar Technologies:
              </strong>{" "}
              Browsing activity data collected via cookies and pixels. See
              Section 7 for details.
            </li>
          </ul>

          <h3 className="text-white font-semibold mt-6 mb-3">
            2.3 Information from Google Sign-In (OAuth 2.0)
          </h3>
          <p>
            If you choose to register or log in using Google Sign-In, we
            receive the following information from your Google Account via
            Google&apos;s OAuth 2.0 service:
          </p>
          <ul>
            <li>Your name</li>
            <li>Your email address</li>
            <li>
              Your Google profile photo (if available and permitted by your
              Google account settings)
            </li>
          </ul>
          <p>
            We do not receive or store your Google password. Information
            received from Google is used solely to create and authenticate your
            account on the Service. We do not use this data for advertising,
            profiling, or any purpose beyond providing and improving your
            account experience.
          </p>
          <p>
            Our use of information received from Google APIs complies with the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="text-blue-400 hover:text-blue-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. We do not transfer your
            Google data to third parties except as strictly necessary to provide
            the Service, and we do not use it for any secondary purposes.
          </p>

          <h3 className="text-white font-semibold mt-6 mb-3">
            2.4 Information from Meta (Facebook Login)
          </h3>
          <p>
            If you choose to register or log in using Meta (Facebook) Login, we
            receive the following information from your Meta account, subject to
            your Meta privacy settings and the permissions you grant:
          </p>
          <ul>
            <li>Your name</li>
            <li>Your email address</li>
            <li>Your Meta profile photo (if permitted)</li>
            <li>A unique Meta user identifier (User ID)</li>
          </ul>
          <p>
            We do not receive your Meta password. Information received from Meta
            is used solely to create and authenticate your account on the
            Service and to provide you with the features you have requested. We
            do not use this data for advertising, profiling, or any purpose
            unrelated to operating the Service.
          </p>
          <p>
            Our use of data received via Meta Login complies with{" "}
            <a
              href="https://developers.meta.com/horizon/policy/data-use/"
              className="text-blue-400 hover:text-blue-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Meta&apos;s Platform Terms and Developer Data Use Policy
            </a>
            . We do not sell, transfer, or use Meta user data in any way
            inconsistent with those policies or this Privacy Policy.
          </p>

          <h3 className="text-white font-semibold mt-6 mb-3">
            2.5 Information from Other Third Parties
          </h3>
          <ul>
            <li>
              <strong className="text-white">Third-Party Integrations:</strong>{" "}
              If you connect other third-party services to your account, we may
              receive information as permitted by your settings on those
              platforms.
            </li>
            <li>
              <strong className="text-white">Business Partners:</strong> Clients
              or partner organizations who add you to their projects within the
              Service.
            </li>
          </ul>
        </>
      ),
    },
    {
      title: "3. How We Use Your Information",
      content: (
        <>
          <p>
            We use the information we collect only for the purposes described in
            this Privacy Policy:
          </p>
          <ul>
            <li>
              <strong className="text-white">
                Provide and Maintain the Service:
              </strong>{" "}
              To operate, maintain, and improve the Service, process
              transactions, and manage your account.
            </li>
            <li>
              <strong className="text-white">Authentication:</strong> To verify
              your identity when you sign in, including via Google Sign-In or
              Meta Login, and to manage your account access securely.
            </li>
            <li>
              <strong className="text-white">Communication:</strong> To send
              technical notices, updates, security alerts, support messages, and
              administrative communications.
            </li>
            <li>
              <strong className="text-white">Personalization:</strong> To
              personalize your experience and deliver content relevant to your
              role and preferences.
            </li>
            <li>
              <strong className="text-white">Analytics:</strong> To analyze
              usage patterns, monitor trends, and improve the Service&apos;s
              functionality.
            </li>
            <li>
              <strong className="text-white">Security:</strong> To detect,
              prevent, and address fraud, abuse, security risks, and technical
              issues.
            </li>
            <li>
              <strong className="text-white">Legal Compliance:</strong> To
              comply with applicable laws, regulations, and legal processes.
            </li>
            <li>
              <strong className="text-white">Marketing:</strong> With your
              explicit consent, to send promotional communications. You may opt
              out at any time.
            </li>
          </ul>
          <p>
            Data received from Google Sign-In or Meta Login is used exclusively
            for authentication and account management. It is never used for
            marketing, advertising, or any purpose beyond what is necessary to
            operate your account on the Service.
          </p>
        </>
      ),
    },
    {
      title: "4. How We Share Your Information",
      content: (
        <>
          <p>
            We do not sell your personal information, including any data
            obtained through Google Sign-In or Meta Login. We may share your
            information only in the following limited circumstances:
          </p>
          <ul>
            <li>
              <strong className="text-white">With Your Consent:</strong> When
              you explicitly direct us to share information or provide consent.
            </li>
            <li>
              <strong className="text-white">Service Providers:</strong> With
              trusted third-party vendors who perform services on our behalf
              (hosting, analytics, customer support, payment processing). These
              providers are contractually required to use your data only as
              directed by us and consistent with this Privacy Policy.
            </li>
            <li>
              <strong className="text-white">Team Members and Clients:</strong>{" "}
              With other users within your organization or project as necessary
              for collaboration through the Service.
            </li>
            <li>
              <strong className="text-white">Business Transfers:</strong> In
              connection with a merger, acquisition, or sale of assets, subject
              to the same privacy protections in this Policy.
            </li>
            <li>
              <strong className="text-white">Legal Requirements:</strong> When
              required by law, legal process, or government request, or to
              protect the rights, property, or safety of {companyName}, our
              users, or others.
            </li>
            <li>
              <strong className="text-white">
                Aggregated or De-identified Data:
              </strong>{" "}
              Aggregated or de-identified information that cannot reasonably
              identify you.
            </li>
          </ul>
          <p>
            We do not share Google or Meta user data with third parties for
            advertising, profiling, or any purpose unrelated to the direct
            operation of the Service.
          </p>
        </>
      ),
    },
    {
      title: "5. Data Retention and Deletion",
      content: (
        <>
          <p>
            We retain your personal information only for as long as necessary to
            fulfill the purposes described in this Privacy Policy, including
            legal, accounting, or reporting requirements.
          </p>
          <p>
            We will delete or anonymize your personal information in the
            following circumstances:
          </p>
          <ul>
            <li>
              When you request deletion of your account or personal data (see
              Section 8 for how to submit a request).
            </li>
            <li>
              When your account is terminated, within a reasonable timeframe not
              to exceed 90 days, except where retention is required by law.
            </li>
            <li>
              When the data is no longer necessary to provide the Service or a
              specific feature.
            </li>
            <li>
              Upon request by the applicable third-party platform (e.g., Meta or
              Google) in accordance with their policies.
            </li>
          </ul>
          <p>
            Data received from Google Sign-In (name and email) and Meta Login
            (name, email, and User ID) will be deleted or anonymized upon
            account termination. We do not retain third-party authentication
            data beyond what is necessary for active account management.
          </p>
          <p>
            When determining retention periods, we consider the nature and
            sensitivity of the information, applicable legal requirements, and
            whether the purpose of processing can be achieved with less data.
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
            measures to protect your personal information against unauthorized
            access, alteration, disclosure, or destruction, including:
          </p>
          <ul>
            <li>Encryption of data in transit (TLS/SSL) and at rest</li>
            <li>Regular security assessments and vulnerability testing</li>
            <li>
              Role-based access controls and multi-factor authentication
            </li>
            <li>Employee training on data protection practices</li>
            <li>Incident response and breach notification procedures</li>
          </ul>
          <p>
            In the event of a data breach that affects your personal
            information, we will notify affected users and relevant authorities
            as required by applicable law and in accordance with our obligations
            under any platform policies (including Meta&apos;s Developer Data
            Use Policy).
          </p>
          <p>
            No method of transmission over the Internet or electronic storage is
            100% secure. While we use commercially acceptable security measures,
            we cannot guarantee absolute security.
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
              <strong className="text-white">Essential Cookies:</strong>{" "}
              Required for the Service to function, including authentication and
              security.
            </li>
            <li>
              <strong className="text-white">Functional Cookies:</strong> Enable
              personalized features and remember preferences.
            </li>
            <li>
              <strong className="text-white">Analytics Cookies:</strong> Help us
              understand how users interact with the Service.
            </li>
            <li>
              <strong className="text-white">Marketing Cookies:</strong> Used to
              deliver relevant content and track campaign effectiveness.
            </li>
          </ul>

          <h3 className="text-white font-semibold mt-6 mb-3">
            Managing Cookies
          </h3>
          <p>
            Most web browsers allow you to control cookies through their
            settings. Disabling certain cookies may affect Service
            functionality. You can also manage your preferences through your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              className="text-blue-400 hover:text-blue-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Account settings
            </a>{" "}
            or{" "}
            <a
              href="https://www.facebook.com/settings?tab=applications"
              className="text-blue-400 hover:text-blue-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Meta Account settings
            </a>{" "}
            for data associated with those platforms.
          </p>
        </>
      ),
    },
    {
      title: "8. Your Privacy Rights and Data Deletion Requests",
      content: (
        <>
          <p>
            Depending on your location, you may have the following rights
            regarding your personal information:
          </p>
          <ul>
            <li>
              <strong className="text-white">Access:</strong> Request access to
              the personal information we hold about you.
            </li>
            <li>
              <strong className="text-white">Correction:</strong> Request
              correction of inaccurate or incomplete information.
            </li>
            <li>
              <strong className="text-white">Deletion:</strong> Request deletion
              of your personal information. To submit a deletion request, email
              us at{" "}
              <a
                href={`mailto:${contactEmail}`}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                {contactEmail}
              </a>{" "}
              with the subject line &quot;Data Deletion Request&quot; and
              include your account email address. We will process your request
              within 30 days.
            </li>
            <li>
              <strong className="text-white">Portability:</strong> Receive a
              copy of your data in a structured, machine-readable format.
            </li>
            <li>
              <strong className="text-white">Opt-Out:</strong> Opt out of
              marketing communications at any time via the unsubscribe link in
              any email or by contacting us directly.
            </li>
            <li>
              <strong className="text-white">Restriction:</strong> Request
              restriction of processing in certain circumstances.
            </li>
            <li>
              <strong className="text-white">Disconnect Google Sign-In:</strong>{" "}
              Disconnect your Google account at any time by contacting us at{" "}
              <a
                href={`mailto:${contactEmail}`}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                {contactEmail}
              </a>{" "}
              or via your Google Account settings at{" "}
              <a
                href="https://myaccount.google.com/permissions"
                className="text-blue-400 hover:text-blue-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://myaccount.google.com/permissions
              </a>
              .
            </li>
            <li>
              <strong className="text-white">Disconnect Meta Login:</strong>{" "}
              Disconnect your Meta account at any time by contacting us at{" "}
              <a
                href={`mailto:${contactEmail}`}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                {contactEmail}
              </a>{" "}
              or via your Facebook settings at{" "}
              <a
                href="https://www.facebook.com/settings?tab=applications"
                className="text-blue-400 hover:text-blue-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://www.facebook.com/settings?tab=applications
              </a>
              .
            </li>
          </ul>
          <p>
            We will respond to all privacy rights requests within the timeframe
            required by applicable law. Some requests may be subject to identity
            verification before we can fulfill them.
          </p>
        </>
      ),
    },
    {
      title: "9. California and U.S. State Privacy Rights",
      content: (
        <>
          <p>
            If you are a resident of California, Virginia, Colorado, Utah, or
            Connecticut, you have additional rights under applicable state
            privacy laws including the CCPA, CPRA, VCDPA, CPA, UCPA, and CTDPA:
          </p>
          <ul>
            <li>
              <strong className="text-white">Right to Know:</strong> Request
              information about the categories and specific pieces of personal
              information we have collected about you.
            </li>
            <li>
              <strong className="text-white">Right to Delete:</strong> Request
              deletion of your personal information, subject to certain
              exceptions.
            </li>
            <li>
              <strong className="text-white">Right to Correct:</strong> Request
              correction of inaccurate personal information.
            </li>
            <li>
              <strong className="text-white">
                Right to Opt-Out of Sale or Sharing:
              </strong>{" "}
              We do not sell personal information and do not share it for
              cross-context behavioral advertising.
            </li>
            <li>
              <strong className="text-white">
                Right to Non-Discrimination:
              </strong>{" "}
              We will not discriminate against you for exercising any of your
              privacy rights.
            </li>
            <li>
              <strong className="text-white">
                Right to Limit Sensitive Data Use:
              </strong>{" "}
              Where applicable, you may request we limit our use of sensitive
              personal information.
            </li>
          </ul>
          <p>
            To submit a request under any of these laws, please contact us at{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              {contactEmail}
            </a>
            . You may designate an authorized agent to make a request on your
            behalf with appropriate written authorization.
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
            other than your country of residence. These countries may have data
            protection laws that differ from your jurisdiction.
          </p>
          <p>
            When we transfer personal information outside of your jurisdiction,
            we implement appropriate safeguards — such as contractual
            protections — to ensure your information remains protected
            consistent with this Privacy Policy and applicable law.
          </p>
        </>
      ),
    },
    {
      title: "11. Children's Privacy",
      content: (
        <p>
          Our Service is not directed to children under the age of 16, and we do
          not knowingly collect personal information from children under 16. We
          do not use Google Sign-In, Meta Login, or any third-party
          authentication service in connection with users we know to be under
          16. If we learn we have collected personal information from a child
          under 16, we will delete it promptly. If you believe we may have
          collected information from a child under 16, please contact us at{" "}
          <a
            href={`mailto:${contactEmail}`}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            {contactEmail}
          </a>
          .
        </p>
      ),
    },
    {
      title: "12. Third-Party Services and Platform Integrations",
      content: (
        <>
          <p>
            Our Service integrates with and may link to third-party services not
            operated by us, including:
          </p>
          <ul>
            <li>
              <strong className="text-white">
                Google (Sign-In / OAuth 2.0)
              </strong>{" "}
              —{" "}
              <a
                href="https://policies.google.com/privacy"
                className="text-blue-400 hover:text-blue-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>{" "}
              |{" "}
              <a
                href="https://policies.google.com/terms"
                className="text-blue-400 hover:text-blue-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms
              </a>
            </li>
            <li>
              <strong className="text-white">Meta / Facebook (Login)</strong> —{" "}
              <a
                href="https://www.facebook.com/privacy/policy"
                className="text-blue-400 hover:text-blue-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>{" "}
              |{" "}
              <a
                href="https://www.facebook.com/terms"
                className="text-blue-400 hover:text-blue-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms
              </a>
            </li>
          </ul>
          <p>
            This Privacy Policy does not govern the practices of these
            third-party services. We encourage you to review their policies
            directly. We are not responsible for the privacy or security
            practices of any third-party platforms accessed independently
            through our Service.
          </p>
        </>
      ),
    },
    {
      title: "13. Compliance with Platform Policies",
      content: (
        <>
          <p>
            Our collection and use of data through third-party integrations is
            governed by the respective platform policies:
          </p>
          <ul>
            <li>
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="text-blue-400 hover:text-blue-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>{" "}
              (including Limited Use requirements)
            </li>
            <li>
              <a
                href="https://developers.meta.com/horizon/policy/data-use/"
                className="text-blue-400 hover:text-blue-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Meta Platform Terms and Developer Data Use Policy
              </a>
            </li>
          </ul>
          <p>
            In the event of any conflict between this Privacy Policy and a
            platform policy with respect to that platform&apos;s user data, the
            more restrictive or more protective provision will apply.
          </p>
        </>
      ),
    },
    {
      title: "14. Changes to This Privacy Policy",
      content: (
        <>
          <p>
            We may update this Privacy Policy from time to time to reflect
            changes in our practices, legal requirements, or platform
            integrations. We will notify you of material changes by posting the
            updated Policy on this page with a new &quot;Last Updated&quot;
            date. For significant changes, we may also notify you via email or
            an in-app notice.
          </p>
          <p>
            Your continued use of the Service after changes become effective
            constitutes your acceptance of the updated Privacy Policy.
          </p>
        </>
      ),
    },
    {
      title: "15. Contact Us",
      content: (
        <>
          <p>
            If you have questions, concerns, or requests regarding this Privacy
            Policy or our privacy practices, please contact us:
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
            For data deletion requests specifically, email{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              {contactEmail}
            </a>{" "}
            with the subject line &quot;Data Deletion Request&quot; and your
            account email address. We will respond within 30 days.
          </p>
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