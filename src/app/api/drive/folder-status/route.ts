export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { folderStatus } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { and, eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { createAuditLog, AuditAction } from "@/lib/audit-logger";

const VALID_STATUSES = ["IN_PROGRESS", "COMPLETED"];

// Folder status marking is restricted to folders inside the client's
// "raw-footage" tree, at any depth. Mirrors the check in DriveExplorer.tsx —
// checks ancestor path segments (excluding the folder's own name), not a
// raw substring match, and excludes the raw-footage root folder itself.
function isInsideRawFootage(s3KeyPrefix: string): boolean {
  const parts = s3KeyPrefix.split("/").filter(Boolean);
  const ancestors = parts.slice(0, -1);
  return ancestors.includes("raw-footage");
}

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
  const db = getDbHttp();
  const token = getTokenFromCookies(req);
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    getUserIdFromToken(token);

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ message: "clientId is required" }, { status: 400 });

    const rows = await db.query.folderStatus.findMany({
      where: eq(folderStatus.clientId, clientId),
      with: { user: { columns: { name: true } } },
    });

    const statuses: Record<string, { status: string; updatedByName: string | null; updatedAt: string }> = {};
    for (const row of rows) {
      statuses[row.s3KeyPrefix] = {
        status: row.status,
        updatedByName: row.user?.name ?? null,
        updatedAt: new Date(row.updatedAt).toISOString(),
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
  const db = getDbHttp();
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
    if (status !== null && !isInsideRawFootage(s3KeyPrefix)) {
      return NextResponse.json({ message: "Folder status can only be set on folders inside raw-footage" }, { status: 400 });
    }

    const existing = await db.query.folderStatus.findFirst({
      where: and(eq(folderStatus.clientId, clientId), eq(folderStatus.s3KeyPrefix, s3KeyPrefix)),
    });

    if (status === null) {
      if (existing) await db.delete(folderStatus).where(eq(folderStatus.id, existing.id));
    } else if (existing) {
      await db
        .update(folderStatus)
        .set({ status, updatedById: userId, updatedAt: new Date().toISOString() })
        .where(eq(folderStatus.id, existing.id));
    } else {
      await db.insert(folderStatus).values({
        id: createId(),
        clientId,
        s3KeyPrefix,
        status,
        updatedById: userId,
        updatedAt: new Date().toISOString(),
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