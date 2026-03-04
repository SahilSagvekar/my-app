export const dynamic = 'force-dynamic';
import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
import { createAuditLog, AuditAction, getRequestMetadata } from "@/lib/audit-logger";

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);
        if (!user || (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'qc')) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { title, content, category, role, clientId } = body;

        if (!title || !content || !category) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
        }

        const guideline = await prisma.guideline.create({
            data: {
                title,
                content,
                category,
                role: (role === 'all' || !role) ? null : role,
                clientId: (clientId === 'all' || !clientId) ? null : clientId,
            },
            include: {
                client: {
                    select: { name: true, companyName: true }
                }
            }
        });

        // --- NOTIFICATIONS ---
        try {
            const targetRole = (role === 'all' || !role) ? null : role;
            const targetClientId = (clientId === 'all' || !clientId) ? null : clientId;

            const where: any = {};
            if (targetRole) where.role = targetRole;
            if (targetClientId) where.linkedClientId = targetClientId;

            // If it's a general rule (no role, no client), we might want to notify all editors and QC
            if (!targetRole && !targetClientId) {
                where.role = { in: ['editor', 'qc'] };
            }

            const usersToNotify = await prisma.user.findMany({
                where,
                select: { id: true }
            });

            const clientName = guideline.client?.companyName || guideline.client?.name || "General";
            const notificationTitle = `New Guideline: ${title}`;
            const notificationBody = `A new guideline has been added for ${clientName}. Category: ${category}`;

            await Promise.all(
                usersToNotify.map(u =>
                    notifyUser({
                        userId: u.id,
                        type: "guideline_added",
                        title: notificationTitle,
                        body: notificationBody,
                        payload: { guidelineId: guideline.id, category }
                    })
                )
            );
        } catch (notiError) {
            console.error("Failed to send guideline notifications:", notiError);
        }

        // --- AUDIT LOG ---
        const { ipAddress, userAgent } = getRequestMetadata(req);
        await createAuditLog({
            userId: user.id,
            action: AuditAction.GUIDELINE_CREATED,
            entity: 'Guideline',
            entityId: guideline.id,
            details: `Added new guideline: ${title}`,
            metadata: { category, role, clientId },
            ipAddress,
            userAgent
        });
        // -----------------

        return NextResponse.json({ ok: true, guideline });
    } catch (error: any) {
        console.error("POST /api/admin/guidelines error:", error);
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}

