// app/api/feedback/[feedbackId]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PATCH(
  request: NextRequest,
  { params }: { params: { feedbackId: string } }
) {
  try {
    const body = await request.json();
    const { status } = body;

    const feedback = await prisma.feedback.update({
      where: { id: params.feedbackId },
      data: { status },
    });

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("Error updating feedback status:", error);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}