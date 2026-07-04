import { PDFDocument, rgb, degrees } from 'pdf-lib';

interface ServiceLine {
  description: string;
  details?: string;
  quantity: number;
  unitPrice: number; // in cents
  total: number;     // in cents
}

interface TermItem {
  title: string;
  body: string;
}

interface Quote {
  version: number;
  services: any; // ServiceLine[]
  notes: string | null;
  validDays: number;
  createdAt: Date | string;
  preparedBy: string;
  inclusions: any; // string[]
  terms: any; // TermItem[]
  acceptanceText: string | null;
  totalAmount: number;
}

interface PreClient {
  name: string;
  email: string;
  companyName: string | null;
  phone: string | null;
}

function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
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

export async function generateQuotePdf(quote: Quote, preClient: PreClient): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(
    // Create an empty PDF to write on
    await (await PDFDocument.create()).save()
  );
  
  const font = await pdfDoc.embedFont('Helvetica');
  const boldFont = await pdfDoc.embedFont('Helvetica-Bold');

  const width = 612; // Letter width
  const height = 792; // Letter height
  const margin = 36;
  const contentWidth = width - 2 * margin;

  let page = pdfDoc.addPage([width, height]);
  let y = height - 50;

  // Helper to draw watermark — mirrors accepted_stamp_e8.svg (double border, ACCEPTED text, divider, E8 PRODUCTIONS, LLC)
  const drawWatermark = (p: any) => {
    const cx = width / 2;
    const cy = height / 2;
    const opacity = 0.15;
    const green = rgb(0.224, 1.0, 0.078); // #39FF14

    // Outer border rect (rotated -8°)
    p.drawRectangle({
      x: cx - 220,
      y: cy - 90,
      width: 440,
      height: 180,
      borderColor: green,
      borderWidth: 4,
      opacity,
      rotate: degrees(-8),
    });
    // Inner border rect
    p.drawRectangle({
      x: cx - 208,
      y: cy - 78,
      width: 416,
      height: 156,
      borderColor: green,
      borderWidth: 1.5,
      opacity,
      rotate: degrees(-8),
    });

    // "ACCEPTED" main text
    p.drawText('ACCEPTED', {
      x: cx - 185,
      y: cy + 10,
      size: 56,
      font: boldFont,
      color: green,
      opacity,
      rotate: degrees(-8),
    });

    // Divider line
    p.drawLine({
      start: { x: cx - 170, y: cy - 18 },
      end:   { x: cx + 170, y: cy - 18 },
      thickness: 1.5,
      color: green,
      opacity,
    });

    // "E8 PRODUCTIONS, LLC" sub-text
    p.drawText('E8 PRODUCTIONS, LLC', {
      x: cx - 130,
      y: cy - 38,
      size: 18,
      font: boldFont,
      color: green,
      opacity,
      rotate: degrees(-8),
    });
  };

  // Always draw watermark since this is for the accepted quote email attachment
  drawWatermark(page);

  const checkPageBreak = (neededHeight: number) => {
    if (y - neededHeight < 50) {
      page = pdfDoc.addPage([width, height]);
      drawWatermark(page);
      y = height - 50;
    }
  };

  // 1. Header Logo
  page.drawText('E8', {
    x: margin,
    y: y - 10,
    size: 24,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText('Full Service Video + Content', {
    x: margin,
    y: y - 24,
    size: 9,
    font: font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Header Details (Right side)
  const qNum = `E8-${new Date(quote.createdAt).getFullYear()}-${String(quote.version).padStart(4, '0')}`;
  const qDate = new Date(quote.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const qValid = new Date(new Date(quote.createdAt).getTime() + quote.validDays * 86400000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  page.drawText(`Quote No. ${qNum}`, { x: width - margin - 150, y: y - 5, size: 10, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(`Date: ${qDate}`, { x: width - margin - 150, y: y - 18, size: 10, font: font, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`Valid Until: ${qValid}`, { x: width - margin - 150, y: y - 31, size: 10, font: font, color: rgb(0.1, 0.34, 0.86) });

  y -= 50;

  // Blue Separator Line
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 2.5,
    color: rgb(0.1, 0.34, 0.86),
  });

  y -= 25;

  // Title
  page.drawText('MONTHLY SERVICE QUOTE', {
    x: margin,
    y,
    size: 16,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  y -= 25;

  // Prepared For / Prepared By metadata box
  page.drawRectangle({
    x: margin,
    y: y - 50,
    width: contentWidth,
    height: 60,
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.98),
  });

  // Labels & Values inside box
  page.drawText('PREPARED FOR', { x: margin + 12, y: y - 8, size: 8, font: boldFont, color: rgb(0.1, 0.34, 0.86) });
  page.drawText(`${preClient.name}${preClient.companyName ? `, ${preClient.companyName}` : ''}`, { x: margin + 12, y: y - 22, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(preClient.email, { x: margin + 12, y: y - 34, size: 9, font: font, color: rgb(0.4, 0.4, 0.4) });

  page.drawText('PREPARED BY', { x: width / 2 + 12, y: y - 8, size: 8, font: boldFont, color: rgb(0.1, 0.34, 0.86) });
  page.drawText(quote.preparedBy || 'E8 Productions Team', { x: width / 2 + 12, y: y - 22, size: 11, font: font, color: rgb(0.1, 0.1, 0.1) });

  y -= 70;

  // Intro text block
  checkPageBreak(30);
  page.drawText('Thank you for the opportunity. Below is your monthly engagement for full-service social media content', {
    x: margin,
    y,
    size: 11,
    font: font,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 14;
  page.drawText('production, publishing, and management across five platforms.', {
    x: margin,
    y,
    size: 11,
    font: font,
    color: rgb(0.2, 0.2, 0.2),
  });

  y -= 30;

  // 2. Cost Summary Table
  checkPageBreak(60);
  page.drawText('COST SUMMARY', { x: margin, y, size: 10, font: boldFont, color: rgb(0.1, 0.34, 0.86) });
  y -= 16;

  // Table header background
  page.drawRectangle({
    x: margin,
    y: y - 20,
    width: contentWidth,
    height: 20,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Table Headers
  page.drawText('SERVICE', { x: margin + 10, y: y - 14, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('DESCRIPTION', { x: margin + 150, y: y - 14, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('MONTHLY', { x: width - margin - 60, y: y - 14, size: 8, font: boldFont, color: rgb(1, 1, 1) });

  y -= 20;

  const services = (quote.services as ServiceLine[]) || [];
  for (const s of services) {
    const descLines = wrapText(s.description || '', 280, font, 9);
    const neededTableHeight = Math.max(16, descLines.length * 12) + 12;
    checkPageBreak(neededTableHeight);

    // Row separator line
    page.drawLine({
      start: { x: margin, y: y - neededTableHeight },
      end: { x: width - margin, y: y - neededTableHeight },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9),
    });

    // Content
    page.drawText(s.description.substring(0, 20), { x: margin + 10, y: y - 16, size: 9, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    
    let lineY = y - 16;
    for (const line of descLines) {
      page.drawText(line, { x: margin + 150, y: lineY, size: 9, font: font, color: rgb(0.3, 0.3, 0.3) });
      lineY -= 12;
    }

    const priceFormatted = `$${(s.total / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    page.drawText(priceFormatted, { x: width - margin - 60, y: y - 16, size: 9, font: font, color: rgb(0.1, 0.1, 0.1) });

    y -= neededTableHeight;
  }

  // Table Total Footer
  checkPageBreak(25);
  page.drawRectangle({
    x: margin,
    y: y - 22,
    width: contentWidth,
    height: 22,
    color: rgb(0.1, 0.34, 0.86),
  });
  page.drawText('TOTAL MONTHLY COST', { x: margin + 10, y: y - 15, size: 9, font: boldFont, color: rgb(1, 1, 1) });
  const totalFormatted = `$${(quote.totalAmount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  page.drawText(totalFormatted, { x: width - margin - 80, y: y - 15, size: 10, font: boldFont, color: rgb(1, 1, 1) });

  y -= 45;

  // 3. What's Included Every Month
  const inclusions = (quote.inclusions as string[]) || [];
  if (inclusions.length > 0) {
    checkPageBreak(30);
    page.drawText("WHAT'S INCLUDED EVERY MONTH:", { x: margin, y, size: 10, font: boldFont, color: rgb(0.1, 0.34, 0.86) });
    y -= 16;

    for (const inc of inclusions) {
      const incLines = wrapText(inc, contentWidth - 30, font, 9);
      checkPageBreak(incLines.length * 13 + 5);

      let lineY = y;
      // Draw standard bullet circle
      page.drawCircle({
        x: margin + 8,
        y: lineY + 3,
        size: 2,
        color: rgb(0.2, 0.2, 0.2),
      });

      for (const line of incLines) {
        page.drawText(line, { x: margin + 20, y: lineY, size: 9, font: font, color: rgb(0.2, 0.2, 0.2) });
        lineY -= 12;
      }
      y = lineY - 4;
    }
    y -= 15;
  }

  // 4. Terms
  const terms = (quote.terms as TermItem[]) || [];
  if (terms.length > 0) {
    checkPageBreak(30);
    page.drawText('TERMS:', { x: margin, y, size: 10, font: boldFont, color: rgb(0.1, 0.34, 0.86) });
    y -= 16;

    let termIndex = 1;
    for (const term of terms) {
      const fullTermText = `${term.title} ${term.body}`;
      const termLines = wrapText(fullTermText, contentWidth - 30, font, 9);
      checkPageBreak(termLines.length * 13 + 5);

      let lineY = y;
      // Draw list number
      page.drawText(`${termIndex}.`, { x: margin + 4, y: lineY, size: 9, font: boldFont, color: rgb(0.2, 0.2, 0.2) });

      for (let i = 0; i < termLines.length; i++) {
        page.drawText(termLines[i], { x: margin + 20, y: lineY, size: 9, font: font, color: rgb(0.2, 0.2, 0.2) });
        lineY -= 12;
      }
      y = lineY - 4;
      termIndex++;
    }
    y -= 15;
  }

  // 5. Acceptance & Signatures
  if (quote.acceptanceText) {
    const accLines = wrapText(quote.acceptanceText, contentWidth, font, 9);
    checkPageBreak(accLines.length * 13 + 50);

    page.drawText('ACCEPTANCE:', { x: margin, y, size: 10, font: boldFont, color: rgb(0.1, 0.34, 0.86) });
    y -= 16;

    for (const line of accLines) {
      page.drawText(line, { x: margin, y, size: 9, font: font, color: rgb(0.2, 0.2, 0.2) });
      y -= 12;
    }

    y -= 25;

    // Signature lines
    page.drawLine({ start: { x: margin, y }, end: { x: margin + 200, y }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
    page.drawLine({ start: { x: width - margin - 200, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });

    y -= 12;
    page.drawText('AUTHORIZED SIGNATURE', { x: margin, y, size: 8, font: font, color: rgb(0.5, 0.5, 0.5) });
    page.drawText('DATE', { x: width - margin - 200, y, size: 8, font: font, color: rgb(0.5, 0.5, 0.5) });
  }

  // 6. Professional Footer
  const pageCount = pdfDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const p = pdfDoc.getPage(i);
    // Draw footer line
    p.drawLine({
      start: { x: margin, y: 35 },
      end: { x: width - margin, y: 35 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    p.drawText(`Page ${i + 1} of ${pageCount}`, {
      x: width - margin - 50,
      y: 22,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    p.drawText('E8 Productions LLC • e8productions.com', {
      x: margin,
      y: 22,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
