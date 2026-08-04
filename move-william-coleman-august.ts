// move-william-coleman-august.ts
//
// Moves the specific set of misplaced raw-footage files (uploaded into the
// July folder by mistake on 2026-07-09/27) into the correct August folder.
//
// Usage:
//   npx tsx move-william-coleman-august.ts --dry-run   # preview only, no changes
//   npx tsx move-william-coleman-august.ts             # actually move the files
//
// Requires the same env vars as move-r2-files.ts: R2_ENDPOINT,
// R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (loaded via dotenv from .env).

import dotenv from "dotenv";
dotenv.config();

import { S3Client, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const R2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = "e8-app-r2-prod";
const SOURCE_PREFIX = "William Coleman/raw-footage/July-2026/LF/";
const DEST_PREFIX = "William Coleman/raw-footage/August-2026/LF/";

// The 92 files uploaded into the July folder by mistake (0200_D through
// 0291_D, per the Slack upload log — sequential, no gaps).
const FILENAMES = [
  "DJI_20260706091823_0200_D.MP4",
  "DJI_20260706100723_0201_D.MP4",
  "DJI_20260706100854_0202_D.MP4",
  "DJI_20260706101346_0203_D.MP4",
  "DJI_20260706110708_0204_D.MP4",
  "DJI_20260706111001_0205_D.MP4",
  "DJI_20260706111028_0206_D.MP4",
  "DJI_20260706112102_0207_D.MP4",
  "DJI_20260706112320_0208_D.MP4",
  "DJI_20260706112920_0209_D.MP4",
  "DJI_20260706120951_0210_D.MP4",
  "DJI_20260706125809_0211_D.MP4",
  "DJI_20260706154054_0212_D.MP4",
  "DJI_20260706154257_0213_D.MP4",
  "DJI_20260706154736_0214_D.MP4",
  "DJI_20260706161733_0215_D.MP4",
  "DJI_20260706162326_0216_D.MP4",
  "DJI_20260706171835_0217_D.MP4",
  "DJI_20260706171926_0218_D.MP4",
  "DJI_20260706172043_0219_D.MP4",
  "DJI_20260706172303_0220_D.MP4",
  "DJI_20260706173432_0221_D.MP4",
  "DJI_20260707090819_0222_D.MP4",
  "DJI_20260707091844_0223_D.MP4",
  "DJI_20260707102547_0224_D.MP4",
  "DJI_20260707103358_0225_D.MP4",
  "DJI_20260707103434_0226_D.MP4",
  "DJI_20260707103657_0227_D.MP4",
  "DJI_20260707103847_0228_D.MP4",
  "DJI_20260707104336_0229_D.MP4",
  "DJI_20260707104632_0230_D.MP4",
  "DJI_20260707104639_0231_D.MP4",
  "DJI_20260707122744_0232_D.MP4",
  "DJI_20260707123142_0233_D.MP4",
  "DJI_20260707134647_0234_D.MP4",
  "DJI_20260708082403_0235_D.MP4",
  "DJI_20260708083027_0236_D.MP4",
  "DJI_20260708083054_0237_D.MP4",
  "DJI_20260708083237_0238_D.MP4",
  "DJI_20260708084713_0239_D.MP4",
  "DJI_20260708084758_0240_D.MP4",
  "DJI_20260708084945_0241_D.MP4",
  "DJI_20260708085017_0242_D.MP4",
  "DJI_20260708085111_0243_D.MP4",
  "DJI_20260708085351_0244_D.MP4",
  "DJI_20260708085434_0245_D.MP4",
  "DJI_20260708085508_0246_D.MP4",
  "DJI_20260708085958_0247_D.MP4",
  "DJI_20260708092016_0248_D.MP4",
  "DJI_20260708093604_0249_D.MP4",
  "DJI_20260708101105_0250_D.MP4",
  "DJI_20260708101231_0251_D.MP4",
  "DJI_20260708110227_0252_D.MP4",
  "DJI_20260708113803_0253_D.MP4",
  "DJI_20260708114044_0254_D.MP4",
  "DJI_20260708134949_0255_D.MP4",
  "DJI_20260708135046_0256_D.MP4",
  "DJI_20260708135056_0257_D.MP4",
  "DJI_20260708135221_0258_D.MP4",
  "DJI_20260708142519_0259_D.MP4",
  "DJI_20260708152213_0260_D.MP4",
  "DJI_20260708154333_0261_D.MP4",
  "DJI_20260708155101_0262_D.MP4",
  "DJI_20260708160430_0263_D.MP4",
  "DJI_20260708160846_0264_D.MP4",
  "DJI_20260708181343_0265_D.MP4",
  "DJI_20260708183350_0266_D.MP4",
  "DJI_20260708185846_0267_D.MP4",
  "DJI_20260708191925_0268_D.MP4",
  "DJI_20260708195930_0269_D.MP4",
  "DJI_20260708201803_0270_D.MP4",
  "DJI_20260708201939_0271_D.MP4",
  "DJI_20260708202208_0272_D.MP4",
  "DJI_20260709070811_0273_D.MP4",
  "DJI_20260709080144_0274_D.MP4",
  "DJI_20260709080938_0275_D.MP4",
  "DJI_20260709090127_0276_D.MP4",
  "DJI_20260709090222_0277_D.MP4",
  "DJI_20260709090413_0278_D.MP4",
  "DJI_20260709092215_0279_D.MP4",
  "DJI_20260709092959_0280_D.MP4",
  "DJI_20260709101524_0281_D.MP4",
  "DJI_20260709104501_0282_D.MP4",
  "DJI_20260709144242_0283_D.MP4",
  "DJI_20260709170050_0284_D.MP4",
  "DJI_20260709170121_0285_D.MP4",
  "DJI_20260709170151_0286_D.MP4",
  "DJI_20260709170300_0287_D.MP4",
  "DJI_20260709170957_0288_D.MP4",
  "DJI_20260709182032_0289_D.MP4",
  "DJI_20260727210320_0290_D.MP4",
  "DJI_20260727211025_0291_D.MP4",
];

const DRY_RUN = process.argv.includes("--dry-run") || process.argv.includes("-n");

async function objectExists(key: string): Promise<boolean> {
  try {
    await R2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log(
    `\n${DRY_RUN ? "DRY RUN — no changes will be made" : "LIVE RUN — files will be moved"}\n` +
    `  FROM: ${SOURCE_PREFIX}\n` +
    `  TO:   ${DEST_PREFIX}\n` +
    `  Files: ${FILENAMES.length}\n`
  );

  let moved = 0, skippedMissing = 0, skippedExists = 0, failed = 0;

  for (const filename of FILENAMES) {
    const sourceKey = `${SOURCE_PREFIX}${filename}`;
    const destKey = `${DEST_PREFIX}${filename}`;

    const sourceOk = await objectExists(sourceKey);
    if (!sourceOk) {
      console.log(`  ⚠ SKIP (not found at source): ${filename}`);
      skippedMissing++;
      continue;
    }

    const destOk = await objectExists(destKey);
    if (destOk) {
      console.log(`  ⚠ SKIP (already exists at destination): ${filename}`);
      skippedExists++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  would move: ${filename}`);
      moved++;
      continue;
    }

    try {
      await R2.send(new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${encodeURIComponent(sourceKey).replace(/%2F/g, "/")}`,
        Key: destKey,
      }));
      await R2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: sourceKey }));
      console.log(`  ✓ ${filename}`);
      moved++;
    } catch (err) {
      console.error(`  ✗ ${filename}`, err);
      failed++;
    }
  }

  console.log(
    `\n${DRY_RUN ? "Dry run complete." : "Done."} ` +
    `${moved} ${DRY_RUN ? "would be moved" : "moved"}, ` +
    `${skippedMissing} missing at source, ${skippedExists} already at destination, ${failed} failed.`
  );
}

main().catch(console.error);