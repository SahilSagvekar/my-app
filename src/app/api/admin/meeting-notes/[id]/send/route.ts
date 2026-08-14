export const dynamic = 'force-dynamic';
// app/api/admin/meeting-notes/[id]/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { meetingNote as meetingNoteTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUserFromToken, requireAdmin } from "@/lib/auth-helpers";
import { exportMeetingNotesPdf } from "@/lib/meeting-notes";
import { sendMeetingNotesEmail } from "@/lib/email";

// POST — admin clicks "Send Notes": exports the Doc as PDF and emails it
// to the client, then marks the MeetingNote as sent.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDbHttp();
  try {
    const user = getUserFromToken(req);
    const authError = requireAdmin(user);
    if (authError) {
      return NextResponse.json({ message: authError.error }, { status: authError.status });
    }

    const { id } = await params;

    const meetingNote = await db.query.meetingNote.findFirst({
      where: eq(meetingNoteTable.id, id),
      with: { client: true },
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
      meetingDate: new Date(meetingNote.meetingDate),
      pdfBuffer,
      docTitle: meetingNote.title,
    });

    if (!result.success) {
      return NextResponse.json({ message: result.error || "Failed to send email" }, { status: 500 });
    }

    const [updated] = await db.update(meetingNoteTable).set({
      status: "sent",
      sentAt: new Date().toISOString(),
      sentBy: String((user as any)?.id ?? (user as any)?.userId ?? ""),
      updatedAt: new Date().toISOString(),
    }).where(eq(meetingNoteTable.id, id)).returning();

    return NextResponse.json({ success: true, meetingNote: updated });
  } catch (err: any) {
    console.error("POST meeting-notes send failed:", err);
    return NextResponse.json({ message: err.message || "Server error" }, { status: 500 });
  }
}