import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
    findOrCreateCustomer,
    createQBInvoice,
    sendQBInvoice,
} from "@/lib/quickbooks";

// POST /api/invoices/:id/send — Push to QBO and send
export async function POST(
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
            client: {
                select: { id: true, name: true, email: true, companyName: true },
            },
        },
    });

    if (!invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status !== "DRAFT") {
        return NextResponse.json(
            { error: "Only draft invoices can be sent" },
            { status: 400 }
        );
    }

    try {
        // 1. Find or create QBO customer
        let qbCustomerId = invoice.qbCustomerId;
        if (!qbCustomerId) {
            qbCustomerId = await findOrCreateCustomer({
                id: invoice.client.id,
                name: invoice.client.name,
                email: invoice.client.email,
                companyName: invoice.client.companyName,
            });
        }

        // 2. Create invoice in QBO
        const qbInvoice = await createQBInvoice({
            qbCustomerId,
            amount: Number(invoice.amount),
            description: invoice.description,
            dueDate: invoice.dueDate,
        });

        // 3. Send the invoice via QBO email
        await sendQBInvoice(qbInvoice.Id);

        // 4. Update local record
        const updated = await prisma.invoice.update({
            where: { id },
            data: {
                qbInvoiceId: qbInvoice.Id,
                qbCustomerId,
                status: "SENT",
                sentAt: new Date(),
                qbSyncError: null,
            },
        });

        return NextResponse.json({
            success: true,
            invoice: updated,
            qbDocNumber: qbInvoice.DocNumber,
        });
    } catch (err: any) {
        console.error("[Invoices] Send error:", err);

        // Store the sync error for debugging
        await prisma.invoice.update({
            where: { id },
            data: { qbSyncError: err.message || "Failed to send to QuickBooks" },
        });

        return NextResponse.json(
            { error: err.message || "Failed to send invoice to QuickBooks" },
            { status: 500 }
        );
    }
}
