import { PDFDocument, rgb, PDFFont } from 'pdf-lib';

/**
 * Merge multiple already-generated PDF buffers into one, in order —
 * used to combine the Quote, Schedules A/B, and PSA into a single
 * signable document.
 */
export async function mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const buffer of buffers) {
    const doc = await PDFDocument.load(buffer);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  const bytes = await merged.save();
  return Buffer.from(bytes);
}

interface ServiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface TermItem {
  title: string;
  body: string;
}

export interface ContractQuote {
  version: number;
  createdAt: Date | string;
  services: any; // ServiceLine[]
  inclusions: any; // string[]
  terms: any; // TermItem[]
  totalAmount: number;
}

export interface ContractPreClient {
  name: string;
  email: string;
  companyName: string | null;
  address: string | null;
}

type Block =
  | { type: 'doctitle'; text: string }
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'body'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'pagebreak' };

function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

/**
 * The quote's Terms list is the single source of truth for revision count —
 * admins edit a "Revision Terms" term (e.g. "1 revision(s) per video edit.")
 * and this pulls the leading number out of it for the contract's Schedule A.
 */
function extractRevisionRounds(terms: TermItem[]): number {
  const revisionTerm = terms.find((t) => /revision/i.test(t.title));
  const match = revisionTerm?.body.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

/**
 * Renders a flat list of content blocks into a paginated PDF, wrapping text and
 * breaking pages as needed. Mirrors the layout approach in quote-pdf.ts but for
 * long-form prose instead of a cost table.
 */
async function renderBlocks(pdfDoc: PDFDocument, blocks: Block[]): Promise<void> {
  const font = await pdfDoc.embedFont('Helvetica');
  const boldFont = await pdfDoc.embedFont('Helvetica-Bold');

  const width = 612; // Letter
  const height = 792;
  const margin = 54;
  const contentWidth = width - 2 * margin;

  let page = pdfDoc.addPage([width, height]);
  let y = height - margin;

  const newPage = () => {
    page = pdfDoc.addPage([width, height]);
    y = height - margin;
  };

  const checkPageBreak = (needed: number) => {
    if (y - needed < margin) newPage();
  };

  for (const block of blocks) {
    if (block.type === 'pagebreak') {
      newPage();
      continue;
    }

    if (block.type === 'doctitle') {
      checkPageBreak(28);
      page.drawText(block.text, { x: margin, y, size: 16, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      y -= 16;
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1.5, color: rgb(0.1, 0.34, 0.86) });
      y -= 24;
      continue;
    }

    if (block.type === 'h1') {
      checkPageBreak(28);
      page.drawText(block.text, { x: margin, y, size: 13, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      y -= 22;
      continue;
    }

    if (block.type === 'h2') {
      checkPageBreak(20);
      page.drawText(block.text, { x: margin, y, size: 10.5, font: boldFont, color: rgb(0.15, 0.15, 0.15) });
      y -= 16;
      continue;
    }

    const isBullet = block.type === 'bullet';
    const indent = isBullet ? 14 : 0;
    const lines = wrapText(block.text, contentWidth - indent, font, 9.5);
    const neededHeight = lines.length * 12.5 + 6;
    checkPageBreak(neededHeight);

    if (isBullet) {
      page.drawCircle({ x: margin + 3, y: y + 3, size: 1.5, color: rgb(0.2, 0.2, 0.2) });
    }

    for (const line of lines) {
      checkPageBreak(12.5);
      page.drawText(line, { x: margin + indent, y, size: 9.5, font, color: rgb(0.15, 0.15, 0.15) });
      y -= 12.5;
    }
    y -= 6;
  }

  // Footer + page numbers on every page
  const pageCount = pdfDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const p = pdfDoc.getPage(i);
    p.drawLine({ start: { x: margin, y: 36 }, end: { x: width - margin, y: 36 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    p.drawText(`Page ${i + 1} of ${pageCount}`, { x: width - margin - 60, y: 24, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    p.drawText('E8 Productions, LLC', { x: margin, y: 24, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  }
}

/**
 * The signable document — Professional Services Agreement only. Sent via
 * SignWell for e-signature. Schedules A/B are a separate reference document
 * (see generateScheduleDocsPdf) sent alongside but not requiring a signature.
 */
export async function generateContractPdf(quote: ContractQuote, preClient: ContractPreClient): Promise<Buffer> {
  const clientLegalName = preClient.companyName || preClient.name;
  const clientAddressClause = preClient.address ? `, with mailing address at ${preClient.address}` : '';
  const effectiveDate = fmtDate(new Date());
  const clientSignerName = preClient.name;
  const clientNoticeEmail = preClient.email;

  const pdfDoc = await PDFDocument.create();

  const psaBlocks: Block[] = [
    { type: 'doctitle', text: 'PROFESSIONAL SERVICES AGREEMENT' },
    { type: 'body', text: `THIS PROFESSIONAL SERVICES AGREEMENT (the "Agreement") is entered into as of ${effectiveDate} (the "Effective Date"), by and between ${clientLegalName}${clientAddressClause} (the "Client") and E8 Productions, LLC, with mailing address at 1906 S. Ocean Blvd, Suite #410B, Myrtle Beach, SC 29577 (the "Consultant"). E8 Productions, LLC will perform the services (the "Services") and deliver the materials (the "Deliverables") specified in each signed Quote/Price Sheet (the "Quote") to Client, subject to and in accordance with all terms, conditions, and specifications set forth herein and in the attached Schedules A and B (collectively, the "Agreement"). The parties agree as follows:` },

    { type: 'h1', text: 'ARTICLE I: SERVICES' },
    { type: 'body', text: '1.1 Services Provided by Consultant. Client hereby engages Consultant as an independent contractor to provide the Services described in Schedule A. Consultant accepts such engagement. All Services shall be performed by Consultant in a professional and highly skilled manner, using Consultant’s best efforts, and Consultant shall determine the method, details and means of performing the Services.' },
    { type: 'body', text: '1.2 Status as Independent Contractor. During the Term, Consultant shall act in the capacity as an independent contractor with respect to Client. Consultant shall be solely responsible for the manner in which the Services shall be performed.' },
    { type: 'body', text: '1.3 Representations and Warranties. Consultant represents that they are free to enter into this Agreement, and that this engagement does not violate the terms of any agreement between Consultant and any third party. Consultant warrants that the Services shall be performed in accordance with applicable law and industry standards.' },
    { type: 'body', text: '1.4 Materials & Releases. Consultant shall provide all materials, equipment, and production resources necessary to perform the Services under this Agreement. There shall be no separate or additional charges to Client for such materials or equipment. Client shall be responsible for securing any and all necessary location releases, appearance releases, or waivers required for individuals, businesses, or properties appearing in the Deliverables, unless otherwise expressly agreed in writing. Consultant may provide standard release forms and guidance upon request.' },
    { type: 'body', text: '1.5 Ownership. All right, title, and interest in and to the final Deliverables produced by Consultant pursuant to this Agreement — including, but not limited to, edited videos, creative assets, captions, scripts, metadata, and copywriting — shall vest exclusively in Client upon full and timely payment of all fees due under this Agreement. Client shall also retain full ownership of all raw and original footage captured during the course of this engagement, including all unedited video files, audio recordings, b-roll, and source materials, whether or not they are ultimately included in the final Deliverables. Additionally, any and all social media accounts, pages, profiles, usernames, channels, and related login credentials created, managed, or operated by Consultant on behalf of Client for the purpose of executing this Agreement shall be the sole and exclusive property of Client. Consultant shall promptly provide full administrative access and control to Client upon request and no later than the termination or expiration of this Agreement. Notwithstanding the foregoing, Consultant shall retain a non-exclusive, royalty-free, worldwide, perpetual license to use the final Deliverables for promotional purposes, including inclusion in Consultant’s portfolio, reels, case studies, and marketing materials, provided such use does not disclose any Confidential Information or portray Client in a negative or misleading light.' },
    { type: 'body', text: '1.6 Delivery Timelines. Consultant shall use commercially reasonable efforts to deliver Deliverables within a timeframe generally consistent with the parties’ ordinary course of dealing, as may be discussed or otherwise communicated from time to time. Delivery timing may vary based on scope, volume of footage, revision rounds, and other production factors. Consultant shall communicate any significant delays to Client.' },
    { type: 'body', text: '1.7 Approval Process. To ensure timely production and publishing of content, Client agrees to participate in a daily approval process. Consultant shall submit a preview or outline of the content scheduled for the following day no later than twenty four hours (24 hours) in advance of its intended delivery or release date. Client shall review and provide feedback, edits, or approval within twenty four hours (24 hours) of submission. Failure to respond within this window may be deemed acceptance by Consultant, who may proceed with finalization and publication at their discretion.' },
    { type: 'body', text: '1.8 Media Storage & Access. Consultant shall provide and manage a dedicated media storage system for the duration of the Services. Details of this solution and associated access, cost, and retention policies are set forth in Section 6.20.' },
    { type: 'body', text: '1.9 Strategic Advisory. Consultant may, at its discretion, provide out-of-scope strategic advisory support upon request from Client. These services shall not be considered part of the core scope of work and shall only be provided if mutually agreed upon in writing, either through a separate agreement or an approved scope modification. Nothing in this section obligates either party to additional fees or deliverables unless expressly documented and signed by both parties.' },

    { type: 'h1', text: 'ARTICLE II: TERM AND TERMINATION' },
    { type: 'body', text: '2.1 Term. This Agreement shall commence on the Effective Date and shall continue for a period of one year unless terminated earlier pursuant to Section 2.2.' },
    { type: 'body', text: '2.2 Termination. Binding Commitment. This Agreement shall commence on the Effective Date and shall remain in full force and effect for the entire Term. This Agreement may not be terminated prior to the expiration of the Term for any reason. Client shall remain fully obligated to pay all Fees and approved reimbursable expenses for the entire Term of this Agreement.' },
    { type: 'body', text: '2.3 Termination for Non-Payment. In addition to any other termination rights provided herein, Consultant may suspend Services or terminate this Agreement upon written notice if Client fails to make any undisputed payment due hereunder within five (5) days after written notice of such failure. In such event, Client shall remain liable for all work performed and expenses incurred up to the termination date.' },
    { type: 'body', text: '2.4 Automatic Renewal. Upon expiration of the Term, this Agreement shall automatically renew for successive one (1) year periods (each, a "Renewal Term"), unless either party provides the other with written notice of its intent not to renew at least sixty (60) days prior to the expiration of the then-current Term. Except as expressly modified by mutual written agreement of the parties, all other terms and conditions of this Agreement shall remain in full force and effect during any Renewal Term. Consultant may adjust the Monthly Service Fee effective as of any Renewal Term by providing Client with written notice of the revised fee at least sixty (60) days prior to the start of that Renewal Term; if Client does not agree to the revised fee, Client may decline renewal by providing notice of non-renewal in accordance with this Section.' },

    { type: 'h1', text: 'ARTICLE III: COMPENSATION' },
    { type: 'body', text: '3.1 Charges for Services. Client shall pay Consultant the fees specified in Schedule B. Consultant shall not be entitled to any other compensation or benefits.' },
    { type: 'body', text: '3.2 Taxes. Consultant acknowledges and agrees that, as an independent contractor, Consultant shall be solely responsible for the reporting, withholding, and payment of any and all federal, state, and local income taxes, self-employment taxes, payroll taxes, and any other taxes or assessments imposed by any governmental authority in connection with the compensation received under this Agreement. Consultant further agrees to indemnify and hold Client harmless from any and all liability arising from Consultant’s failure to comply with applicable tax obligations.' },
    { type: 'body', text: '3.3 Late Payment. Any undisputed amount not paid when due shall accrue interest at the rate of one and one-half percent (1.5%) per month, or the maximum rate permitted by applicable law, whichever is lower, from the due date until paid in full. Client shall also reimburse Consultant for reasonable costs of collection, including attorneys’ fees, incurred in recovering any past-due amount.' },

    { type: 'h1', text: 'ARTICLE IV: CONFIDENTIAL INFORMATION AND NON-DISCLOSURE' },
    { type: 'body', text: '4.1 Confidential Information. Confidential Information includes proprietary technology, strategies, business plans, client data, and all information marked or reasonably understood as confidential.' },
    { type: 'body', text: '4.2 Exceptions. Confidential Information does not include information that is publicly available, known to Consultant prior to disclosure, independently developed, or disclosed under legal obligation.' },
    { type: 'body', text: '4.3 Non-Disclosure. Consultant agrees to retain all Confidential Information in strict confidence and not disclose it to third parties without prior written consent.' },
    { type: 'body', text: '4.4 Survival. The confidentiality obligations shall survive termination of this Agreement.' },

    { type: 'h1', text: 'ARTICLE V: INDEMNITY; LIMITATION OF LIABILITY; INSURANCE' },
    { type: 'body', text: '5.1 Indemnification of Client. Consultant shall indemnify, defend, and hold harmless Client and its officers, directors, employees, agents, and affiliates from and against any and all third-party claims, losses, liabilities, damages, expenses, and costs (including reasonable attorneys’ fees) arising out of or relating to: (a) Consultant’s gross negligence or willful misconduct in connection with the performance of the Services; or (b) any breach by Consultant of its obligations, representations, or warranties under this Agreement. Consultant shall not, however, be liable for indirect, incidental, consequential, or punitive damages, or for any losses arising from Client’s misuse of the Deliverables.' },
    { type: 'body', text: '5.2 Indemnification of Consultant. Client shall indemnify, defend, and hold harmless Consultant and its officers, directors, employees, agents, and affiliates from and against any and all claims, liabilities, damages, losses, and expenses (including reasonable attorneys’ fees) arising out of or relating to: (a) Client’s use or misuse of the Deliverables; (b) any breach by Client of its obligations, representations, or warranties under this Agreement; or (c) any injury, loss, or damage to persons or property occurring during filming or production at a location arranged or owned by a third party. For clarity, Consultant and Client shall not be held liable for any on-site incidents, claims, or damages occurring at any filming locations. Consultant shall obtain appearance or location releases as reasonably required, and location owners shall be solely responsible for maintaining a safe environment and shall release and hold harmless both Consultant and Client from any and all liability associated with on-site filming.' },
    { type: 'body', text: '5.3 Limitation of Liability. Except in the case of gross negligence, willful misconduct, or breach of confidentiality, Consultant’s total liability under this Agreement, whether in contract, tort, or otherwise, shall not exceed the total amount of fees actually paid to Consultant under this Agreement.' },
    { type: 'body', text: '5.4 Exclusion of Certain Damages. In no event shall either party be liable to the other for any indirect, incidental, consequential, special, exemplary, or punitive damages, including but not limited to lost profits, lost opportunities, business interruption, or loss of data, arising out of or in connection with this Agreement, even if advised of the possibility of such damages.' },

    { type: 'h1', text: 'ARTICLE VI: OTHER PROVISIONS' },
    { type: 'body', text: '6.1 No Third-Party Beneficiaries. This Agreement is entered into solely for the benefit of the parties hereto. Nothing herein, express or implied, shall confer upon any other person or entity any legal or equitable right, benefit, or remedy of any nature under or by reason of this Agreement.' },
    { type: 'body', text: '6.2 Dispute Resolution. Prior to initiating litigation, the parties agree to first attempt in good faith to resolve any dispute, controversy, or claim arising out of or relating to this Agreement through informal mediation with a mutually agreed mediator. If the dispute is not resolved through mediation within thirty (30) days after either party requests it (or such longer period as the parties may agree in writing), either party may proceed to litigation as set forth below. Any dispute, controversy, or claim not resolved through mediation shall be resolved exclusively through litigation in a court of competent jurisdiction. The parties agree that the state and federal courts located in Horry County, South Carolina shall have exclusive jurisdiction and venue over any such disputes. Each party hereby irrevocably submits to the personal jurisdiction of such courts and waives any objection based on forum non conveniens or any other jurisdictional grounds. The prevailing party in any such litigation shall be entitled to recover its reasonable attorneys’ fees and costs from the non-prevailing party, in addition to any other relief awarded.' },
    { type: 'body', text: '6.3 Waiver. No waiver of any provision of this Agreement shall be effective unless made in writing and signed by the waiving party. No waiver of any breach or default shall be deemed a waiver of any subsequent breach or default.' },
    { type: 'body', text: '6.4 Severability. If any provision of this Agreement is determined to be invalid, illegal, or unenforceable by a court of competent jurisdiction, the remaining provisions shall remain in full force and effect, and the invalid provision shall be interpreted or modified, if possible, so as to be valid and enforceable while preserving its intent.' },
    { type: 'body', text: `6.5 Notice. All notices, requests, consents, claims, demands, waivers, and other communications under this Agreement shall be in writing and shall be deemed duly given and effective: (a) when sent by email to the designated business email address of the receiving party, provided no bounce-back or failure notice is received; (b) when delivered personally; (c) when sent by a nationally recognized overnight courier with confirmation of delivery; or (d) when sent by certified or registered mail, return receipt requested, postage prepaid. Email shall be the primary and preferred method of notice. Each party shall designate one or more official email addresses for communication under this Agreement. Notices shall be sent to the following initial email addresses, or to such other address as either party may designate by written notice: For Consultant: eric@e8productions.com For Client: ${clientNoticeEmail}` },
    { type: 'body', text: '6.6 Client Cooperation. Client agrees to provide timely access to necessary personnel, locations, information, and approvals required for Consultant to perform the Services. Consultant shall not be held liable for delays in delivery of Services resulting from Client’s failure to provide such cooperation.' },
    { type: 'body', text: '6.7 Platform Access and Account Control. Client shall provide Consultant with timely and sufficient access to all necessary platforms, tools, and social media accounts to perform the Services. Consultant shall not be liable for any delays caused by failure to provide or maintain such access. Consultant shall not be responsible for any content losses or disruptions resulting from third-party platform outages or policy changes.' },
    { type: 'body', text: '6.8 Data Security. Consultant agrees to take commercially reasonable measures to safeguard Client data, files, and access credentials, and to store all media assets in secure, access-controlled environments. Consultant shall not share access credentials or proprietary materials with any unauthorized third party. In the event Consultant becomes aware of any unauthorized access to, or disclosure of, Client’s Confidential Information or data in Consultant’s possession or control, Consultant shall notify Client without undue delay, and in no event later than seventy-two (72) hours after becoming aware of such incident, and shall reasonably cooperate with Client’s efforts to investigate and mitigate the incident.' },
    { type: 'body', text: '6.9 Publicity. Consultant may include Client’s name, logo, and publicly available Deliverables in its portfolio, marketing materials, and website to demonstrate past work and capabilities, unless otherwise instructed in writing by Client.' },
    { type: 'body', text: '6.10 No Exclusivity. This Agreement does not grant either party exclusivity. Consultant may provide similar services to other clients, provided that such services do not involve the unauthorized use or disclosure of Client’s Confidential Information.' },
    { type: 'body', text: '6.11 Independent Contractor. Consultant is and shall remain an independent contractor in the performance of all services under this Agreement. Nothing in this Agreement shall be construed as creating an employer-employee relationship, partnership, joint venture, agency, or other legal association between the parties.' },
    { type: 'body', text: '6.12 Assignment. Neither this Agreement nor any of the rights, interests, or obligations hereunder shall be assigned or delegated by Consultant without the prior written consent of Client. Any unauthorized assignment by Consultant shall be null and void. Client may assign this Agreement without Consultant’s consent in connection with a merger, acquisition, or sale of all or substantially all of Client’s assets or equity, provided Client gives Consultant written notice of such assignment and the assignee agrees in writing to assume all of Client’s obligations under this Agreement.' },
    { type: 'body', text: '6.13 Point of Contact. Client shall designate and maintain a primary point of contact, individual, or internal team to serve as the Consultant’s direct liaison for the duration of this Agreement. This designated person or group shall be responsible for providing feedback, approvals, scheduling support, and coordinating all communications related to the Services. Consultant shall not be responsible for any delays, miscommunications, or inconsistencies resulting from the absence of a clearly designated contact or from receiving conflicting direction from multiple Client representatives.' },
    { type: 'body', text: '6.14 Non-Solicitation. Each party agrees that, during the term of this Agreement and at all times thereafter, it shall not directly or indirectly solicit, engage, hire, or otherwise contract with any employee, contractor, subcontractor, or representative of the other party who was involved in providing or receiving the Services under this Agreement, without the prior express written consent of the other party. This non-solicitation obligation applies mutually and survives the termination or expiration of this Agreement in perpetuity. Any violation of this provision — whether by employment, contractual arrangement, or other form of engagement — without such written consent may, at the non-breaching party’s discretion, result in monetary compensation equal to the fair market value of the services lost, or an amount otherwise agreed upon in writing between the parties.' },
    { type: 'body', text: '6.15 Force Majeure. Neither party shall be liable for delays or failure to perform under this Agreement due to events beyond its reasonable control, including but not limited to acts of God, natural disasters, war, terrorism, epidemics, labor disputes, or government restrictions. In such cases, performance timelines shall be extended accordingly.' },
    { type: 'body', text: '6.16 Production Delays and Rescheduling. Consultant shall not be held liable for delays in production or content delivery due to circumstances beyond its reasonable control, including travel delays, weather conditions, or scheduling conflicts. In such cases, both parties will work in good faith to reschedule affected production dates.' },
    { type: 'body', text: '6.17 Subcontractors. Consultant may engage qualified subcontractors or third-party vendors in the performance of Services, provided Consultant remains fully responsible for their performance and compliance with the terms of this Agreement. All subcontractors or vendors shall be engaged solely by Consultant, and nothing in this Agreement shall be construed to create any employment, contractual, or agency relationship between such parties and the Client. The Client shall have no liability, obligation, or responsibility with respect to any subcontractor or third party retained by Consultant.' },
    { type: 'body', text: '6.18 Scope of Work Boundaries. Consultant shall only be obligated to perform the Services expressly outlined in this Agreement and Schedule A. Any requests for work outside of the agreed scope shall require a separate written agreement and may be subject to additional fees at Consultant’s standard rates. Consultant shall not be required to commence any out-of-scope work without written approval from Client.' },
    { type: 'body', text: '6.19 Change Requests. Any material changes to the scope, budget, deliverables, timeline, or Services must be requested in writing and mutually agreed upon through a signed Change Order or written amendment to this Agreement.' },
    { type: 'body', text: '6.20 Media Archiving and Transfer. Consultant shall maintain and archive all raw and final project files for 45 days after services are rendered.' },
    { type: 'body', text: '6.21 Transition Support. In the event of termination, Consultant agrees to provide reasonable support in transferring access, files, and documentation necessary to ensure continuity. Such support shall not exceed ten (10) hours unless otherwise agreed and may be billed at Consultant’s standard hourly rate beyond that limit.' },
    { type: 'body', text: '6.22 Consultant Branding. All rights in Consultant’s name, logo, trademarks, and branding elements shall remain the exclusive property of Consultant. Nothing in this Agreement shall be construed to grant Client any license or rights to use Consultant’s brand identity without prior written consent.' },
    { type: 'body', text: '6.23 Brand Alignment. Consultant reserves the right to decline participation in any project, partnership, or sponsorship that it reasonably believes could harm its professional reputation or conflict with its core values, brand image, or industry standards.' },
    { type: 'body', text: '6.24 Use of AI Tools. Consultant may utilize AI-based tools or platforms to support production, ideation, scripting, or analytics, provided that final content is reviewed and approved by human team members. All creative decisions and quality standards shall remain the responsibility of Consultant.' },
    { type: 'body', text: '6.25 Amendment. This Agreement may only be amended, modified, or supplemented by a written instrument executed by both parties. Preliminary agreement on amendments may be made via email between authorized representatives of the parties; however, any such amendment shall not be effective unless and until it is subsequently documented in a formal written instrument and signed by both parties.' },
    { type: 'body', text: '6.26 Governing Law and Venue. This Agreement shall be governed by and construed in accordance with the laws of the State of South Carolina, without regard to its conflict of law principles. The parties agree that the exclusive venue for any dispute arising out of or related to this Agreement shall be the state or federal courts located in Horry County, South Carolina.' },
    { type: 'body', text: '6.27 Counterparts. This Agreement may be executed in two or more counterparts, each of which shall be deemed an original and all of which together shall constitute one and the same instrument. Execution and delivery of this Agreement by electronic means (including PDF or electronic signature) shall be deemed effective and binding. Each party consents to the use of electronic signatures and electronic records in connection with the execution and performance of this Agreement, to the fullest extent permitted under the U.S. Electronic Signatures in Global and National Commerce Act (E-SIGN) and applicable state law, including the Uniform Electronic Transactions Act (UETA), and agrees not to contest the validity or enforceability of this Agreement solely on the grounds that it was executed or delivered electronically.' },
    { type: 'body', text: '6.28 Survival. The provisions of this Agreement which by their nature should survive termination or expiration, including but not limited to confidentiality, indemnity, ownership, and dispute resolution provisions, shall so survive.' },
    { type: 'body', text: '6.29 Headings and Interpretation. The headings in this Agreement are for convenience only and shall not affect its interpretation. Any ambiguities shall not be construed against either party solely by reason of authorship.' },
    { type: 'body', text: '6.30 Disclaimer of Warranties. Consultant makes no guarantees regarding audience growth, revenue, or specific content performance. Except as expressly stated herein, all services and deliverables are provided "as is" and without warranties of any kind, either express or implied.' },
    { type: 'body', text: '6.31 Entire Agreement. This Agreement, together with any schedules, exhibits, or attachments hereto, constitutes the entire agreement between the parties with respect to its subject matter and supersedes all prior and contemporaneous agreements, understandings, and representations, whether oral or written.' },
    { type: 'body', text: '6.32 Authority to Execute. Each party represents and warrants that the individual executing this Agreement on its behalf has full authority to bind such party to the terms of this Agreement.' },
    { type: 'body', text: '6.33 No Waiver. The failure of either party to enforce any right or provision of this Agreement shall not constitute a waiver of future enforcement of that right or provision.' },
    { type: 'body', text: '6.34 Insurance. Consultant shall maintain, at its own expense, commercial general liability insurance with minimum coverage of $1,000,000 per occurrence, and shall provide Client with a certificate of insurance upon request. Nothing in this Section shall be construed to expand Consultant’s liability beyond the limitations set forth in Section 5.3.' },
    { type: 'body', text: '6.35 Non-Disparagement. During the Term and for a period of one (1) year thereafter, neither party shall make, publish, or encourage any other person to make or publish, any disparaging or defamatory statement (written or oral) about the other party, its officers, employees, products, or services, provided that nothing in this Section shall restrict either party from making truthful statements to the extent required by law, in connection with a legal proceeding, or in response to any inquiry from a governmental or regulatory authority.' },
    { type: 'body', text: '6.36 Platform & Content Risk. Client acknowledges that social media and video-hosting platforms may, from time to time, remove content, suspend accounts, or issue copyright or policy strikes based on their own policies and processes, which are outside of Consultant’s control. Consultant shall not be liable for any such platform action taken against Deliverables published in accordance with Client’s instructions or approval, provided Consultant did not knowingly use material it had reason to believe was infringing or unlawful. Client shall be responsible for securing any licenses or rights needed for materials it supplies to Consultant for inclusion in the Deliverables.' },
    { type: 'body', text: '6.37 Website & Platform Terms. Client’s and its authorized users’ access to and use of Consultant’s website (https://e8productions.com) and the E8App (collectively, the "Platform") is additionally governed by Consultant’s Terms of Service, available at https://e8productions.com/terms, and Privacy Policy, available at https://e8productions.com/privacy, each as may be updated by Consultant from time to time and each of which is incorporated herein by reference. In the event of any conflict between this Agreement and the Terms of Service or Privacy Policy, this Agreement shall control with respect to the commercial terms of the engagement (including fees, deliverables, and Term), and the Terms of Service and Privacy Policy shall control with respect to Client’s use of, and Consultant’s handling of data through, the Platform. Consultant shall provide notice of any material change to the Terms of Service or Privacy Policy in accordance with Section 6.5 (Notice).' },

    { type: 'h2', text: 'Schedules and Exhibits' },
    { type: 'body', text: 'The following Schedules are incorporated into and form an integral part of this Agreement:' },
    { type: 'bullet', text: 'Schedule A – Statement of Work & Deliverables. Outlines the services to be performed, number and type of deliverables, format, and publishing expectations.' },
    { type: 'bullet', text: 'Schedule B – Cost Breakdown. Details the fee and any approved optional costs.' },
    { type: 'body', text: 'Each Schedule may be amended from time to time upon mutual written agreement, without requiring full renegotiation of this Agreement.' },
    { type: 'body', text: 'IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.' },
    { type: 'body', text: `CLIENT: Name: ${clientSignerName}  Signature: ______________________________________  Date: ___________________________________________` },
    { type: 'body', text: 'E8 PRODUCTIONS, LLC By: Eric Davis  Signature: ______________________________________  Date: ___________________________________________' },
  ];

  await renderBlocks(pdfDoc, psaBlocks);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * The reference document — Schedule A (Statement of Work & Deliverables) and
 * Schedule B (Cost Breakdown). Incorporated by reference into the PSA but
 * doesn't require its own signature — sent to the client for their records
 * alongside the signable PSA.
 */
export async function generateScheduleDocsPdf(quote: ContractQuote, preClient: ContractPreClient): Promise<Buffer> {
  const clientLegalName = preClient.companyName || preClient.name;
  const effectiveDate = fmtDate(new Date());
  const quoteNo = `E8-${new Date(quote.createdAt).getFullYear()}-${String(quote.version).padStart(4, '0')}`;
  const quoteDate = fmtDate(quote.createdAt);
  const totalMonthlyCost = fmtCents(quote.totalAmount);
  const revisionRounds = extractRevisionRounds((quote.terms as TermItem[]) || []);

  const services = (quote.services as ServiceLine[]) || [];
  const inclusions = (quote.inclusions as string[]) || [];
  const deliverableLines = [
    ...services.map((s) => s.description).filter(Boolean),
    ...inclusions,
  ];

  const pdfDoc = await PDFDocument.create();

  const scheduleABlocks: Block[] = [
    { type: 'doctitle', text: 'SCHEDULE A – STATEMENT OF WORK & DELIVERABLES' },
    { type: 'body', text: `This Schedule A is attached to and incorporated by reference in the Professional Services Agreement between ${clientLegalName} and E8 Productions, LLC, effective as of ${effectiveDate}.` },
    { type: 'h2', text: 'Scope of Services' },
    { type: 'body', text: `Consultant shall provide the services and produce the deliverables described in the Quote referenced below (the "Quote"), which is incorporated herein by reference as though fully set forth in this Schedule A: Quote No.: ${quoteNo} — Quote Date: ${quoteDate}` },
    { type: 'body', text: 'In the event of any conflict between the terms of the Quote and this Schedule A regarding the specific scope, quantity, or cadence of deliverables, the Quote shall control; in all other respects, this Agreement (including this Schedule A) shall control.' },
    { type: 'h2', text: 'Deliverables' },
    { type: 'body', text: 'The specific service line items, deliverable quantities, cadence, and any included add-ons (e.g., managed ad spend, account management, publishing, community management) are as set forth in the Quote’s Cost Summary and "What’s Included" sections. A summary of the deliverables for reference is set out below:' },
    ...deliverableLines.map((line): Block => ({ type: 'bullet', text: line })),
    { type: 'body', text: 'Any change to the scope, quantity, or type of deliverables from what is reflected in the Quote shall require a written Change Order in accordance with Section 6.19 of the Agreement.' },
    { type: 'h2', text: 'Media Management & Access' },
    { type: 'bullet', text: 'Consultant shall provide Client with access to the E8 App system, where all raw footage and final edited files will be organized and stored.' },
    { type: 'h2', text: 'Client Responsibilities' },
    { type: 'bullet', text: 'Provide timely access to locations, personnel, branding assets, and social media accounts (e.g. logos, product details, brand guidelines), as applicable to the Services.' },
    { type: 'bullet', text: 'Designate a primary point of contact for scheduling, approvals, and communication.' },
    { type: 'bullet', text: 'Ensure all necessary appearance/location access and waivers are signed and returned, unless otherwise agreed.' },
    { type: 'h2', text: 'Revision Policy' },
    { type: 'bullet', text: `Includes up to ${revisionRounds} round(s) of reasonable revisions per deliverable, as further specified in the Quote.` },
    { type: 'bullet', text: 'Additional revision rounds may be subject to added fees at Consultant’s standard hourly rate.' },
    { type: 'h2', text: 'Ownership' },
    { type: 'body', text: 'All final content, raw footage, and associated files created by Consultant under this Schedule shall be the sole property of Client, subject to the license rights granted to Consultant in the Agreement.' },
    { type: 'h2', text: 'Content Delivery Method' },
    { type: 'body', text: 'All content will be delivered via E8 App with access granted to Client’s designated team members. Consultant will notify Client upon upload completion for each batch of deliverables.' },
  ];

  const scheduleBBlocks: Block[] = [
    { type: 'pagebreak' },
    { type: 'doctitle', text: 'SCHEDULE B – COST BREAKDOWN' },
    { type: 'body', text: `This Schedule B is attached to and incorporated by reference in the Professional Services Agreement between ${clientLegalName} and E8 Productions, LLC, effective as of ${effectiveDate}.` },
    { type: 'h2', text: 'Monthly Service Fee' },
    { type: 'body', text: `Client shall pay Consultant the Monthly Service Fee set forth in the Quote referenced below (the "Quote"), which is incorporated herein by reference. This fee covers the services and deliverables described in Schedule A and the Quote. Quote No.: ${quoteNo} — Monthly Service Fee: ${totalMonthlyCost}` },
    { type: 'body', text: 'In the event of any conflict between the fee amount stated in the Quote and any other document, the amount in the Quote most recently signed by both parties shall control.' },
    { type: 'h2', text: 'Additional Services' },
    { type: 'body', text: 'Any services requested by Client that fall outside the scope of the Deliverables described in Schedule A and the Quote shall require a separate written agreement or an updated Quote, and may be subject to additional fees, which will be agreed upon in writing.' },
    { type: 'h2', text: 'Additional Volume / Overages' },
    { type: 'body', text: 'Any request by Client for deliverables, ad spend, or other volume in excess of what is included in the then-current Quote (an "Overage") shall require a separate Quote covering the Overage, signed by both parties, before Consultant is obligated to perform the additional work. Consultant may, at its discretion, decline to begin work on an Overage until the corresponding Quote is signed.' },
    { type: 'h2', text: 'Payment Terms' },
    { type: 'body', text: 'For the initial service period, payment shall be divided into installments as set forth in the Quote, calculated relative to the Effective Date. Absent contrary instructions in the Quote, payment shall be due as follows: First Installment: due upon execution of the Agreement (the Effective Date). Following the initial service period, Consultant shall invoice Client for the Monthly Service Fee through Consultant’s standard billing platform(s) on a recurring monthly basis. Invoices are due upon receipt unless otherwise specified. Client shall be responsible for any applicable credit card, ACH, or payment processing fees, which may be included as a separate line item on the invoice. Consultant reserves the right to suspend Services if payment is not received within five (5) business days of the applicable due date, consistent with Section 2.3 of the Agreement.' },
    { type: 'h2', text: 'Proration' },
    { type: 'body', text: 'The Monthly Service Fee for the calendar month in which the Effective Date falls shall not be prorated and shall be charged in full, unless the Quote expressly states a prorated amount for that initial period. Each subsequent Monthly Service Fee shall be charged in full for the applicable billing cycle.' },
    { type: 'h2', text: 'Fee Adjustments' },
    { type: 'body', text: 'The Monthly Service Fee set forth in the Quote is fixed for the duration of the then-current Term and shall not be subject to adjustment during that Term unless mutually agreed to in writing by both parties. Consultant may adjust the Monthly Service Fee for any Renewal Term in accordance with Section 2.4 of the Agreement.' },
    { type: 'h2', text: 'Refund Policy' },
    { type: 'body', text: 'All fees paid to Consultant are non-refundable once the corresponding Services or Deliverables have been rendered, unless otherwise agreed in writing.' },
    { type: 'h2', text: 'Confidentiality of Billing Terms' },
    { type: 'body', text: 'The financial terms and billing structure outlined in the Quote and this Schedule shall be treated as Confidential Information and shall not be shared with any third party without the prior written consent of both parties, except as required by law.' },
    { type: 'h2', text: 'Taxes and Withholding' },
    { type: 'body', text: 'All fees and reimbursements outlined in this Schedule shall be paid in full without withholding or offset, unless required by law. Client shall be responsible for any applicable sales, use, or similar taxes imposed by a governmental authority.' },
  ];

  await renderBlocks(pdfDoc, [...scheduleABlocks, ...scheduleBBlocks]);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
