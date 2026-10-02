// src/lib/leave-notifications.ts
//
// Fired when an employee submits a leave request. Every admin gets an
// in-app (+ Slack, via notifyUser) notification and an email, so a pending
// request is never silently sitting in the User Management tab.
import { getDbHttp } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { notifyUser } from "@/lib/notify";
import { sendRawEmail } from "@/lib/email";
import { renderEmailShell } from "@/lib/email-shell";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.e8productions.com";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function notifyAdminsOfLeaveRequest(leave: {
  id: number;
  employeeId: number;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason?: string | null;
}) {
  const db = getDbHttp();

  const [employee] = await db
    .select({ name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, leave.employeeId))
    .limit(1);
  const employeeName = employee?.name || employee?.email || `User #${leave.employeeId}`;

  const admins = await db
    .select({ id: userTable.id, email: userTable.email, emailNotifications: userTable.emailNotifications })
    .from(userTable)
    .where(and(eq(userTable.role, "admin"), ne(userTable.id, leave.employeeId)));

  const range =
    leave.startDate.slice(0, 10) === leave.endDate.slice(0, 10)
      ? fmtDate(leave.startDate)
      : `${fmtDate(leave.startDate)} – ${fmtDate(leave.endDate)}`;
  const days = `${leave.numberOfDays} working day${leave.numberOfDays === 1 ? "" : "s"}`;
  const title = "New Leave Request";
  const body = `${employeeName} requested leave: ${range} (${days}).${leave.reason ? ` Reason: ${leave.reason}` : ""}`;
  const link = APP_URL;

  const contentHtml = `
      <tr><td class="px" style="padding:28px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:20px;font-weight:bold;color:#0a0a0b;">New leave request</td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3a3a40;">
        <strong>${esc(employeeName)}</strong> has requested time off and is waiting for approval.
      </td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.8;color:#3a3a40;">
        <strong>Dates:</strong> ${esc(range)}<br>
        <strong>Duration:</strong> ${esc(days)}<br>
        <strong>Reason:</strong> ${leave.reason ? esc(leave.reason) : "<em>none given</em>"}
      </td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;">
        <a href="${link}" style="display:inline-block;background:#0a0a0b;color:#ffffff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;padding:12px 22px;border-radius:8px;">Open E8 App</a>
      </td></tr>`;
  const html = renderEmailShell({ previewText: body, contentHtml });

  await Promise.allSettled(
    admins.flatMap((admin) => {
      const jobs: Promise<unknown>[] = [
        notifyUser({
          userId: admin.id,
          type: "leave_requested",
          title,
          body,
          payload: { leaveId: leave.id, employeeId: leave.employeeId },
        }),
      ];
      if (admin.email && admin.emailNotifications !== false) {
        jobs.push(
          sendRawEmail({ to: admin.email, subject: `Leave request: ${employeeName} (${range})`, html })
        );
      }
      return jobs;
    })
  );
}
