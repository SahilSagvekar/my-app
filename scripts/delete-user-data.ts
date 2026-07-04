// scripts/delete-user-data.ts
//
// Bulk-deletes one or more Users and their directly-owned data across the schema.
//
// SAFETY MODEL:
//   - Defaults to DRY RUN. Nothing is deleted unless you pass --confirm.
//   - Always run without --confirm first and read the report.
//   - Wrapped in a single Prisma transaction — if anything fails, nothing
//     is committed (all-or-nothing).
//   - Does NOT cascade into a linked Client's business data (deliverables,
//     tasks, files, billing). If a target user is a client portal login
//     (Client.userId), that Client row is only unlinked (userId -> null),
//     never deleted. Use scripts/delete-client-data.ts for that.
//   - Business records with a REQUIRED (non-nullable) foreign key to User
//     — Task.assignedTo, Contract.createdById, Job.createdById,
//     PreClient.createdById, EmployeeDocument.uploadedById, SalesLead.userId,
//     SalesLeadGenerationJob.userId, SocialLogin.updatedById — cannot simply
//     be deleted (they're not the user's personal data, they're work
//     product/audit trail owned by the org) and cannot be left dangling.
//     The script BLOCKS if any exist unless you pass --reassign-to=<userId>,
//     which re-points them at a fallback account you choose.
//   - Optional FKs (AuditLog.userId, Client.userId, ClientPortalAccess.
//     adminUnlockedById, Invoice.createdBy, Job.assignedToId, Task.
//     qcReviewedBy, Task.clientUserId, ShootDetail.videographerId) are set
//     to NULL — the record survives, the "who" reference is just cleared.
//   - Everything else (Bonus, Leave, Deduction, Payroll, QC* stats,
//     EditorEodReport(+Items), Bid, AffiliateCommission, Feedback(+Responses),
//     LoginAuditLog, Notification, NotificationPreference,
//     SalesDashboardColumn) is the user's own personal/analytics data and is
//     hard-deleted. Account/Session/UserSecurityPin/UserTwoFactorAuth/
//     EmployeeDocument(as owner)/EditorClientPermission cascade automatically
//     via onDelete: Cascade when the User row is deleted.
//
// USAGE:
//   npx tsx scripts/delete-user-data.ts --users=<id|email>[,<id|email>...]
//   npx tsx scripts/delete-user-data.ts --users=... --confirm
//   npx tsx scripts/delete-user-data.ts --users=... --confirm --reassign-to=<userId>
//
// Run the first form as many times as you like — it's read-only.

import { prisma } from "../src/lib/prisma";
import fs from "fs";
import path from "path";

interface Args {
  users: string[];
  confirm: boolean;
  reassignTo?: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const usersArg = args.find((a) => a.startsWith("--users="));
  const confirm = args.includes("--confirm");
  const reassignArg = args.find((a) => a.startsWith("--reassign-to="));

  if (!usersArg) {
    console.error(
      "❌ Missing --users=<id|email>[,<id|email>...]\n\n" +
        "Usage:\n" +
        "  npx tsx scripts/delete-user-data.ts --users=<id|email>,...                         (dry run)\n" +
        "  npx tsx scripts/delete-user-data.ts --users=<id|email>,... --confirm                (execute)\n" +
        "  ... --confirm --reassign-to=<userId>   (also reassigns required-FK business records)\n"
    );
    process.exit(1);
  }

  const users = usersArg
    .split("=")
    .slice(1)
    .join("=")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!users.length) {
    console.error("❌ --users= was empty");
    process.exit(1);
  }

  let reassignTo: number | undefined;
  if (reassignArg) {
    reassignTo = Number(reassignArg.split("=")[1]);
    if (!Number.isInteger(reassignTo)) {
      console.error("❌ --reassign-to must be a numeric User id");
      process.exit(1);
    }
  }

  return { users, confirm, reassignTo };
}

async function resolveUsers(identifiers: string[]) {
  const numericIds = identifiers.filter((i) => /^\d+$/.test(i)).map(Number);
  const emails = identifiers.filter((i) => !/^\d+$/.test(i));

  const found = await prisma.user.findMany({
    where: {
      OR: [
        numericIds.length ? { id: { in: numericIds } } : { id: -1 },
        emails.length ? { email: { in: emails } } : { id: -1 },
      ],
    },
  });

  const foundKeys = new Set<string>();
  found.forEach((u) => {
    foundKeys.add(String(u.id));
    foundKeys.add(u.email);
  });
  const missing = identifiers.filter((i) => !foundKeys.has(i));
  if (missing.length) {
    console.error(`❌ No user found for: ${missing.join(", ")}`);
    process.exit(1);
  }

  return found;
}

