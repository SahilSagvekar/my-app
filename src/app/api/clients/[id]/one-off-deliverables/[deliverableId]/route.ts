export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET - Get a single one-off deliverable
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string; deliverableId: string }> }
) {
    try {
        const { id: clientId, deliverableId } = await params;

        const deliverable = await prisma.oneOffDeliverable.findFirst({
            where: {
                id: deliverableId,
                clientId: clientId,
            },
            include: {
                tasks: true
            }
        });

        if (!deliverable) {
            return NextResponse.json({ message: "One-off deliverable not found" }, { status: 404 });
        }

        return NextResponse.json({ deliverable });

    } catch (err) {
        console.error("GET one-off deliverable failed:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}

// PUT - Update a one-off deliverable
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string; deliverableId: string }> }
) {
    try {
        const { id: clientId, deliverableId } = await params;
        const data = await req.json();

        // Verify exists
        const existing = await prisma.oneOffDeliverable.findFirst({
            where: {
                id: deliverableId,
                clientId: clientId,
            },
        });

        if (!existing) {
            return NextResponse.json({ message: "One-off deliverable not found" }, { status: 404 });
        }

        const deliverable = await prisma.oneOffDeliverable.update({
            where: { id: deliverableId },
            data: {
                type: data.type,
                quantity: data.quantity,
                videosPerDay: data.videosPerDay,
                postingSchedule: data.postingSchedule,
                postingDays: data.postingDays,
                postingTimes: data.postingTimes,
                platforms: data.platforms,
                description: data.description,
                status: data.status,
            },
        });

        return NextResponse.json({ success: true, deliverable });

    } catch (err) {
        console.error("PUT one-off deliverable failed:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}

// DELETE - Delete a one-off deliverable
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string; deliverableId: string }> }
) {
    try {
        const { id: clientId, deliverableId } = await params;

        const existing = await prisma.oneOffDeliverable.findFirst({
            where: {
                id: deliverableId,
                clientId: clientId,
            },
        });

        if (!existing) {
            return NextResponse.json({ message: "One-off deliverable not found" }, { status: 404 });
        }

        await prisma.oneOffDeliverable.delete({
            where: { id: deliverableId },
        });

        return NextResponse.json({ success: true, message: "Deleted successfully" });

    } catch (err) {
        console.error("DELETE one-off deliverable failed:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
