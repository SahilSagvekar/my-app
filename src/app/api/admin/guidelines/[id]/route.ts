export const dynamic = 'force-dynamic';
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
    guideline as guidelineTable,
    client as clientTable,
    user as userTable,
} from "@/lib/db/schema";
import { and, or, eq, inArray } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
import { createAuditLog, AuditAction, getRequestMetadata } from "@/lib/audit-logger";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const user = await getCurrentUser2(req);
        const allowedRoles = ['admin', 'manager', 'qc'];
        const userHasAccess = user && (allowedRoles.includes(user.role || '') || (user as any).roles?.some((r: string) => allowedRoles.includes(r)));
        if (!userHasAccess) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { id } = params;
        const body = await req.json();
        const { title, content, category, role, clientId } = body;

        const [updatedGuideline] = await db.update(guidelineTable).set({
            title,
            content,
            category,
            role: (role === 'all' || !role) ? null : role,
            clientId: (clientId === 'all' || !clientId) ? null : clientId,
            updatedAt: new Date().toISOString(),
        }).where(eq(guidelineTable.id, id)).returning();

        let guidelineClient: { name: string; companyName: string | null } | null = null;
        if (updatedGuideline?.clientId) {
            const [c] = await db.select({ name: clientTable.name, companyName: clientTable.companyName })
                .from(clientTable)
                .where(eq(clientTable.id, updatedGuideline.clientId))
                .limit(1);
            guidelineClient = c ?? null;
        }
        const guideline = { ...updatedGuideline, client: guidelineClient };

        // --- NOTIFICATIONS ---
        try {
            const targetRole = (role === 'all' || !role) ? null : role;
            const targetClientId = (clientId === 'all' || !clientId) ? null : clientId;

            const conditions: any[] = [];
            if (targetRole) conditions.push(eq(userTable.role, targetRole));
            if (targetClientId) conditions.push(eq(userTable.linkedClientId, targetClientId));

            // If it's a general rule (no role, no client), we might want to notify all editors and QC
            if (!targetRole && !targetClientId) {
                conditions.push(inArray(userTable.role, ['editor', 'qc'] as any));
            }

            const usersToNotify = await db.select({ id: userTable.id }).from(userTable)
                .where(conditions.length ? and(...conditions) : undefined);

            const clientName = guideline.client?.companyName || guideline.client?.name || "General";
            const notificationTitle = `Guideline Updated: ${title}`;
            const notificationBody = `A guideline has been updated for ${clientName}. Category: ${category}`;

            await Promise.all(
                usersToNotify.map(u =>
                    notifyUser({
                        userId: u.id,
                        type: "guideline_updated",
                        title: notificationTitle,
                        body: notificationBody,
                        payload: { guidelineId: guideline.id, category }
                    })
                )
            );
        } catch (notiError) {
            console.error("Failed to send guideline update notifications:", notiError);
        }

        // --- AUDIT LOG ---
        const { ipAddress, userAgent } = getRequestMetadata(req);
        await createAuditLog({
            userId: user.id,
            action: AuditAction.GUIDELINE_UPDATED,
            entity: 'Guideline',
            entityId: guideline.id,
            details: `Updated guideline: ${title}`,
            metadata: { category, role, clientId },
            ipAddress,
            userAgent
        });
        // -----------------

        return NextResponse.json({ ok: true, guideline });
    } catch (error: any) {
        console.error(`PATCH /api/admin/guidelines/${params.id} error:`, error);
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}


export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const user = await getCurrentUser2(req);
        const allowedRoles = ['admin', 'manager', 'qc'];
        const userHasAccess = user && (allowedRoles.includes(user.role || '') || (user as any).roles?.some((r: string) => allowedRoles.includes(r)));
        if (!userHasAccess) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { id } = params;

        await db.delete(guidelineTable).where(eq(guidelineTable.id, id));

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error(`DELETE /api/admin/guidelines/${params.id} error:`, error);
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}