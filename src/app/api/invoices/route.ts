import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/invoices — List invoices
export async function GET(req: NextRequest) {
    const session = await auth();
    if (
        !session?.user?.role ||
        !["admin", "manager"].includes(session.user.role)
    ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const taskId = searchParams.get("taskId");
    const status = searchParams.get("status");

    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (taskId) where.taskId = taskId;
    if (status) where.status = status;

    const invoices = await prisma.invoice.findMany({
        where,
        include: {
            task: { select: { id: true, title: true, taskType: true } },
            client: {
                select: { id: true, name: true, companyName: true, email: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invoices);
}

// POST /api/invoices — Create a draft invoice
export async function POST(req: NextRequest) {
    const session = await auth();
    if (
        !session?.user?.role ||
        !["admin", "manager"].includes(session.user.role)
    ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { taskId, clientId, amount, description, dueDate } = body;

        if (!taskId || !clientId || !amount || !description) {
            return NextResponse.json(
                { error: "taskId, clientId, amount, and description are required" },
                { status: 400 }
            );
        }

        // Verify task and client exist
        const task = await prisma.task.findUnique({ where: { id: taskId } });
        if (!task) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        const client = await prisma.client.findUnique({
            where: { id: clientId },
        });
        if (!client) {
            return NextResponse.json(
                { error: "Client not found" },
                { status: 404 }
            );
        }

        const invoice = await prisma.invoice.create({
            data: {
                taskId,
                clientId,
                amount: parseFloat(amount),
                description,
                dueDate: dueDate ? new Date(dueDate) : null,
                status: "DRAFT",
                createdBy: parseInt(session.user.id as string),
            },
            include: {
                task: { select: { id: true, title: true } },
                client: { select: { id: true, name: true, companyName: true } },
            },
        });

        return NextResponse.json(invoice, { status: 201 });
    } catch (err: any) {
        console.error("[Invoices] Create error:", err);
        return NextResponse.json(
            { error: err.message || "Failed to create invoice" },
            { status: 500 }
        );
    }
}