async function main() {
  const { users: identifiers, confirm, reassignTo } = parseArgs();
  const targets = await resolveUsers(identifiers);
  const targetIds = targets.map((u) => u.id);

  if (reassignTo !== undefined) {
    if (targetIds.includes(reassignTo)) {
      console.error("❌ --reassign-to cannot be one of the users being deleted");
      process.exit(1);
    }
    const fallback = await prisma.user.findUnique({ where: { id: reassignTo } });
    if (!fallback) {
      console.error(`❌ --reassign-to user id ${reassignTo} does not exist`);
      process.exit(1);
    }
  }

  console.log("=".repeat(70));
  console.log(confirm ? "🔥 EXECUTING DELETION" : "🔍 DRY RUN (no data will be changed)");
  console.log("=".repeat(70));
  targets.forEach((u) => console.log(`  [${u.id}] ${u.name ?? "(no name)"} <${u.email}> role=${u.role ?? "-"}`));
  console.log("=".repeat(70));

  const where = { in: targetIds };

  // ── Gather everything up front (read-only) ──────────────────────────────
  const [
    // required FKs — must reassign or block
    tasksAssigned,
    taskFeedbackAuthored,
    contractsCreated,
    jobsCreated,
    preClientsCreated,
    employeeDocsUploaded,
    salesLeadsOwned,
    salesLeadGenJobsOwned,
    socialLoginsUpdatedBy,
    // optional FKs — will be nulled
    auditLogCount,
    clientLogins,
    portalAccessUnlocks,
    invoicesCreatedByCount,
    jobsAssignedCount,
    tasksQcReviewedCount,
    tasksAsClientUserCount,
    shootDetailsAsVideographerCount,
    // owned data — will be hard-deleted
    bonusCount,
    leaveCount,
    deductionCount,
    payrollCount,
    qcAnalyticsCount,
    qcRejectionCount,
    qcAchievementCount,
    qcMonthlyTrendCount,
    qcCategoryMetricsCount,
    eodReportCount,
    bidCount,
    affiliateCommissionCount,
    feedbackSentCount,
    feedbackResponseCount,
    loginAuditLogCount,
    notificationCount,
    notificationPrefCount,
    salesDashboardColumnCount,
    employeeDocsOwnedCount,
    accountCount,
    sessionCount,
  ] = await Promise.all([
    prisma.task.count({ where: { assignedTo: where } }),
    prisma.taskFeedback.count({ where: { createdBy: where } }),
    prisma.contract.count({ where: { createdById: where } }),
    prisma.job.count({ where: { createdById: where } }),
    prisma.preClient.count({ where: { createdById: where } }),
    prisma.employeeDocument.count({ where: { uploadedById: where } }),
    prisma.salesLead.count({ where: { userId: where } }),
    prisma.salesLeadGenerationJob.count({ where: { userId: where } }),
    prisma.socialLogin.count({ where: { updatedById: where } }),

    prisma.auditLog.count({ where: { userId: where } }),
    prisma.client.findMany({ where: { userId: where }, select: { id: true, name: true, email: true } }),
    prisma.clientPortalAccess.count({ where: { adminUnlockedById: where } }),
    prisma.invoice.count({ where: { createdBy: where } }),
    prisma.job.count({ where: { assignedToId: where } }),
    prisma.task.count({ where: { qcReviewedBy: where } }),
    prisma.task.count({ where: { clientUserId: where } }),
    prisma.shootDetail.count({ where: { videographerId: where } }),

    prisma.bonus.count({ where: { employeeId: where } }),
    prisma.leave.count({ where: { employeeId: where } }),
    prisma.deduction.count({ where: { employeeId: where } }),
    prisma.payroll.count({ where: { employeeId: where } }),
    prisma.qCAnalytics.count({ where: { qcSpecialistId: where } }),
    prisma.qCRejectionReason.count({ where: { qcSpecialistId: where } }),
    prisma.qCAchievement.count({ where: { qcSpecialistId: where } }),
    prisma.qCMonthlyTrend.count({ where: { qcSpecialistId: where } }),
    prisma.qCCategoryMetrics.count({ where: { qcSpecialistId: where } }),
    prisma.editorEodReport.count({ where: { editorId: where } }),
    prisma.bid.count({ where: { userId: where } }),
    prisma.affiliateCommission.count({ where: { salesUserId: where } }),
    prisma.feedback.count({ where: { senderId: where } }),
    prisma.feedbackResponse.count({ where: { senderId: where } }),
    prisma.loginAuditLog.count({ where: { userId: where } }),
    prisma.notification.count({ where: { userId: where } }),
    prisma.notificationPreference.count({ where: { userId: where } }),
    prisma.salesDashboardColumn.count({ where: { userId: where } }),
    prisma.employeeDocument.count({ where: { employeeId: where } }),
    prisma.account.count({ where: { userId: where } }),
    prisma.session.count({ where: { userId: where } }),
  ]);

  const requiresReassign =
    tasksAssigned +
    taskFeedbackAuthored +
    contractsCreated +
    jobsCreated +
    preClientsCreated +
    employeeDocsUploaded +
    salesLeadsOwned +
    salesLeadGenJobsOwned +
    socialLoginsUpdatedBy;

  console.log("\n⚠️  BLOCKING (required FK — business record, needs --reassign-to):");
  console.log(`  Task.assignedTo:            ${tasksAssigned}`);
  console.log(`  TaskFeedback.createdBy:     ${taskFeedbackAuthored}`);
  console.log(`  Contract.createdById:       ${contractsCreated}`);
  console.log(`  Job.createdById:            ${jobsCreated}`);
  console.log(`  PreClient.createdById:      ${preClientsCreated}`);
  console.log(`  EmployeeDocument.uploadedById: ${employeeDocsUploaded}`);
  console.log(`  SalesLead.userId:           ${salesLeadsOwned}`);
  console.log(`  SalesLeadGenerationJob.userId: ${salesLeadGenJobsOwned}`);
  console.log(`  SocialLogin.updatedById:    ${socialLoginsUpdatedBy}`);

  console.log("\nWill be NULLED (optional FK, record survives):");
  console.log(`  AuditLog.userId:            ${auditLogCount}`);
  console.log(`  Client.userId (portal login unlink): ${clientLogins.length}`);
  clientLogins.forEach((c) => console.log(`    - ${c.name} <${c.email}> [${c.id}]`));
  console.log(`  ClientPortalAccess.adminUnlockedById: ${portalAccessUnlocks}`);
  console.log(`  Invoice.createdBy:          ${invoicesCreatedByCount}`);
  console.log(`  Job.assignedToId:           ${jobsAssignedCount}`);
  console.log(`  Task.qcReviewedBy:          ${tasksQcReviewedCount}`);
  console.log(`  Task.clientUserId:          ${tasksAsClientUserCount}`);
  console.log(`  ShootDetail.videographerId: ${shootDetailsAsVideographerCount}`);

  console.log("\nWill be HARD-DELETED (owned personal/analytics/log data):");
  console.log(`  Bonus:                      ${bonusCount}`);
  console.log(`  Leave:                      ${leaveCount}`);
  console.log(`  Deduction:                  ${deductionCount}`);
  console.log(`  Payroll:                    ${payrollCount}`);
  console.log(`  QCAnalytics:                ${qcAnalyticsCount}`);
  console.log(`  QCRejectionReason:          ${qcRejectionCount}`);
  console.log(`  QCAchievement:              ${qcAchievementCount}`);
  console.log(`  QCMonthlyTrend:             ${qcMonthlyTrendCount}`);
  console.log(`  QCCategoryMetrics:          ${qcCategoryMetricsCount}`);
  console.log(`  EditorEodReport:            ${eodReportCount} (cascades EditorEodReportItem)`);
  console.log(`  Bid:                        ${bidCount}`);
  console.log(`  AffiliateCommission:        ${affiliateCommissionCount}`);
  console.log(`  Feedback:                   ${feedbackSentCount} (cascades FeedbackResponse)`);
  console.log(`  FeedbackResponse (direct):  ${feedbackResponseCount}`);
  console.log(`  LoginAuditLog:              ${loginAuditLogCount}`);
  console.log(`  Notification:               ${notificationCount}`);
  console.log(`  NotificationPreference:     ${notificationPrefCount}`);
  console.log(`  SalesDashboardColumn:       ${salesDashboardColumnCount}`);
  console.log(`  EmployeeDocument (as owner): ${employeeDocsOwnedCount} (onDelete: Cascade)`);

  console.log("\nWill cascade automatically on final User delete:");
  console.log(`  Account:                    ${accountCount}`);
  console.log(`  Session:                    ${sessionCount}`);
  console.log(`  UserSecurityPin / UserTwoFactorAuth / EditorClientPermission`);

  if (requiresReassign > 0) {
    console.log(`\n⚠️  ${requiresReassign} row(s) require --reassign-to=<userId>.`);
    if (reassignTo === undefined) {
      console.log("   No --reassign-to given — deletion will be BLOCKED.");
    } else {
      console.log(`   Will be reassigned to user id ${reassignTo}.`);
    }
  }

  if (!confirm) {
    console.log("\n" + "=".repeat(70));
    console.log("Dry run only — nothing was changed. Re-run with --confirm to execute.");
    console.log("=".repeat(70));
    await prisma.$disconnect();
    return;
  }

  if (requiresReassign > 0 && reassignTo === undefined) {
    console.error(
      `\n❌ Aborting: ${requiresReassign} row(s) reference required (non-nullable) foreign keys ` +
        "and would violate a database constraint if the user(s) were deleted. " +
        "Re-run with --reassign-to=<userId> to reassign them first."
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  // ── Execute ───────────────────────────────────────────────────────────
  console.log("\n🔥 Proceeding with deletion in a single transaction...\n");

  await prisma.$transaction(
    async (tx) => {
      // Nullify optional FKs first.
      await tx.auditLog.updateMany({ where: { userId: where }, data: { userId: null } });
      await tx.client.updateMany({ where: { userId: where }, data: { userId: null } });
      await tx.clientPortalAccess.updateMany({ where: { adminUnlockedById: where }, data: { adminUnlockedById: null } });
      await tx.invoice.updateMany({ where: { createdBy: where }, data: { createdBy: null } });
      await tx.job.updateMany({ where: { assignedToId: where }, data: { assignedToId: null } });
      await tx.task.updateMany({ where: { qcReviewedBy: where }, data: { qcReviewedBy: null } });
      await tx.task.updateMany({ where: { clientUserId: where }, data: { clientUserId: null } });
      await tx.shootDetail.updateMany({ where: { videographerId: where }, data: { videographerId: null } });

      // Reassign required FKs (only runs when reassignTo is set — enforced above).
      if (reassignTo !== undefined) {
        await tx.task.updateMany({ where: { assignedTo: where }, data: { assignedTo: reassignTo } });
        await tx.taskFeedback.updateMany({ where: { createdBy: where }, data: { createdBy: reassignTo } });
        await tx.contract.updateMany({ where: { createdById: where }, data: { createdById: reassignTo } });
        await tx.job.updateMany({ where: { createdById: where }, data: { createdById: reassignTo } });
        await tx.preClient.updateMany({ where: { createdById: where }, data: { createdById: reassignTo } });
        await tx.employeeDocument.updateMany({ where: { uploadedById: where }, data: { uploadedById: reassignTo } });
        await tx.salesLead.updateMany({ where: { userId: where }, data: { userId: reassignTo } });
        await tx.salesLeadGenerationJob.updateMany({ where: { userId: where }, data: { userId: reassignTo } });
        await tx.socialLogin.updateMany({ where: { updatedById: where }, data: { updatedById: reassignTo } });
      }

      // Hard-delete owned data, in dependency order.
      await tx.feedbackResponse.deleteMany({ where: { senderId: where } });
      await tx.feedback.deleteMany({ where: { senderId: where } }); // cascades remaining responses
      await tx.affiliateCommission.deleteMany({ where: { salesUserId: where } });
      await tx.loginAuditLog.deleteMany({ where: { userId: where } });
      await tx.bid.deleteMany({ where: { userId: where } });
      await tx.deduction.deleteMany({ where: { employeeId: where } }); // before Leave (Deduction.leaveId -> Leave)
      await tx.leave.deleteMany({ where: { employeeId: where } });
      await tx.payroll.deleteMany({ where: { employeeId: where } });
      await tx.bonus.deleteMany({ where: { employeeId: where } });
      await tx.qCAchievement.deleteMany({ where: { qcSpecialistId: where } });
      await tx.qCAnalytics.deleteMany({ where: { qcSpecialistId: where } });
      await tx.qCCategoryMetrics.deleteMany({ where: { qcSpecialistId: where } });
      await tx.qCMonthlyTrend.deleteMany({ where: { qcSpecialistId: where } });
      await tx.qCRejectionReason.deleteMany({ where: { qcSpecialistId: where } });
      await tx.editorEodReport.deleteMany({ where: { editorId: where } }); // cascades EditorEodReportItem
      await tx.notification.deleteMany({ where: { userId: where } });
      await tx.notificationPreference.deleteMany({ where: { userId: where } });
      await tx.salesDashboardColumn.deleteMany({ where: { userId: where } });

      // Finally the User rows — cascades Account, Session, UserSecurityPin,
      // UserTwoFactorAuth, EmployeeDocument(as owner), EditorClientPermission.
      await tx.user.deleteMany({ where: { id: { in: targetIds } } });
    },
    { timeout: 60_000 }
  );

  console.log(`✅ ${targetIds.length} user(s) and all owned data deleted.\n`);

  const outPath = path.join(process.cwd(), `deleted-users-${Date.now()}.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      targets.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
      null,
      2
    )
  );
  console.log(`📄 Wrote deleted-user manifest to: ${outPath}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("❌ Failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
