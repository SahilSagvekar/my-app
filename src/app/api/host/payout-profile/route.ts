export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { hostPayoutProfile, user as userTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@/lib/db/id";
import { z } from "zod";
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

async function getOrCreateProfile(db: ReturnType<typeof getDbHttp>, hostId: number) {
  const [existing] = await db.select().from(hostPayoutProfile).where(eq(hostPayoutProfile.userId, hostId)).limit(1);
  if (existing) return existing;

  const [me] = await db.select({ name: userTable.name, email: userTable.email, phone: userTable.phone })
    .from(userTable).where(eq(userTable.id, hostId)).limit(1);

  const [created] = await db.insert(hostPayoutProfile).values({
    id: createId(),
    userId: hostId,
    fullLegalName: me?.name || null,
    email: me?.email || null,
    phone: me?.phone || null,
    verificationStatus: "verified",
    updatedAt: new Date().toISOString(),
  }).returning();
  return created;
}

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

    const profile = await getOrCreateProfile(db, hostId);
    const [me] = await db
      .select({ name: userTable.name, employeeStatus: userTable.employeeStatus })
      .from(userTable)
      .where(eq(userTable.id, hostId))
      .limit(1);

    return NextResponse.json({ ok: true, profile, contractor: me });
  } catch (err: any) {
    console.error("GET /api/host/payout-profile error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Something went wrong" }, { status: 500 });
  }
}

const UpdateSchema = z.object({
  fullLegalName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  mailingAddress: z.string().optional(),
  // Payout method/account changes never apply immediately — no self-service
  // re-verification (product decision). They're staged for admin review.
  payoutMethod: z.enum(["ZELLE", "ACH", "CHECK", "CASH_APP"]).optional(),
  payoutAccount: z.string().optional(),
});

// PUT /api/host/payout-profile
// Contact/address fields apply immediately. payoutMethod/payoutAccount are
// staged into pendingPayoutMethod/pendingPayoutAccount and flip
// verificationStatus to 'pending_review' — an admin must approve before
// they take effect.
export async function PUT(req: NextRequest) {
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

    const body = UpdateSchema.parse(await req.json());
    const profile = await getOrCreateProfile(db, hostId);

    const update: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (body.fullLegalName !== undefined) update.fullLegalName = body.fullLegalName;
    if (body.phone !== undefined) update.phone = body.phone;
    if (body.email !== undefined) update.email = body.email;
    if (body.mailingAddress !== undefined) update.mailingAddress = body.mailingAddress;

    const payoutChanged =
      (body.payoutMethod !== undefined && body.payoutMethod !== profile.payoutMethod) ||
      (body.payoutAccount !== undefined && body.payoutAccount !== profile.payoutAccount);

    if (payoutChanged) {
      update.pendingPayoutMethod = body.payoutMethod ?? profile.payoutMethod;
      update.pendingPayoutAccount = body.payoutAccount ?? profile.payoutAccount;
      update.verificationStatus = "pending_review";
    }

    const [updated] = await db.update(hostPayoutProfile).set(update).where(eq(hostPayoutProfile.id, profile.id)).returning();

    return NextResponse.json({ ok: true, profile: updated, payoutChangeStaged: payoutChanged });
  } catch (err: any) {
    console.error("PUT /api/host/payout-profile error:", err);
    if (err.name === "ZodError") {
      return NextResponse.json({ ok: false, message: "Invalid request data", errors: err.errors }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message: err?.message || "Something went wrong" }, { status: 500 });
  }
}
