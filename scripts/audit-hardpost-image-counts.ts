// Read-only audit: hard-post tasks currently in READY_FOR_QC or CLIENT_REVIEW
// whose active main-folder image count looks like leftover pile-up from the
// pre-replaceFileId bug (old rejected image never deactivated).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function isHardPost(deliverableType: string | null, monthlyType: string | null, oneOffType: string | null): boolean {
    const type = (deliverableType || monthlyType || oneOffType || "").toLowerCase().trim();
    return type === "hp" || type.includes("hard post") || type.includes("graphic image");
}

async function main() {
    const tasks = await prisma.task.findMany({
        where: { status: { in: ["READY_FOR_QC", "CLIENT_REVIEW"] as any } },
        select: {
            id: true,
            title: true,
            status: true,
            deliverableType: true,
            monthlyDeliverable: { select: { type: true } },
            oneOffDeliverable: { select: { type: true } },
            files: {
                where: { isActive: true },
                select: { id: true, name: true, mimeType: true, folderType: true, version: true, uploadedAt: true },
            },
        },
    });

    const hardPostTasks = tasks.filter((t) =>
        isHardPost(t.deliverableType, t.monthlyDeliverable?.type ?? null, t.oneOffDeliverable?.type ?? null)
    );

    console.log(`Hard-post tasks in READY_FOR_QC/CLIENT_REVIEW: ${hardPostTasks.length}`);

    const rows = hardPostTasks.map((t) => {
        const images = t.files.filter(
            (f) => (!f.folderType || f.folderType === "main") && (f.mimeType || "").startsWith("image/")
        );
        return {
            id: t.id,
            title: t.title,
            status: t.status,
            activeImageCount: images.length,
            images: images.map((f) => ({ name: f.name, version: f.version, uploadedAt: f.uploadedAt })),
        };
    });

    rows.sort((a, b) => b.activeImageCount - a.activeImageCount);

    console.log("\nFull distribution (sorted, most images first):");
    rows.forEach((r) => console.log(`  ${r.activeImageCount} active images — "${r.title}" (${r.status}) [${r.id}]`));

    const suspicious = rows.filter((r) => r.activeImageCount > 5);
    console.log(`\n⚠️  Tasks with MORE than 5 active images (likely pile-up): ${suspicious.length}`);
    suspicious.forEach((r) => {
        console.log(`\n--- ${r.title} [${r.id}] — ${r.activeImageCount} active images ---`);
        r.images.forEach((f) => console.log(`   v${f.version} | ${f.name} | uploaded ${f.uploadedAt}`));
    });
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
