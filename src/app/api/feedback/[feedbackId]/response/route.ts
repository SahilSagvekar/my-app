// app/api/feedback/[feedbackId]/response/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { feedbackId: string } }
) {
  try {
    const body = await request.json();
    const { message, senderId } = body;

    const response = await prisma.feedbackResponse.create({
      data: {
        message,
        feedbackId: params.feedbackId,
        senderId: parseInt(senderId),
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    // Update feedback status to acknowledged if it was pending
    await prisma.feedback.update({
      where: { id: params.feedbackId },
      data: {
        status: {
          set: "acknowledged",
        },
      },
    });

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Error creating response:", error);
    return NextResponse.json(
      { error: "Failed to create response" },
      { status: 500 }
    );
  }
}