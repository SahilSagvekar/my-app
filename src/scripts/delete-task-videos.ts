// scripts/delete-task-videos.ts
//
// Deletes just the VIDEO files attached to a client's tasks for one month
// (e.g. clean up storage for an old, fully-delivered month) — everything
// else about those tasks (the task rows, thumbnails, covers, music-license
// PDFs, task history) is left untouched.
//
// SAFETY MODEL (same shape as scripts/delete-client-data.ts):
//   - Defaults to DRY RUN. Nothing is deleted unless you pass --confirm.
//   - Always run without --confirm first and read the report.
//   - Default behavior is a SOFT delete: the R2 object is removed, but the
//     File row stays in the DB with deletedFromCloud=true/deletedFromCloudAt
//     set — the same flag the NAS-sweep cleanup flow already uses (see
//     /api/admin/nas-sweep/delete-archived), so the task's history and file
//     list stay intact; the app should treat it like an archived file. Pass
//     --hard-delete to instead remove the File row entirely (this writes an
//     AuditLog "FILE_DELETED" entry per file, same as the in-app delete
//     flow in src/lib/file-deletion.ts — a hard delete makes the file
//     disappear from the task's file list completely, not just show as
//     archived).
//   - Skips any file that's already deletedFromCloud (idempotent — safe to
//     re-run).
//   - R2 delete errors for one file don't stop the run; they're collected
//     and printed at the end so you can retry just those.
//
// "Video" = File.mimeType starting with "video/", OR (as a fallback, since
// some older rows have a null mimeType) a recognized video file extension.
//
// USAGE:
//   npx tsx scripts/delete-task-videos.ts --client=MissBehaveTV --month="August 2026"
//   npx tsx scripts/delete-task-videos.ts --client=... --month="August 2026" --confirm
//   npx tsx scripts/delete-task-videos.ts --client=... --month="August 2026" --confirm --hard-delete
//
// Run the first form as many times as you like — it's read-only. If you
// pass a month that doesn't match any task, the script prints every month
// that DOES exist for that client so you can fix a typo.

// NOTE: this deliberately does NOT go through src/lib/prisma.ts's manual
// Neon-adapter Pool. That singleton builds its connection string from
// process.env.DATABASE_URL directly, so it depends entirely on dotenv load
// order — if a placeholder DATABASE_URL is committed to .env, dotenv's
// default "don't override an already-set var" behavior means a later,
// correct value in .env.local silently never takes effect, even though
// process.env.DATABASE_URL still reads as truthy at the point it's checked.
// Using a plain `new PrismaClient()` here instead sidesteps all of that:
// Prisma resolves its own datasource env var independently, the same way
// the other scripts in this repo (e.g. src/scripts/delete-march-tasks.ts)
// already do successfully. This also means the script works from either
// scripts/ or src/scripts/ — it no longer has a relative import to
// src/lib/prisma that would break depending on which directory it's run
// from.
import { PrismaClient } from "@prisma/client";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || "e8-app-r2-prod";

const VIDEO_EXTENSIONS = ["mp4", "mov", "mkv", "avi", "webm", "m4v", "mts", "m2ts", "wmv"];

interface Args {
  client: string;
  month: string;
  confirm: boolean;
  hardDelete: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const clientArg = args.find((a) => a.startsWith("--client="));
  const monthArg = args.find((a) => a.startsWith("--month="));
  const confirm = args.includes("--confirm");
  const hardDelete = args.includes("--hard-delete");

  if (!clientArg || !monthArg) {
    console.error(
      "❌ Missing required arguments.\n\n" +
        "Usage:\n" +
        '  npx tsx scripts/delete-task-videos.ts --client=<clientId|email|companyName> --month="August 2026"              (dry run)\n' +
        '  npx tsx scripts/delete-task-videos.ts --client=<clientId|email|companyName> --month="August 2026" --confirm     (execute, soft delete)\n' +
        "  ... --confirm --hard-delete   (also removes the File row, not just the R2 object)\n"
    );
    process.exit(1);
  }

  return {
    client: clientArg.split("=").slice(1).join("="),
    month: monthArg.split("=").slice(1).join("="),
    confirm,
    hardDelete,
  };
}

async function resolveClient(identifier: string) {
  const client = await prisma.client.findFirst({
    where: {
      OR: [
        { id: identifier },
        { email: { equals: identifier, mode: "insensitive" } },
        { companyName: { equals: identifier, mode: "insensitive" } },
        { name: { equals: identifier, mode: "insensitive" } },
      ],
    },
  });

  if (!client) {
    console.error(`❌ No client found matching "${identifier}" (checked id, email, companyName, name)`);
    process.exit(1);
  }

  return client;
}

