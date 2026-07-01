// scripts/delete-client-data.ts
//
// Deletes a Client and every related record across the schema.
//
// SAFETY MODEL:
//   - Defaults to DRY RUN. Nothing is deleted unless you pass --confirm.
//   - Always run without --confirm first and read the counts.
//   - Wrapped in a single Prisma transaction — if anything fails, nothing
//     is committed (all-or-nothing).
//   - Does NOT touch R2/S3 files or Drive files. It only prints the S3 keys
//     that will be orphaned so you can clean them up separately (see
//     "S3 CLEANUP" section printed at the end). This is deliberate — deleting
//     cloud storage objects is a separate, irreversible action and shouldn't
//     be silently bundled into a DB deletion script.
//   - Does NOT delete the Client's linked User account(s) unless you pass
//     --include-users. By default it only unlinks them (sets
//     linkedClientId = null) so employee/team-member User rows are never
//     touched. The client's own portal login (Client.userId) is deleted
//     only with --include-users too.
//
// USAGE:
//   npx tsx scripts/delete-client-data.ts --client=<clientId|email>
//   npx tsx scripts/delete-client-data.ts --client=<clientId|email> --confirm
//   npx tsx scripts/delete-client-data.ts --client=<clientId|email> --confirm --include-users
//
// Run the first form as many times as you like — it's read-only.

import { prisma } from "../src/lib/prisma";
import fs from "fs";
import path from "path";

interface Args {
  client: string;
  confirm: boolean;
  includeUsers: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const clientArg = args.find((a) => a.startsWith("--client="));
  const confirm = args.includes("--confirm");
  const includeUsers = args.includes("--include-users");

  if (!clientArg) {
    console.error(
      "❌ Missing --client=<clientId|email>\n\n" +
        "Usage:\n" +
        "  npx tsx scripts/delete-client-data.ts --client=<clientId|email>              (dry run)\n" +
        "  npx tsx scripts/delete-client-data.ts --client=<clientId|email> --confirm     (execute)\n" +
        "  ... --confirm --include-users   (also deletes/unlinks the client's User accounts)\n"
    );
    process.exit(1);
  }

  return { client: clientArg.split("=").slice(1).join("="), confirm, includeUsers };
}

async function resolveClient(identifier: string) {
  // Accept either a raw Client.id (cuid) or an email address for convenience.
  const client = await prisma.client.findFirst({
    where: {
      OR: [{ id: identifier }, { email: identifier }],
    },
  });

  if (!client) {
    console.error(`❌ No client found matching "${identifier}" (checked id and email)`);
    process.exit(1);
  }

  return client;
}

