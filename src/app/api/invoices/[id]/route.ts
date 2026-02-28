import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { voidQBInvoice } from "@/lib/quickbooks";

// GET /api/invoices/:id — Get single invoice
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (
        !session?.user?.role ||
        !["admin", "manager"].includes(session.user.role)
    ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
            task: { select: { id: true, title: true, taskType: true } },
            client: {
                select: { id: true, name: true, companyName: true, email: true },
            },
        },
    });

    if (!invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json(invoice);
}

// PATCH /api/invoices/:id — Update draft invoice
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (
        !session?.user?.role ||
        !["admin", "manager"].includes(session.user.role)
    ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status !== "DRAFT") {
        return NextResponse.json(
            { error: "Only draft invoices can be edited" },
            { status: 400 }
        );
    }

    const body = await req.json();
    const updateData: any = {};

    if (body.amount !== undefined) updateData.amount = parseFloat(body.amount);
    if (body.description !== undefined) updateData.description = body.description;
    if (body.dueDate !== undefined)
        updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    const updated = await prisma.invoice.update({
        where: { id },
        data: updateData,
        include: {
            task: { select: { id: true, title: true } },
            client: { select: { id: true, name: true, companyName: true } },
        },
    });

    return NextResponse.json(updated);
}

// DELETE /api/invoices/:id — Void/delete invoice
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (
        !session?.user?.role ||
        !["admin", "manager"].includes(session.user.role)
    ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // If it's been pushed to QBO, void it there too
    if (invoice.qbInvoiceId) {
        try {
            await voidQBInvoice(invoice.qbInvoiceId);
        } catch (err: any) {
            console.error("[Invoices] QBO void error:", err);
            // Continue with local void even if QBO fails
        }
    }

    if (invoice.status === "DRAFT") {
        // If still draft, just delete it
        await prisma.invoice.delete({ where: { id } });
        return NextResponse.json({ success: true, action: "deleted" });
    }

    // If sent/paid, void instead of delete
    await prisma.invoice.update({
        where: { id },
        data: { status: "VOIDED" },
    });

    return NextResponse.json({ success: true, action: "voided" });
}
