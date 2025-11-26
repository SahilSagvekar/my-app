import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!id) {
    return NextResponse.json(
      { error: "Notification ID required" },
      { status: 400 }
    );
  }

  try {
    const notif = await prisma.notification.update({
      where: { id },
      data: { read: true }
    });

    return NextResponse.json({ success: true, notification: notif });
  } catch (err) {
    console.error("Mark read error:", err);
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 }
    );
  }
}
