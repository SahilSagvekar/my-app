import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

const TAX_CLASSIFICATIONS = [
  'individual',
  'c_corp',
  's_corp',
  'partnership',
  'trust_estate',
  'llc',
  'other',
] as const;

export type W9TaxClassification = (typeof TAX_CLASSIFICATIONS)[number];

export interface W9Input {
  name: string;
  businessName?: string;
  taxClassification: W9TaxClassification;
  llcClassificationLetter?: string; // only when taxClassification === 'llc' (C/S/P)
  otherDescription?: string; // only when taxClassification === 'other'
  address: string;
  cityStateZip: string;
  ssn?: string; // digits only, e.g. "123456789"
  ein?: string; // digits only, e.g. "123456789"
  signedName: string;
  signedDate: string; // e.g. "07/11/2026"
}

function formPath() {
  return path.join(process.cwd(), 'src/lib/forms/fw9.pdf');
}

export async function fillW9Pdf(input: W9Input): Promise<Buffer> {
  const bytes = fs.readFileSync(formPath());
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();

  const text = (name: string, value?: string) => {
    if (!value) return;
    form.getTextField(name).setText(value);
  };

  text('topmostSubform[0].Page1[0].f1_01[0]', input.name);
  text('topmostSubform[0].Page1[0].f1_02[0]', input.businessName);

  const classificationBoxIndex = TAX_CLASSIFICATIONS.indexOf(input.taxClassification);
  if (classificationBoxIndex >= 0) {
    form
      .getCheckBox(
        `topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[${classificationBoxIndex}]`
      )
      .check();
  }
  if (input.taxClassification === 'llc') {
    text(
      'topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_03[0]',
      input.llcClassificationLetter
    );
  }
  if (input.taxClassification === 'other') {
    text('topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_04[0]', input.otherDescription);
  }

  text('topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_07[0]', input.address);
  text('topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_08[0]', input.cityStateZip);

  if (input.ssn && input.ssn.replace(/\D/g, '').length === 9) {
    const digits = input.ssn.replace(/\D/g, '');
    text('topmostSubform[0].Page1[0].f1_11[0]', digits.slice(0, 3));
    text('topmostSubform[0].Page1[0].f1_12[0]', digits.slice(3, 5));
    text('topmostSubform[0].Page1[0].f1_13[0]', digits.slice(5, 9));
  }
  if (input.ein && input.ein.replace(/\D/g, '').length === 9) {
    const digits = input.ein.replace(/\D/g, '');
    text('topmostSubform[0].Page1[0].f1_14[0]', digits.slice(0, 2));
    text('topmostSubform[0].Page1[0].f1_15[0]', digits.slice(2, 9));
  }

  form.flatten();

  const page = pdf.getPage(0);
  const { height } = page.getSize();
  page.drawText(`Signed electronically by: ${input.signedName}`, {
    x: 50,
    y: height - 705,
    size: 9,
  });
  page.drawText(`Date: ${input.signedDate}`, {
    x: 400,
    y: height - 705,
    size: 9,
  });

  const outBytes = await pdf.save();
  return Buffer.from(outBytes);
}
