export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { hostDocument } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { createId } from "@/lib/db/id";
import { uploadBufferToS3 } from "@/lib/s3";
import jwt from "jsonwebtoken";

function getUserFromToken(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return null;
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.user || decoded.currentUser || decoded;
  } catch {
    return null;
  }
}

// The four evergreen paperwork forms every host needs on file.
const EVERGREEN_FORMS = ["W9", "DIRECT_DEPOSIT", "PHOTO_ID", "TALENT_RELEASE"] as const;

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
    const hostId = Number(user.userId || user.id);
    if (!hostId || Number.isNaN(hostId)) {
      return NextResponse.json({ ok: false, message: "Invalid user" }, { status: 400 });
    }

    let rows = await db.query.hostDocument.findMany({
      where: eq(hostDocument.hostUserId, hostId),
    });

    // Lazily create the 4 evergreen forms the first time a host visits —
    // avoids needing a signup-time provisioning step.
    const existingTypes = new Set(rows.filter((r) => r.taxYear === 0).map((r) => r.formType));
    const missing = EVERGREEN_FORMS.filter((f) => !existingTypes.has(f));
    if (missing.length > 0) {
      const inserted = await db.insert(hostDocument).values(
        missing.map((formType) => ({
          id: createId(),
          hostUserId: hostId,
          formType,
          taxYear: 0,
          status: "missing",
          updatedAt: new Date().toISOString(),
        }))
      ).returning();
      rows = [...rows, ...inserted];
    }

    const forms = rows.filter((r) => r.formType !== "FORM_1099");
    const form1099s = rows.filter((r) => r.formType === "FORM_1099");

    return NextResponse.json({ ok: true, forms, form1099s });
  } catch (err: any) {
    console.error("GET /api/host/documents error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Something went wrong" }, { status: 500 });
  }
}

// POST /api/host/documents — submit/upload one form.
// multipart/form-data: formType, file
export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
    const hostId = Number(user.userId || user.id);
    if (!hostId || Number.isNaN(hostId)) {
      return NextResponse.json({ ok: false, message: "Invalid user" }, { status: 400 });
    }

    const formData = await req.formData();
    const formType = String(formData.get("formType") || "");
    const file = formData.get("file") as File | null;

    if (!EVERGREEN_FORMS.includes(formType as any)) {
      return NextResponse.json({ ok: false, message: "Invalid form type" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ ok: false, message: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const { key } = await uploadBufferToS3({
      buffer,
      folderPrefix: `host-documents/${hostId}/`,
      filename: `${Date.now()}-${safeName}`,
      mimeType: file.type || "application/octet-stream",
    });

    const [existing] = await db
      .select()
      .from(hostDocument)
      .where(and(eq(hostDocument.hostUserId, hostId), eq(hostDocument.formType, formType), eq(hostDocument.taxYear, 0)))
      .limit(1);

    const now = new Date().toISOString();
    let row;
    if (existing) {
      [row] = await db
        .update(hostDocument)
        .set({
          status: "submitted",
          fileS3Key: key,
          fileName: file.name,
          submittedAt: now,
          reviewedAt: null,
          reviewedBy: null,
          updatedAt: now,
        })
        .where(eq(hostDocument.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(hostDocument)
        .values({
          id: createId(),
          hostUserId: hostId,
          formType,
          taxYear: 0,
          status: "submitted",
          fileS3Key: key,
          fileName: file.name,
          submittedAt: now,
          updatedAt: now,
        })
        .returning();
    }

    return NextResponse.json({ ok: true, document: row });
  } catch (err: any) {
    console.error("POST /api/host/documents error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Something went wrong" }, { status: 500 });
  }
}
