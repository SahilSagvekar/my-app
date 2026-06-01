import Link from "next/link";

const sections = [
  {
    id: "definitions", number: "1", title: "Definitions",
    content: [
      { sub: "1.1", heading: '"Party" or "Individual"', text: 'Any person, contractor, vendor, talent, guest, contestant, employee, consultant, or other individual who signs an agreement with E8 Productions or engages in any business transaction, service delivery, or relationship with E8 Productions.' },
      { sub: "1.2", heading: '"Materials"', text: "Any content, including but not limited to: video footage, audio recordings, photographs, images, graphics, text, written works, intellectual property, proprietary information, business data, client lists, strategic plans, or any other information created, exchanged, or produced in connection with E8 Productions' business." },
      { sub: "1.3", heading: '"Confidential Information"', text: "Any information related to E8 Productions' business, operations, clients, strategies, finances, pending projects, content details, production methods, or any non-public information disclosed or developed during the course of the relationship." },
    ],
  },
  {
    id: "confidentiality", number: "2", title: "Confidentiality & Non-Disclosure",
    content: [
      { sub: "2.1", heading: "Strict Confidentiality Obligation", text: "Individual agrees to maintain strict confidentiality regarding all Confidential Information, business details, project information, client data, production details, strategic information, or any other non-public information disclosed by or developed during engagement with E8 Productions. Unauthorized disclosure in any form constitutes material breach and violation of intellectual property and trade secret rights." },
      { sub: "2.2", heading: "Scope of Confidentiality", text: "Disclosure includes, but is not limited to: posting on social media, sharing via email or messaging, discussing in interviews, mentioning in conversations, uploading files, publishing documents, disclosing to competitors, or any other form of sharing, whether public or private." },
      { sub: "2.3", heading: "Liquidated Damages for Breach", text: "Any violation of confidentiality will result in liquidated damages of Five Thousand Dollars ($5,000.00) per occurrence, plus all attorney's fees and legal costs incurred by E8 Productions in enforcing this policy." },
      { sub: "2.4", heading: "Perpetual Obligation", text: "Confidentiality obligations survive indefinitely and apply throughout and after the business relationship, regardless of how the relationship terminates." },
    ],
  },
  {
    id: "intellectual-property", number: "3", title: "Intellectual Property & Ownership",
    content: [
      { sub: "3.1", heading: "E8 Productions Ownership", text: "E8 Productions is the sole and exclusive owner of all Materials, including work product, deliverables, content, intellectual property, and derivative works created, produced, or developed in connection with this relationship. Individual retains no ownership rights, copyrights, or intellectual property rights whatsoever." },
      { sub: "3.2", heading: "Perpetual Rights", text: "E8 Productions retains irrevocable, perpetual, worldwide rights to use, reproduce, distribute, license, monetize, modify, and exploit all Materials indefinitely, through any platform and by any means." },
      { sub: "3.3", heading: "Editing and Alterations", text: "E8 Productions may edit, modify, alter, enhance, combine, or completely remake Materials without notice or approval." },
      { sub: "3.4", heading: "No Compensation", text: "Individual explicitly waives any entitlement to compensation, royalties, or payment for E8 Productions' use, monetization, or exploitation of Materials or likeness, unless separately and explicitly agreed in writing." },
    ],
  },
  {
    id: "non-disparagement", number: "4", title: "Non-Disparagement & Reputation Protection",
    content: [
      { sub: "4.1", heading: "Prohibition on Disparagement", text: "Individual agrees not to make any negative, disparaging, defamatory, slanderous, or libelous statements regarding E8 Productions, its officers, employees, business practices, content, reputation, or operations. This applies to all platforms including social media, interviews, public forums, and any other medium." },
      { sub: "4.2", heading: "Liquidated Damages", text: "Per disparaging social media post: $2,500.00. Per public interview or recorded statement: $5,000.00." },
      { sub: "4.3", heading: "False Claims", text: "Individual shall not make false, misleading, or unsubstantiated claims regarding E8 Productions' business practices, treatment, finances, or conduct. Violation results in liquidated damages of $3,500.00 per false statement, plus actual damages." },
    ],
  },
  {
    id: "moral-clause", number: "5", title: "Moral Clause & Right to Disassociate",
    content: [
      { sub: "5.1", heading: "Disassociation Rights", text: "E8 Productions reserves the absolute right to immediately disassociate from Individual if Individual engages in conduct harmful to its reputation, brand, or business interests, including: criminal arrest, indictment, or conviction; public disparagement; public scandal or controversy; or material breach of this Agreement." },
      { sub: "5.2", heading: "No Compensation Upon Disassociation", text: "Upon disassociation, all compensation and benefit obligations cease. Individual remains liable for all damages and attorney's fees arising from the conduct that prompted disassociation." },
    ],
  },
  {
    id: "liability", number: "6", title: "Liability Waiver & Assumption of Risk",
    content: [
      { sub: "6.1", heading: "Complete Waiver", text: "Individual assumes all risks and waives all claims against E8 Productions related to: physical injury, emotional distress, damage to reputation, negative publicity, loss of income, business harm, or any other consequence arising from engagement with E8 Productions." },
      { sub: "6.2", heading: "No Liability for Consequences", text: "E8 Productions is not responsible for negative reactions, social media backlash, job loss, relationship damage, or any other consequence arising from Materials, content, or disclosure of the relationship." },
    ],
  },
  {
    id: "attorneys-fees", number: "7", title: "Attorney's Fees & Legal Enforcement",
    content: [
      { sub: "7.1", heading: "Complete Fee Recovery", text: "In any dispute, Individual agrees to pay 100% of E8 Productions' attorney's fees, court costs, and legal expenses, regardless of who initiates action or the outcome." },
      { sub: "7.2", heading: "Upfront Payment", text: "Individual agrees to pay all attorney's fees upon demand within ten (10) business days. Payment is not contingent on litigation outcome." },
      { sub: "7.3", heading: "Injunctive Relief", text: "E8 Productions is entitled to seek injunctive relief, restraining orders, and equitable remedies without posting bond. Individual waives any bond requirement." },
    ],
  },
  {
    id: "non-compete", number: "8", title: "Non-Compete & Non-Solicitation",
    content: [
      { sub: "8.1", heading: "Non-Solicitation of Clients", text: "Individual shall not solicit, contract with, or do business with any of E8 Productions' clients, partners, or business relationships during or after the engagement. Violation results in liquidated damages of $10,000.00 per client solicitation, plus lost contract value." },
      { sub: "8.2", heading: "Non-Disparagement of Clients", text: "Individual shall not disparage or make negative statements about E8 Productions' clients, partners, or collaborators." },
    ],
  },
  {
    id: "indemnification", number: "9", title: "Indemnification",
    content: [
      { sub: "", heading: "", text: "Individual agrees to indemnify, defend, and hold harmless E8 Productions from any claims, damages, liabilities, or costs arising from: Individual's conduct, breach of this Agreement, infringement of third-party rights, defamation, negligence, or any act or omission by Individual." },
    ],
  },
  {
    id: "remedies", number: "10", title: "Cumulative Remedies",
    content: [
      { sub: "", heading: "", text: "All remedies available to E8 Productions are cumulative and non-exclusive. E8 Productions may pursue liquidated damages, attorney's fees, injunctive relief, and actual damages simultaneously." },
    ],
  },
  {
    id: "survival", number: "11", title: "Survival & Duration",
    content: [
      { sub: "", heading: "", text: "Confidentiality, non-disparagement, indemnification, intellectual property rights, and attorney's fees obligations survive indefinitely or for the time periods specified in the governing agreement." },
    ],
  },
  {
    id: "governing-law", number: "12", title: "Governing Law & Jurisdiction",
    content: [
      { sub: "12.1", heading: "South Carolina Law", text: "These policies shall be governed by and construed in accordance with the laws of the State of South Carolina, without regard to conflict of laws principles." },
      { sub: "12.2", heading: "Exclusive Venue", text: "Individual irrevocably consents to the exclusive jurisdiction and venue of state and federal courts in Horry County, South Carolina. Individual waives any objection to venue." },
    ],
  },
  {
    id: "severability", number: "13", title: "Severability",
    content: [
      { sub: "", heading: "", text: "If any provision is found unenforceable, it shall be reformed to the minimum extent necessary or severed. All remaining provisions remain in full force." },
    ],
  },
  {
    id: "modification", number: "14", title: "Modification & Updates",
    content: [
      { sub: "", heading: "", text: 'E8 Productions may update these policies at any time by posting revised versions with a new "Effective Date." Continued engagement constitutes acceptance of updates.' },
    ],
  },
  {
    id: "no-oral", number: "15", title: "No Oral Modifications",
    content: [
      { sub: "", heading: "", text: "These policies may only be modified by written instrument signed by authorized E8 Productions representatives. No verbal representations, email exchanges, or telephone agreements modify these terms." },
    ],
  },
];

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm mb-8 inline-block">← Back</Link>
          <p className="text-gray-400 text-sm mb-2">E8 Productions, LLC</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">General Legal Policies & Terms of Use</h1>
          <p className="text-gray-400 text-sm">Effective Date: May 29, 2026 · Version 1.0</p>
        </div>

        {/* Contractor-only notice */}
        <div className="border border-amber-200 rounded-lg p-4 mb-8 bg-amber-50">
          <p className="text-amber-800 text-sm leading-relaxed">
            <span className="font-semibold">For Contractors, Talent & Vendors Only —</span> This document is an internal legal agreement intended solely for individuals and entities entering into a business relationship with E8 Productions (e.g. contractors, freelancers, talent, vendors). It is <span className="font-semibold">not</span> a general Terms of Service for app users. If you are a client or app user, please refer to our{" "}
            <Link href="/terms" className="underline hover:text-amber-900">Terms of Service</Link> and{" "}
            <Link href="/privacy" className="underline hover:text-amber-900">Privacy Policy</Link>.
          </p>
        </div>

        {/* Legal Notice */}
        <div className="border border-gray-200 rounded-lg p-5 mb-12 bg-gray-50">
          <p className="text-gray-600 text-sm leading-relaxed">
            <span className="font-semibold text-gray-800">Legal Notice —</span> These policies are incorporated by reference into all agreements executed by or with E8 Productions, LLC. By signing any E8 Productions agreement that references this page, or by engaging in any business relationship with E8 Productions, you acknowledge that you have read, understood, and agree to be bound by all terms herein. These terms are legally binding and enforceable in a court of law.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((section) => (
            <div key={section.id} id={section.id}>
              <h2 className="text-base font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
                {section.number}. {section.title}
              </h2>
              <div className="space-y-4">
                {section.content.map((item, i) => (
                  <div key={i}>
                    {(item.sub || item.heading) && (
                      <p className="text-sm font-semibold text-gray-700 mb-1">
                        {item.sub && <span className="text-gray-400 mr-2">{item.sub}</span>}
                        {item.heading}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-100 text-sm text-gray-400 space-y-1">
          <p className="font-medium text-gray-600">E8 Productions, LLC</p>
          <p>1906 S Ocean Blvd. Apt. 1 #410B · Myrtle Beach, SC 29577</p>
          <a href="mailto:legal@e8productions.com" className="hover:text-gray-600 transition-colors">legal@e8productions.com</a>
          <p className="pt-2">Version 1.0 · Effective May 29, 2026</p>
        </div>
      </div>
    </div>
  );
}