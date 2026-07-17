'use client';

// components/admin/MeetingNotesPanel.tsx
// Drop into a client's admin detail view: <MeetingNotesPanel clientId={client.id} />
// Lets the admin start this week's notes doc (copies the shared template),
// open it in Google Docs to take live notes during the call, and — after
// the meeting — send a PDF copy to the client's email.

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { ExternalLink, FileText, Send, Plus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface MeetingNote {
  id: string;
  title: string;
  driveDocUrl: string;
  meetingDate: string;
  status: 'draft' | 'sent';
  sentAt: string | null;
}

export default function MeetingNotesPanel({ clientId }: { clientId: string }) {
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<MeetingNote | null>(null);

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/meeting-notes`);
      const data = await res.json();
      setNotes(data.meetingNotes || []);
    } catch {
      toast.error('Failed to load meeting notes');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  async function handleStartNotes() {
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/meeting-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingDate: new Date().toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setNotes((prev) => [data.meetingNote, ...prev]);
      toast.success('Notes doc created — opening in Google Docs');
      window.open(data.meetingNote.driveDocUrl, '_blank');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create notes doc');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId);
    try {
      const res = await fetch(`/api/admin/meeting-notes/${noteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success('Meeting note deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete meeting note');
    } finally {
      setDeletingId(null);
      setNoteToDelete(null);
    }
  }

  async function handleSend(noteId: string) {
    setSendingId(noteId);
    try {
      const res = await fetch(`/api/admin/meeting-notes/${noteId}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setNotes((prev) => prev.map((n) => (n.id === noteId ? data.meetingNote : n)));
      toast.success('Notes sent to client');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send notes');
    } finally {
      setSendingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Meeting Notes</CardTitle>
        <Button size="sm" onClick={handleStartNotes} disabled={creating}>
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Plus className="h-4 w-4 mr-1" />
          )}
          Start This Week's Notes
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No meeting notes yet. Start one before your next call.
          </p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{note.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(note.meetingDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={note.status === 'sent' ? 'default' : 'secondary'}>
                  {note.status === 'sent' ? 'Sent' : 'Draft'}
                </Badge>
                <Button size="sm" variant="outline" asChild>
                  <a href={note.driveDocUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </a>
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSend(note.id)}
                  disabled={sendingId === note.id || note.status === 'sent'}
                >
                  {sendingId === note.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  {note.status === 'sent' ? 'Sent' : 'Send Notes'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setNoteToDelete(note)}
                  disabled={deletingId === note.id}
                >
                  {deletingId === note.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete meeting note?</AlertDialogTitle>
            <AlertDialogDescription>
              {noteToDelete && (
                <>
                  This deletes "{noteToDelete.title}"
                  {noteToDelete.status === 'sent' ? ' — it was already sent to the client, this only removes it from the app.' : '.'} The underlying Google Doc is not deleted. This can't be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => noteToDelete && handleDelete(noteToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}