// scripts/upload-reference-doc.ts
//
// One-off CLI to create a "reference document" contract — uploads a PDF
// straight to a client's portal with no signature required, using the
// createReferenceDocument() function that already exists in the running
// codebase. This does NOT touch the Next.js/PM2 process at all — safe to
// run while an upload or anything else is in progress on the server.
//
// Usage (run from the my-app root, on the server):
//   npx tsx scripts/upload-reference-doc.ts \
//     --client <clientId> \
//     --title "Service Agreement — Acme Corp" \
//     --file /path/to/contract.pdf \
//     --created-by <yourAdminUserId>

import fs from 'fs';
import path from 'path';
// import { createReferenceDocument } from '../src/lib/contracts';
// import { prisma } from '../src/lib/prisma';
import { createReferenceDocument } from '../../src/lib/contracts';
import { prisma } from '../../src/lib/prisma';


function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const clientId = getArg('--client');
  const title = getArg('--title');
  const filePath = getArg('--file');
  const createdByArg = getArg('--created-by');

  if (!clientId || !title || !filePath || !createdByArg) {
    console.error(
      'Usage: npx tsx scripts/upload-reference-doc.ts --client <clientId> --title "Title" --file /path/to.pdf --created-by <adminUserId>'
    );
    process.exit(1);
  }

  const createdById = Number(createdByArg);
  if (!Number.isFinite(createdById)) {
    console.error('--created-by must be a numeric user id');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    console.error(`No client found with id: ${clientId}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(resolvedPath);
  const fileName = path.basename(resolvedPath);

  console.log(`Uploading "${fileName}" as "${title}" for client ${client.companyName || client.name || clientId}...`);

  const contract = await createReferenceDocument({
    buffer,
    fileName,
    title,
    clientId,
    createdById,
  });

  console.log(`Done. Contract id: ${contract.id}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});