export const dynamic = 'force-dynamic';
// app/api/admin/meeting-notes/[id]/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken, requireAdmin } from "@/lib/auth-helpers";
import { exportMeetingNotesPdf } from "@/lib/meeting-notes";
import { sendMeetingNotesEmail } from "@/lib/email";

// POST — admin clicks "Send Notes": exports the Doc as PDF and emails it
// to the client, then marks the MeetingNote as sent.
export async function POST(
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

    const meetingNote = await prisma.meetingNote.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!meetingNote) {
      return NextResponse.json({ message: "Meeting note not found" }, { status: 404 });
    }
    if (!meetingNote.client.email) {
      return NextResponse.json({ message: "Client has no email on file" }, { status: 400 });
    }

    const pdfBuffer = await exportMeetingNotesPdf(meetingNote.driveDocId);

    const extraEmails = (meetingNote.client.emails || []).filter(
      (e) => e !== meetingNote.client.email
    );

    const result = await sendMeetingNotesEmail({
      to: meetingNote.client.email,
      cc: extraEmails,
      clientName: meetingNote.client.name,
      meetingDate: meetingNote.meetingDate,
      pdfBuffer,
      docTitle: meetingNote.title,
    });

    if (!result.success) {
      return NextResponse.json({ message: result.error || "Failed to send email" }, { status: 500 });
    }

    const updated = await prisma.meetingNote.update({
      where: { id },
      data: {
        status: "sent",
        sentAt: new Date(),
        sentBy: String((user as any)?.id ?? (user as any)?.userId ?? ""),
      },
    });

    return NextResponse.json({ success: true, meetingNote: updated });
  } catch (err: any) {
    console.error("POST meeting-notes send failed:", err);
    return NextResponse.json({ message: err.message || "Server error" }, { status: 500 });
  }
}