async function main() {
  const { client: identifier, confirm, includeUsers } = parseArgs();
  const client = await resolveClient(identifier);

  console.log("=".repeat(70));
  console.log(confirm ? "🔥 EXECUTING DELETION" : "🔍 DRY RUN (no data will be changed)");
  console.log("=".repeat(70));
  console.log(`Client: ${client.name} (${client.email})`);
  console.log(`ID:     ${client.id}`);
  console.log(`Status: ${client.status}`);
  console.log("=".repeat(70));

  // ── Gather everything up front (read-only) ──────────────────────────────
  const clientId = client.id;

  const [tasks, socialAccounts] = await Promise.all([
    prisma.task.findMany({ where: { clientId }, select: { id: true, invoiceId: true } }),
    prisma.socialAccount.findMany({ where: { clientId }, select: { id: true } }),
  ]);
  const taskIds = tasks.map((t) => t.id);
  const socialAccountIds = socialAccounts.map((s) => s.id);

  // Files are cascade-deleted with their Task in the DB, but we still need
  // their S3 keys before that happens so nothing is silently orphaned in R2.
  const files = taskIds.length
    ? await prisma.file.findMany({
        where: { taskId: { in: taskIds } },
        select: { id: true, s3Key: true, name: true, nasPath: true },
      })
    : [];

  const [
    socialPostCount,
    editorEodItemCount,
    socialAnalyticsCount,
    recurringTaskCount,
    monthlyDeliverableCount,
    oneOffDeliverableCount,
    brandAssetCount,
    monthlyRunCount,
    jobCount,
    guidelineCount,
    stripeCustomer,
    linkedUsers,
  ] = await Promise.all([
    prisma.socialPost.count({
      where: {
        OR: [
          taskIds.length ? { taskId: { in: taskIds } } : { id: "___none___" },
          socialAccountIds.length ? { socialAccountId: { in: socialAccountIds } } : { id: "___none___" },
        ],
      },
    }),
    taskIds.length
      ? prisma.editorEodReportItem.count({ where: { taskId: { in: taskIds } } })
      : Promise.resolve(0),
    socialAccountIds.length
      ? prisma.socialAnalytics.count({ where: { socialAccountId: { in: socialAccountIds } } })
      : Promise.resolve(0),
    prisma.recurringTask.count({ where: { clientId } }),
    prisma.monthlyDeliverable.count({ where: { clientId } }),
    prisma.oneOffDeliverable.count({ where: { clientId } }),
    prisma.brandAsset.count({ where: { clientId } }),
    prisma.monthlyRun.count({ where: { clientId } }),
    prisma.job.count({ where: { clientId } }),
    prisma.guideline.count({ where: { clientId } }),
    prisma.stripeCustomer.findUnique({
      where: { clientId },
      include: {
        invoices: { select: { id: true } },
        subscriptions: { select: { id: true } },
        paymentMethods: { select: { id: true } },
      },
    }),
    prisma.user.findMany({ where: { linkedClientId: clientId }, select: { id: true, name: true, email: true } }),
  ]);

  // These cascade automatically at the DB level once the Client row is
  // deleted (all have onDelete: Cascade on clientId). Counted here purely
  // for reporting so the dry run shows the full picture.
  const [
    socialLoginCount,
    youtubeSnapshotCount,
    youtubeChannel,
    metaSnapshotCount,
    metaAccount,
    facebookPageCount,
    clientRevenueCount,
    editorPermCount,
    postedContentCount,
    postingTargetCount,
    portalAccess,
    onboardingToken,
  ] = await Promise.all([
    prisma.socialLogin.count({ where: { clientId } }),
    prisma.youTubeSnapshot.count({ where: { clientId } }),
    prisma.youTubeChannel.findUnique({ where: { clientId } }),
    prisma.metaSnapshot.count({ where: { clientId } }),
    prisma.metaAccount.findUnique({ where: { clientId } }),
    prisma.facebookPage.count({ where: { clientId } }),
    prisma.clientRevenue.count({ where: { clientId } }),
    prisma.editorClientPermission.count({ where: { clientId } }),
    prisma.postedContent.count({ where: { clientId } }),
    prisma.postingTarget.count({ where: { clientId } }),
    prisma.clientPortalAccess.findUnique({ where: { clientId } }),
    prisma.onboardingToken.findUnique({ where: { clientId } }),
  ]);

  const invoiceCount = stripeCustomer?.invoices.length ?? 0;
  const subscriptionCount = stripeCustomer?.subscriptions.length ?? 0;
  const paymentMethodCount = stripeCustomer?.paymentMethods.length ?? 0;
  const paymentCount = invoiceCount
    ? await prisma.payment.count({ where: { invoiceId: { in: stripeCustomer!.invoices.map((i) => i.id) } } })
    : 0;

  // ── Report ────────────────────────────────────────────────────────────
  console.log("\nWill delete directly:");
  console.log(`  Tasks:                  ${taskIds.length}  (cascades Files, ShootDetail, TitlingJob, TaskFeedback)`);
  console.log(`    ↳ Files:              ${files.length}`);
  console.log(`  SocialPosts:            ${socialPostCount}`);
  console.log(`  EditorEodReportItems:   ${editorEodItemCount}`);
  console.log(`  SocialAnalytics rows:   ${socialAnalyticsCount}`);
  console.log(`  RecurringTasks:         ${recurringTaskCount}`);
  console.log(`  MonthlyDeliverables:    ${monthlyDeliverableCount}`);
  console.log(`  OneOffDeliverables:     ${oneOffDeliverableCount}`);
  console.log(`  BrandAssets:            ${brandAssetCount}`);
  console.log(`  MonthlyRuns:            ${monthlyRunCount}`);
  console.log(`  SocialAccounts:         ${socialAccountIds.length}`);
  console.log(`  Jobs:                   ${jobCount}  (cascades Bids)`);
  console.log(`  Guidelines:             ${guidelineCount}`);

  console.log("\nWill cascade automatically on final Client delete:");
  console.log(`  SocialLogins:           ${socialLoginCount}`);
  console.log(`  YouTubeChannel:         ${youtubeChannel ? 1 : 0}`);
  console.log(`  YouTubeSnapshots:       ${youtubeSnapshotCount}`);
  console.log(`  MetaAccount:            ${metaAccount ? 1 : 0}`);
  console.log(`  MetaSnapshots:          ${metaSnapshotCount}`);
  console.log(`  FacebookPages:          ${facebookPageCount}  (+ their FacebookSnapshots)`);
  console.log(`  ClientRevenue rows:     ${clientRevenueCount}`);
  console.log(`  EditorClientPerms:      ${editorPermCount}`);
  console.log(`  PostedContent:          ${postedContentCount}`);
  console.log(`  PostingTargets:         ${postingTargetCount}`);
  console.log(`  ClientPortalAccess:     ${portalAccess ? 1 : 0}`);
  console.log(`  OnboardingToken:        ${onboardingToken ? 1 : 0}`);
  console.log(`  StripeCustomer:         ${stripeCustomer ? 1 : 0}`);
  console.log(`    ↳ Invoices:           ${invoiceCount}`);
  console.log(`    ↳ Payments:           ${paymentCount}`);
  console.log(`    ↳ Subscriptions:      ${subscriptionCount}`);
  console.log(`    ↳ PaymentMethods:     ${paymentMethodCount}`);

  console.log(`\nLinked User accounts (team members with linkedClientId): ${linkedUsers.length}`);
  linkedUsers.forEach((u) => console.log(`    - ${u.name ?? "(no name)"} <${u.email}> [${u.id}]`));
  console.log(
    includeUsers
      ? "  → --include-users passed: these will be UNLINKED (linkedClientId set to null), not deleted."
      : "  → will be left as-is except unlinking (default behavior either way — these are never deleted by this script)."
  );

  if (client.userId) {
    const portalUser = await prisma.user.findUnique({ where: { id: client.userId }, select: { id: true, name: true, email: true } });
    console.log(`\nClient's own portal login (Client.userId): ${portalUser ? `${portalUser.name ?? ""} <${portalUser.email}> [${portalUser.id}]` : "(not found)"}`);
    console.log(
      includeUsers
        ? "  → --include-users passed: this User row WILL be deleted."
        : "  → will NOT be deleted (pass --include-users to also delete it)."
    );
  }

  if (files.length) {
    console.log(`\n⚠️  S3/R2 CLEANUP REQUIRED — ${files.length} file(s) will be orphaned in storage:`);
    console.log("   This script only deletes DB rows. Run the printed keys through the");
    console.log("   file server's DELETE /delete endpoint (or R2 console) separately.");
  }

  if (!confirm) {
    console.log("\n" + "=".repeat(70));
    console.log("Dry run only — nothing was changed. Re-run with --confirm to execute.");
    console.log("=".repeat(70));
    await prisma.$disconnect();
    return;
  }

  // ── Execute ───────────────────────────────────────────────────────────
  console.log("\n🔥 Proceeding with deletion in a single transaction...\n");

  await prisma.$transaction(
    async (tx) => {
      if (taskIds.length || socialAccountIds.length) {
        await tx.socialPost.deleteMany({
          where: {
            OR: [
              taskIds.length ? { taskId: { in: taskIds } } : { id: "___none___" },
              socialAccountIds.length ? { socialAccountId: { in: socialAccountIds } } : { id: "___none___" },
            ],
          },
        });
      }

      if (taskIds.length) {
        await tx.editorEodReportItem.deleteMany({ where: { taskId: { in: taskIds } } });
      }

      if (socialAccountIds.length) {
        await tx.socialAnalytics.deleteMany({ where: { socialAccountId: { in: socialAccountIds } } });
      }

      // RecurringTask before Task: RecurringTask.templateTaskId -> Task (no cascade)
      await tx.recurringTask.deleteMany({ where: { clientId } });

      // Task: cascades File, ShootDetail, TitlingJob, TaskFeedback automatically
      await tx.task.deleteMany({ where: { clientId } });

      await tx.monthlyDeliverable.deleteMany({ where: { clientId } });
      await tx.oneOffDeliverable.deleteMany({ where: { clientId } });
      await tx.brandAsset.deleteMany({ where: { clientId } });
      await tx.monthlyRun.deleteMany({ where: { clientId } });
      await tx.socialAccount.deleteMany({ where: { clientId } }); // safe now, posts/analytics gone
      await tx.job.deleteMany({ where: { clientId } }); // cascades Bids
      await tx.guideline.deleteMany({ where: { clientId } });

      if (includeUsers) {
        await tx.user.updateMany({ where: { linkedClientId: clientId }, data: { linkedClientId: null } });
      }

      // Everything else (SocialLogin, YouTubeChannel/Snapshot, MetaAccount/Snapshot,
      // FacebookPage/Snapshot, ClientRevenue, EditorClientPermission, StripeCustomer
      // + Invoice/Payment/Subscription/PaymentMethod, PostedContent, PostingTarget,
      // ClientPortalAccess, OnboardingToken) cascades automatically here:
      const portalUserId = client.userId;
      await tx.client.delete({ where: { id: clientId } });

      if (includeUsers && portalUserId) {
        await tx.user.delete({ where: { id: portalUserId } });
      }
    },
    { timeout: 60_000 }
  );

  console.log("✅ Client and all related data deleted.\n");

  if (files.length) {
    const outPath = path.join(process.cwd(), `orphaned-s3-keys-${clientId}.json`);
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        files.map((f) => ({ id: f.id, name: f.name, s3Key: f.s3Key, nasPath: f.nasPath })),
        null,
        2
      )
    );
    console.log(`📄 Wrote ${files.length} orphaned S3/NAS key(s) to: ${outPath}`);
    console.log("   Clean these up via the file server or R2 console when ready.");
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("❌ Failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});