function isVideoFile(mimeType: string | null, name: string): boolean {
  if (mimeType?.startsWith("video/")) return true;
  const ext = name.toLowerCase().split(".").pop() || "";
  return VIDEO_EXTENSIONS.includes(ext);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function main() {
  const { client: identifier, month, confirm, hardDelete } = parseArgs();
  const client = await resolveClient(identifier);

  console.log("=".repeat(70));
  console.log(confirm ? "🔥 EXECUTING DELETION" : "🔍 DRY RUN (no data will be changed)");
  console.log("=".repeat(70));
  console.log(`Client:  ${client.companyName || client.name} (${client.email})`);
  console.log(`ID:      ${client.id}`);
  console.log(`Month:   ${month}`);
  console.log(`Mode:    ${hardDelete ? "HARD delete (removes File rows)" : "SOFT delete (R2 object only, File rows kept as archived)"}`);
  console.log("=".repeat(70));

  const tasks = await prisma.task.findMany({
    where: { clientId: client.id, monthFolder: month },
    select: { id: true, title: true, monthFolder: true },
  });

  if (tasks.length === 0) {
    const availableMonths = await prisma.task.findMany({
      where: { clientId: client.id, monthFolder: { not: null } },
      select: { monthFolder: true },
      distinct: ["monthFolder"],
    });
    console.error(`\n❌ No tasks found for this client with monthFolder = "${month}".`);
    if (availableMonths.length) {
      console.error("\nMonths that DO exist for this client:");
      availableMonths.forEach((m) => console.error(`  - ${m.monthFolder}`));
    } else {
      console.error("This client has no tasks with a monthFolder set at all.");
    }
    await prisma.$disconnect();
    process.exit(1);
  }

  const taskIds = tasks.map((t) => t.id);

  const candidateFiles = await prisma.file.findMany({
    where: { taskId: { in: taskIds } },
    select: {
      id: true,
      taskId: true,
      name: true,
      mimeType: true,
      s3Key: true,
      size: true,
      folderType: true,
      deletedFromCloud: true,
    },
  });

  const videoFiles = candidateFiles.filter((f) => isVideoFile(f.mimeType, f.name));
  const alreadyGone = videoFiles.filter((f) => f.deletedFromCloud);
  const toDelete = videoFiles.filter((f) => !f.deletedFromCloud && f.s3Key);
  const noKey = videoFiles.filter((f) => !f.deletedFromCloud && !f.s3Key);

  const totalBytes = toDelete.reduce((sum, f) => sum + Number(f.size || 0), 0);
  const taskTitleById = new Map(tasks.map((t) => [t.id, t.title || t.id]));

  console.log(`\nTasks matched:               ${tasks.length}`);
  console.log(`Video files found:           ${videoFiles.length}`);
  console.log(`  ↳ already deleted from cloud (skipped): ${alreadyGone.length}`);
  console.log(`  ↳ no s3Key on record (skipped):         ${noKey.length}`);
  console.log(`  ↳ will be deleted:                      ${toDelete.length}`);
  console.log(`Total size to reclaim:        ${formatBytes(totalBytes)}`);

  if (toDelete.length > 0) {
    console.log("\nFiles:");
    for (const f of toDelete) {
      console.log(`  - ${f.name}  (${formatBytes(Number(f.size || 0))})  task="${taskTitleById.get(f.taskId)}"  key=${f.s3Key}`);
    }
  }

  if (toDelete.length === 0) {
    console.log("\nNothing to delete.");
    await prisma.$disconnect();
    return;
  }

  if (!confirm) {
    console.log("\n" + "=".repeat(70));
    console.log("Dry run only — nothing was changed. Re-run with --confirm to execute.");
    console.log("=".repeat(70));
    await prisma.$disconnect();
    return;
  }

  console.log(`\n🔥 Deleting ${toDelete.length} file(s)...\n`);

  const deleted: string[] = [];
  const failed: { id: string; name: string; reason: string }[] = [];

  for (const f of toDelete) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: f.s3Key! }));

      if (hardDelete) {
        await prisma.file.delete({ where: { id: f.id } });
        await prisma.auditLog.create({
          data: {
            userId: null,
            action: "FILE_DELETED",
            entity: "File",
            entityId: f.id,
            details: `Deleted "${f.name}" from task ${f.taskId} via delete-task-videos.ts (client=${client.id}, month=${month})`,
            metadata: { taskId: f.taskId, fileName: f.name, s3Key: f.s3Key, clientId: client.id, month },
          },
        });
      } else {
        await prisma.file.update({
          where: { id: f.id },
          data: { deletedFromCloud: true, deletedFromCloudAt: new Date() },
        });
      }

      deleted.push(f.id);
      console.log(`  ✅ ${f.name}`);
    } catch (err: any) {
      failed.push({ id: f.id, name: f.name, reason: err.message || String(err) });
      console.log(`  ❌ ${f.name} — ${err.message || err}`);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(`Done. Deleted ${deleted.length}/${toDelete.length}. Reclaimed ~${formatBytes(totalBytes)}.`);
  if (failed.length) {
    console.log(`\n⚠️  ${failed.length} file(s) failed — re-run the script (same args) to retry just these:`);
    failed.forEach((f) => console.log(`  - ${f.name} [${f.id}]: ${f.reason}`));
  }
  console.log("=".repeat(70));

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("❌ Failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});