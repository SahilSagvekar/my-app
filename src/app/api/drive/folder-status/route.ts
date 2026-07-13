export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { createAuditLog, AuditAction } from "@/lib/audit-logger";

const VALID_STATUSES = ["IN_PROGRESS", "COMPLETED"];

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

function getUserIdFromToken(token: string): number | null {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
  return decoded?.userId != null ? Number(decoded.userId) : null;
}

// GET /api/drive/folder-status?clientId=... — map of s3KeyPrefix -> status for a client
export async function GET(req: Request) {
  const token = getTokenFromCookies(req);
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    getUserIdFromToken(token);

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ message: "clientId is required" }, { status: 400 });

    const rows = await prisma.folderStatus.findMany({
      where: { clientId },
      include: { updatedBy: { select: { name: true } } },
    });

    const statuses: Record<string, { status: string; updatedByName: string | null; updatedAt: string }> = {};
    for (const row of rows) {
      statuses[row.s3KeyPrefix] = {
        status: row.status,
        updatedByName: row.updatedBy?.name ?? null,
        updatedAt: row.updatedAt.toISOString(),
      };
    }

    return NextResponse.json({ statuses });
  } catch (err) {
    console.error("[GET /api/drive/folder-status]", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

// PATCH /api/drive/folder-status — set or clear a folder's status
export async function PATCH(req: Request) {
  const token = getTokenFromCookies(req);
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const userId = getUserIdFromToken(token);

    const { clientId, s3KeyPrefix, status } = await req.json();
    if (!clientId || !s3KeyPrefix) {
      return NextResponse.json({ message: "clientId and s3KeyPrefix are required" }, { status: 400 });
    }
    if (status !== null && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ message: `status must be one of ${VALID_STATUSES.join(", ")} or null` }, { status: 400 });
    }

    const existing = await prisma.folderStatus.findUnique({
      where: { clientId_s3KeyPrefix: { clientId, s3KeyPrefix } },
    });

    if (status === null) {
      if (existing) await prisma.folderStatus.delete({ where: { id: existing.id } });
    } else {
      await prisma.folderStatus.upsert({
        where: { clientId_s3KeyPrefix: { clientId, s3KeyPrefix } },
        update: { status, updatedById: userId },
        create: { clientId, s3KeyPrefix, status, updatedById: userId },
      });
    }

    await createAuditLog({
      userId: userId ?? undefined,
      action: AuditAction.FOLDER_STATUS_CHANGED,
      entity: "FolderStatus",
      entityId: s3KeyPrefix,
      metadata: { clientId, oldStatus: existing?.status ?? null, newStatus: status },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/drive/folder-status]", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
