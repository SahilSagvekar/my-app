import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    // Get all employees (including client role users)
    const employees = await prisma.user.findMany({
      include: {
        assignedTasks: true,
        // 🔥 NEW: Use linkedClient instead of client (for multiple users per client)
        linkedClient: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
        // Keep old relation for backward compatibility
        client: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
        // 🔥 NEW: Fetch latest activity for "Last Active" column
        auditLogs: {
          take: 1,
          orderBy: { timestamp: 'desc' },
          select: { timestamp: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Map employees to include linkedClientId for easy access
    const employeesWithClientId = employees.map((emp) => ({
      ...emp,
      // 🔥 Prefer linkedClientId (new), fallback to client.id (old)
      linkedClientId: emp.linkedClientId || emp.client?.id || null,
      linkedClientName: emp.linkedClient?.companyName || emp.linkedClient?.name || emp.client?.companyName || emp.client?.name || null,
    }));

    return NextResponse.json({ ok: true, employees: employeesWithClientId });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message }, { status: 400 });
  }
}

