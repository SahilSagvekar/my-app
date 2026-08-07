"use client";

import { useEffect, useState } from "react";
import { MessageSquare, ExternalLink, Send, Loader2, Image as ImageIcon } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Dialog, DialogContent } from "./ui/dialog";
import { toast } from "sonner";

interface FeedbackResponseItem {
  id: string;
  message: string;
  createdAt: string;
  sender: { id: number; name: string | null; role: string | null };
}

interface FeedbackItem {
  id: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  screenshotBase64: string | null;
  pageUrl: string | null;
  sender: { id: number; name: string | null; role: string | null };
  responses: FeedbackResponseItem[];
}

// Higher number = more urgent, sorts first.
const PRIORITY_RANK: Record<string, number> = { urgent: 3, high: 2, normal: 1, low: 0 };
const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  normal: "bg-blue-100 text-blue-700 border-blue-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};
const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  acknowledged: "bg-sky-100 text-sky-800 border-sky-200",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface FeedbackSystemProps {
  currentRole?: string;
}

export function FeedbackSystem({ currentRole }: FeedbackSystemProps) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingReplyFor, setSendingReplyFor] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load feedback");
      const data = await res.json();
      setItems(data.feedback || []);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't load feedback");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateFeedback = async (id: string, patch: { status?: string; priority?: string }) => {
    setUpdatingId(id);
    // Optimistic update, reverted on failure.
    const prev = items;
    setItems((cur) => cur.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    try {
      const res = await fetch(`/api/feedback/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems(prev);
      toast.error("Failed to update — try again");
    } finally {
      setUpdatingId(null);
    }
  };

  const sendReply = async (id: string) => {
    const message = (replyDrafts[id] || "").trim();
    if (!message) return;
    setSendingReplyFor(id);
    try {
      const res = await fetch(`/api/feedback/${id}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error();
      setReplyDrafts((d) => ({ ...d, [id]: "" }));
      await load();
      toast.success("Reply sent");
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setSendingReplyFor(null);
    }
  };

  const filtered = items
    .filter((f) => statusFilter === "all" || f.status === statusFilter)
    .sort((a, b) => {
      const pDiff = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
      if (pDiff !== 0) return pDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); // oldest first within same priority
    });

  const pendingCount = items.filter((f) => f.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="mb-2 pb-6 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-7 w-7" />
            Feedback
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Everything reported via "Report a Problem" across every portal, in one queue.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({items.length})</SelectItem>
            <SelectItem value="pending">Pending ({pendingCount})</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading feedback...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          Nothing here{statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}.
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((f) => (
          <div key={f.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{f.sender?.name || "Unknown"}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">{f.sender?.role || "—"}</Badge>
                  <span className="text-xs text-muted-foreground">{timeAgo(f.createdAt)}</span>
                </div>
                <p className="font-medium mt-1">{f.subject}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select
                  value={f.priority}
                  onValueChange={(v) => updateFeedback(f.id, { priority: v })}
                  disabled={updatingId === f.id}
                >
                  <SelectTrigger className={`h-7 w-[100px] text-xs border ${PRIORITY_STYLES[f.priority] || ""}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={f.status}
                  onValueChange={(v) => updateFeedback(f.id, { status: v })}
                  disabled={updatingId === f.id}
                >
                  <SelectTrigger className={`h-7 w-[120px] text-xs border ${STATUS_STYLES[f.status] || ""}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{f.message}</p>

            {f.pageUrl && (
              <a
                href={f.pageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
              >
                <ExternalLink className="h-3 w-3" />
                {f.pageUrl}
              </a>
            )}

            {f.screenshotBase64 && (
              <button
                type="button"
                onClick={() => setExpandedScreenshot(f.screenshotBase64)}
                className="mt-3 block"
              >
                <img
                  src={f.screenshotBase64}
                  alt="Screenshot"
                  className="max-h-40 rounded-md border hover:opacity-90 transition-opacity"
                />
              </button>
            )}
            {!f.screenshotBase64 && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" /> No screenshot attached
              </div>
            )}

            {f.responses.length > 0 && (
              <div className="mt-4 space-y-2 border-t pt-3">
                {f.responses.map((r) => (
                  <div key={r.id} className="text-sm bg-muted/50 rounded-md p-2">
                    <span className="font-medium">{r.sender?.name || "Team"}</span>{" "}
                    <span className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                    <p className="mt-0.5">{r.message}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <Textarea
                value={replyDrafts[f.id] || ""}
                onChange={(e) => setReplyDrafts((d) => ({ ...d, [f.id]: e.target.value }))}
                placeholder="Reply..."
                className="min-h-[36px] h-9 py-2 text-sm resize-none"
              />
              <Button
                size="sm"
                onClick={() => sendReply(f.id)}
                disabled={sendingReplyFor === f.id || !(replyDrafts[f.id] || "").trim()}
              >
                {sendingReplyFor === f.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!expandedScreenshot} onOpenChange={(o) => !o && setExpandedScreenshot(null)}>
        <DialogContent className="max-w-4xl">
          {expandedScreenshot && (
            <img src={expandedScreenshot} alt="Screenshot" className="w-full h-auto rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}