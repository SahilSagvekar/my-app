/**
 * Seed PostingTargets from the existing STATIC_POSTING_DATA
 * Run: npx tsx scripts/seed-posting-targets.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PlatformData {
  name: string;
  sf?: number;
  bsf?: number;
  sqf?: number;
  hp?: number;
  lf?: number;
  lfPer?: string;
  sep?: number;
  sepPer?: string;
  tiles?: boolean;
  thumb?: boolean;
  note?: string;
}

interface ClientData {
  clientName: string;
  platforms: PlatformData[];
}

const STATIC_POSTING_DATA: ClientData[] = [
  {
    clientName: 'The Drew Meyers',
    platforms: [
      { name: 'IG (Trials)', sf: 4, bsf: 1 },
      { name: 'FB Profile', sf: 4, bsf: 1, sqf: 1 },
      { name: 'FB Page', sf: 4, bsf: 1, sqf: 1 },
      { name: 'TT', sf: 4, bsf: 1 },
      { name: 'YT', sf: 4, bsf: 1 },
      { name: 'Snapchat', sep: 3, sepPer: 'week', tiles: true },
    ]
  },
  {
    clientName: 'The Dating Blind Show',
    platforms: [
      { name: 'IG (Trials)', sf: 4, bsf: 1 },
      { name: 'FB TV', sf: 4, sqf: 2, bsf: 1, lf: 1, lfPer: 'week', note: 'every Sunday' },
      { name: 'YT', sf: 4, bsf: 1 },
      { name: 'TT', sf: 4, bsf: 1 },
      { name: 'Snapchat', sep: 3, sepPer: 'week', tiles: true },
    ]
  },
  {
    clientName: 'InvestmentJoy',
    platforms: [
      { name: 'FB TV', sf: 4, sqf: 1, hp: 2, lf: 1, thumb: true },
    ]
  },
  {
    clientName: 'MissBehaveTV',
    platforms: [
      { name: 'FB TV', sf: 4, bsf: 1, sqf: 2 },
      { name: 'IG (Trials)', sf: 4, bsf: 1 },
      { name: 'YT', sf: 4, bsf: 1 },
      { name: 'TT', sf: 4, bsf: 1 },
      { name: 'Snapchat', sep: 2, sepPer: 'week', tiles: true },
    ]
  },
  {
    clientName: 'Coin Laundry Association',
    platforms: [
      { name: 'IG (Trials)', sf: 2 },
      { name: 'TT', sf: 2 },
      { name: 'YT', sf: 2, lf: 1, lfPer: 'week', thumb: true, note: 'every sunday' },
      { name: 'FB TV', sf: 2, lf: 1, lfPer: 'week', thumb: true, note: 'every sunday' },
      { name: 'LI', sf: 2, lf: 1, lfPer: 'week', thumb: true, note: 'every sunday' },
    ]
  },
  {
    clientName: 'Soda City Simpson',
    platforms: [
      { name: 'IG (Trials)', sf: 6 },
      { name: 'TT', sf: 6 },
      { name: 'FB TV', sf: 6, sqf: 1, lf: 1, lfPer: 'week', note: 'every sunday' },
      { name: 'YT', sf: 6, lf: 1, lfPer: 'week', note: 'every sunday' },
    ]
  },
  {
    clientName: 'Free Laundromat, LLC',
    platforms: [
      { name: 'IG', sf: 2 },
      { name: 'FB TV', sf: 2 },
      { name: 'TT', sf: 2 },
    ]
  },
  {
    clientName: 'William Coleman',
    platforms: [
      { name: 'FB TV', sf: 1, lf: 1, lfPer: 'week', note: 'every sunday' },
      { name: 'YT', sf: 1, lf: 1, lfPer: 'week', note: 'every sunday' },
      { name: 'TT', sf: 1 },
      { name: 'IG (Trials)', sf: 1 },
    ]
  },
];

async function main() {
  console.log('🎯 Seeding PostingTargets...\n');

  let totalCreated = 0;
  let skipped = 0;

  for (const clientData of STATIC_POSTING_DATA) {
    // Find client by name or companyName
    const client = await prisma.client.findFirst({
      where: {
        OR: [
          { name: { contains: clientData.clientName, mode: 'insensitive' } },
          { companyName: { contains: clientData.clientName, mode: 'insensitive' } },
        ],
      },
    });

    if (!client) {
      console.log(`⚠️  Client not found: "${clientData.clientName}" — skipping`);
      skipped++;
      continue;
    }

    console.log(`✅ ${clientData.clientName} → ${client.id}`);

    // Delete existing targets for this client
    await prisma.postingTarget.deleteMany({ where: { clientId: client.id } });

    // Create targets for each platform
    for (const platform of clientData.platforms) {
      const targets: Array<{
        clientId: string;
        platform: string;
        deliverableType: string;
        count: number;
        frequency: string;
        extras: any;
      }> = [];

      if (platform.sf) {
        targets.push({
          clientId: client.id,
          platform: platform.name,
          deliverableType: 'SF',
          count: platform.sf,
          frequency: 'daily',
          extras: null,
        });
      }
      if (platform.bsf) {
        targets.push({
          clientId: client.id,
          platform: platform.name,
          deliverableType: 'BSF',
          count: platform.bsf,
          frequency: 'daily',
          extras: null,
        });
      }
      if (platform.sqf) {
        targets.push({
          clientId: client.id,
          platform: platform.name,
          deliverableType: 'SQF',
          count: platform.sqf,
          frequency: 'daily',
          extras: null,
        });
      }
      if (platform.hp) {
        targets.push({
          clientId: client.id,
          platform: platform.name,
          deliverableType: 'HP',
          count: platform.hp,
          frequency: 'daily',
          extras: platform.thumb ? { thumb: true } : null,
        });
      }
      if (platform.lf) {
        const note = platform.note?.toLowerCase();
        const frequency = note?.includes('sunday') ? 'sunday' : (platform.lfPer === 'week' ? 'weekly' : 'daily');
        targets.push({
          clientId: client.id,
          platform: platform.name,
          deliverableType: 'LF',
          count: platform.lf,
          frequency,
          extras: {
            ...(platform.thumb ? { thumb: true } : {}),
            ...(platform.note ? { note: platform.note } : {}),
          },
        });
      }
      if (platform.sep) {
        targets.push({
          clientId: client.id,
          platform: platform.name,
          deliverableType: 'SEP',
          count: platform.sep,
          frequency: platform.sepPer === 'week' ? 'weekly' : 'daily',
          extras: {
            ...(platform.tiles ? { tiles: true } : {}),
          },
        });
      }

      if (targets.length > 0) {
        await prisma.postingTarget.createMany({ data: targets });
        totalCreated += targets.length;
        console.log(`   📌 ${platform.name}: ${targets.map(t => `${t.count} ${t.deliverableType}/${t.frequency}`).join(', ')}`);
      }
    }
    console.log('');
  }

  console.log(`\n🏁 Done! Created ${totalCreated} targets. Skipped ${skipped} clients.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());