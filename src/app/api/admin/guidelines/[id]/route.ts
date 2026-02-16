import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const user = await getCurrentUser2(req);
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { id } = params;
        const body = await req.json();
        const { title, content, category, role, clientId } = body;

        const guideline = await prisma.guideline.update({
            where: { id },
            data: {
                title,
                content,
                category,
                role: role === 'all' ? null : role,
                clientId: clientId === 'all' ? null : clientId,
            }
        });

        return NextResponse.json({ ok: true, guideline });
    } catch (error: any) {
        console.error(`PATCH /api/admin/guidelines/${params.id} error:`, error);
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const user = await getCurrentUser2(req);
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { id } = params;

        await prisma.guideline.delete({
            where: { id }
        });

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error(`DELETE /api/admin/guidelines/${params.id} error:`, error);
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
}
