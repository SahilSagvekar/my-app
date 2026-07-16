export const dynamic = 'force-dynamic';
// app/api/admin/clients/[clientId]/meeting-notes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken, requireAdmin } from "@/lib/auth-helpers";
import { createMeetingNotesDoc } from "@/lib/meeting-notes";

// GET — list meeting notes history for a client, newest first
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    const meetingNotes = await prisma.meetingNote.findMany({
      where: { clientId },
      orderBy: { meetingDate: "desc" },
    });

    return NextResponse.json({ meetingNotes });
  } catch (err) {
    console.error("GET meeting-notes failed:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

// POST — admin clicks "Start This Week's Notes": copies the template doc
// into the client's Drive folder and creates a draft MeetingNote row.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const user = getUserFromToken(req);
    const authError = requireAdmin(user);
    if (authError) {
      return NextResponse.json({ message: authError.error }, { status: authError.status });
    }

    const { clientId } = await params;
    const body = await req.json().catch(() => ({}));
    const meetingDate = body.meetingDate ? new Date(body.meetingDate) : new Date();

    const meetingNote = await createMeetingNotesDoc(clientId, meetingDate);

    return NextResponse.json({ success: true, meetingNote }, { status: 201 });
  } catch (err: any) {
    console.error("POST meeting-notes failed:", err);
    return NextResponse.json({ message: err.message || "Server error" }, { status: 500 });
  }
}