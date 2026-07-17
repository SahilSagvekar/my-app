// One-off: seeds PortfolioJourneyClient rows for the clients that were
// previously hardcoded in src/components/landing/BeforeAfterJourney.tsx,
// so nothing gets lost when that component switches to reading from the DB.
// Run manually once, after the PortfolioJourneyClient/Step migration:
//   npx tsx scripts/seed-portfolio-journey-clients.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const CLIENTS = [
    { label: "Cole", sublabel: "YouTube", iconKey: "youtube" },
    { label: "Cole", sublabel: "Facebook", iconKey: "facebook" },
    { label: "Investment Joy", sublabel: null, iconKey: null },
    { label: "Peter Mayberry", sublabel: null, iconKey: null },
    { label: "CLA", sublabel: null, iconKey: null },
    { label: "Following Keenan", sublabel: null, iconKey: null },
    { label: "Danny D'Angelo", sublabel: null, iconKey: null },
    { label: "The Dating Blind Show", sublabel: null, iconKey: null },
];

async function main() {
    for (let i = 0; i < CLIENTS.length; i++) {
        const c = CLIENTS[i];
        const existing = await prisma.portfolioJourneyClient.findFirst({
            where: { label: c.label, sublabel: c.sublabel },
        });
        if (existing) {
            console.log(`Skipping "${c.label}${c.sublabel ? ` / ${c.sublabel}` : ""}" — already exists`);
            continue;
        }
        await prisma.portfolioJourneyClient.create({
            data: { ...c, order: i },
        });
        console.log(`Created "${c.label}${c.sublabel ? ` / ${c.sublabel}` : ""}"`);
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
