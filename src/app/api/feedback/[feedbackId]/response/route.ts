export const dynamic = 'force-dynamic';
// app/api/feedback/[feedbackId]/response/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { feedbackId: string } }
) {
  try {
    const token = getTokenFromCookies(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { message } = body;
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // senderId comes from the authenticated session, not the request body —
    // a client-supplied senderId would let anyone attribute a reply to
    // someone else in the thread.
    const response = await prisma.feedbackResponse.create({
      data: {
        message: message.trim(),
        feedbackId: params.feedbackId,
        senderId: Number(decoded.userId),
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