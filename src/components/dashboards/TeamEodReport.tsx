"use client";
// src/components/dashboards/TeamEodReport.tsx
// EOD Report for scheduler/videographer — same UI shape as
// EditorEodReport.tsx, pointed at /api/team-eod/* instead of
// /api/editor/eod/*. The API infers which role's data to return from the
// caller's own session, so this component needs no role prop.

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

interface EodItem {
  id: string;
  title: string;
  clientName: string | null;
  status: string;
  proofLinks: never[];
  eligible: boolean;
  disabledReason: string | null;
}

interface TeamEodReportProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isDialog?: boolean;
}

export function TeamEodReport({ open, onOpenChange, isDialog }: TeamEodReportProps = {}) {
  const [items, setItems] = useState<EodItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [alreadySent, setAlreadySent] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [reportDate, setReportDate] = useState("");

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/team-eod/tasks", { credentials: "include" });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to load items");
        return;
      }

      setItems(data.tasks || []);
      setReportDate(data.reportDate || "");
      setAlreadySent(data.alreadySent || false);
    } catch {
      toast.error("Failed to load EOD items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(items.filter((t) => t.eligible).map((t) => t.id)));
  };
  const deselectAll = () => setSelectedIds(new Set());

  const selectedItems = items.filter((t) => selectedIds.has(t.id));
  const eligibleCount = items.filter((t) => t.eligible).length;

  const handleSend = async () => {
    if (selectedIds.size === 0 || sending) return;
    try {
      setSending(true);
      const res = await fetch("/api/team-eod/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          taskIds: Array.from(selectedIds),
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        const errorMsg = Array.isArray(data.details) ? data.details.join(", ") : data.error || "Failed to send report";
        toast.error(errorMsg);
        return;
      }

      toast.success(
        `EOD report sent! ${data.taskCount} item${data.taskCount > 1 ? "s" : ""} reported.${data.slackSent ? "" : " (Slack delivery failed)"}`
      );
      setSent(true);
      setSelectedIds(new Set());
      setNotes("");
      loadItems();
    } catch {
      toast.error("Failed to send EOD report");
    } finally {
      setSending(false);
    }
  };

  const formatPreviewDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      PENDING: { label: "Pending", className: "bg-amber-100 text-amber-700 border-amber-200" },
      IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-700 border-blue-200" },
      COMPLETED: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
      SCHEDULED: { label: "Scheduled", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
      POSTED: { label: "Posted", className: "bg-teal-100 text-teal-700 border-teal-200" },
      CANCELLED: { label: "Cancelled", className: "bg-rose-100 text-rose-700 border-rose-200" },
    };
    const info = map[status] || { label: status, className: "bg-gray-100 text-gray-700 border-gray-200" };
    return (
      <Badge variant="outline" className={`text-[10px] ${info.className}`}>
        {info.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading EOD items...
          </div>
        </CardContent>
      </Card>
    );
  }

  const content = (
    <div className={isDialog ? "p-4 sm:p-6" : ""}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Send className="h-5 w-5 text-indigo-500" />
            EOD Report
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {reportDate && formatPreviewDate(reportDate)}
            {" · "}
            Only items you worked on today between{" "}
            <span className="font-medium text-slate-600">9:00 AM–7:00 PM ET</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {alreadySent && !sent && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">Report already sent today</Badge>
          )}
          {sent && (
            <Badge className="bg-green-100 text-green-700 border-green-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Sent
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={loadItems} className="h-8">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nothing worked on today between 9:00 AM–7:00 PM ET.</p>
          <p className="mt-1 text-xs opacity-70">Update or complete something in that window to include it here.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3 text-xs">
            <span className="text-muted-foreground">{selectedIds.size}/{eligibleCount} selected</span>
            <button onClick={selectAll} className="text-indigo-600 hover:underline">Select all</button>
            <button onClick={deselectAll} className="text-gray-500 hover:underline">Clear</button>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  !item.eligible
                    ? "bg-gray-50 opacity-60 cursor-not-allowed"
                    : selectedIds.has(item.id)
                      ? "bg-indigo-50 border-indigo-200"
                      : "bg-white hover:bg-gray-50 border-gray-200"
                }`}
              >
                <div className="pt-0.5">
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => toggleItem(item.id)}
                    disabled={!item.eligible}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{item.title}</span>
                    {getStatusBadge(item.status)}
                  </div>
                  {item.clientName && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.clientName}</p>
                  )}
                  {!item.eligible && item.disabledReason && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {item.disabledReason}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium text-gray-700 mb-1 block">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes for today..."
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
              rows={2}
            />
          </div>

          {selectedIds.size > 0 && (
            <div className="mt-3">
              <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                <Eye className="h-3.5 w-3.5" />
                {showPreview ? "Hide" : "Show"} Slack preview
                {showPreview ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              {showPreview && (
                <div className="mt-2 p-4 bg-[#1a1d21] text-white rounded-lg text-sm font-mono whitespace-pre-wrap leading-relaxed">
                  <p className="font-bold">📌 EOD Report — You</p>
                  <p className="text-gray-400">Date: {formatPreviewDate(reportDate)}</p>
                  <p className="mt-2 font-bold">✅ Worked On Today</p>
                  {selectedItems.map((item, i) => (
                    <div key={item.id} className="mt-2">
                      <p>{i + 1}. {item.title}</p>
                    </div>
                  ))}
                  {notes.trim() && (
                    <div className="mt-3">
                      <p className="font-bold">Notes:</p>
                      <p className="text-gray-300">{notes.trim()}</p>
                    </div>
                  )}
                  <p className="mt-3 text-gray-500 text-xs italic">Generated from E8 App.</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""} selected</p>
            <Button onClick={handleSend} disabled={selectedIds.size === 0 || sending} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              {sending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send EOD Report
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  if (isDialog) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Send EOD Report</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Card className="border-2 border-indigo-100">
      <CardContent className="p-6">{content}</CardContent>
    </Card>
  );
}
