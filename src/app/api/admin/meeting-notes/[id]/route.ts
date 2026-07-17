export const dynamic = 'force-dynamic';
// app/api/admin/meeting-notes/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken, requireAdmin } from "@/lib/auth-helpers";

// DELETE — admin deletes a meeting note (draft or already-sent).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromToken(req);
    const authError = requireAdmin(user);
    if (authError) {
      return NextResponse.json({ message: authError.error }, { status: authError.status });
    }

    const { id } = await params;

    const meetingNote = await prisma.meetingNote.findUnique({ where: { id } });
    if (!meetingNote) {
      return NextResponse.json({ message: "Meeting note not found" }, { status: 404 });
    }

    await prisma.meetingNote.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE meeting-notes failed:", err);
    return NextResponse.json({ message: err.message || "Server error" }, { status: 500 });
  }
}
