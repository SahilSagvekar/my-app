"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import {
  FileText,
  Video,
  Image as ImageIcon,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

interface ProofLink {
  name: string;
  url: string;
  type: "video" | "image" | "file";
}

interface EodTask {
  id: string;
  title: string;
  clientName: string | null;
  status: string;
  proofLinks: ProofLink[];
  eligible: boolean;
  disabledReason: string | null;
}

export function EditorEodReport() {
  const [tasks, setTasks] = useState<EodTask[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [alreadySent, setAlreadySent] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [reportDate, setReportDate] = useState("");

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/editor/eod/tasks", {
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to load tasks");
        return;
      }

      setTasks(data.tasks || []);
      setReportDate(data.reportDate || "");
      setAlreadySent(data.alreadySent || false);
    } catch (err) {
      toast.error("Failed to load EOD tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const toggleTask = (taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const eligibleIds = tasks
      .filter((t) => t.eligible)
      .map((t) => t.id);
    setSelectedIds(new Set(eligibleIds));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const selectedTasks = tasks.filter((t) => selectedIds.has(t.id));
  const eligibleCount = tasks.filter((t) => t.eligible).length;

  const handleSend = async () => {
    if (selectedIds.size === 0) return;
    if (sending) return;

    try {
      setSending(true);
      const res = await fetch("/api/editor/eod/send", {
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
        const errorMsg =
          data.details && Array.isArray(data.details)
            ? data.details.join(", ")
            : data.error || "Failed to send report";
        toast.error(errorMsg);
        return;
      }

      toast.success(
        `EOD report sent! ${data.taskCount} task${data.taskCount > 1 ? "s" : ""} reported.${data.slackSent ? "" : " (Slack delivery failed)"}`
      );
      setSent(true);
      setSelectedIds(new Set());
      setNotes("");
      loadTasks();
    } catch (err) {
      toast.error("Failed to send EOD report");
    } finally {
      setSending(false);
    }
  };

  const formatPreviewDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      IN_PROGRESS: {
        label: "In Progress",
        className: "bg-blue-100 text-blue-700 border-blue-200",
      },
      READY_FOR_QC: {
        label: "Ready for QC",
        className: "bg-yellow-100 text-yellow-700 border-yellow-200",
      },
      QC_IN_PROGRESS: {
        label: "QC In Progress",
        className: "bg-orange-100 text-orange-700 border-orange-200",
      },
      COMPLETED: {
        label: "Completed",
        className: "bg-green-100 text-green-700 border-green-200",
      },
      SCHEDULED: {
        label: "Scheduled",
        className: "bg-emerald-100 text-emerald-700 border-emerald-200",
      },
      POSTED: {
        label: "Posted",
        className: "bg-teal-100 text-teal-700 border-teal-200",
      },
      REJECTED: {
        label: "Rejected",
        className: "bg-red-100 text-red-700 border-red-200",
      },
    };
    const info = map[status] || {
      label: status,
      className: "bg-gray-100 text-gray-700 border-gray-200",
    };
    return (
      <Badge variant="outline" className={`text-[10px] ${info.className}`}>
        {info.label}
      </Badge>
    );
  };

  const getLinkIcon = (type: string) => {
    if (type === "video") return <Video className="h-3 w-3 text-blue-500" />;
    if (type === "image")
      return <ImageIcon className="h-3 w-3 text-emerald-500" />;
    return <FileText className="h-3 w-3 text-gray-400" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading EOD tasks...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-indigo-100">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Send className="h-5 w-5 text-indigo-500" />
              EOD Report
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {reportDate && formatPreviewDate(reportDate)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {alreadySent && !sent && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                Report already sent today
              </Badge>
            )}
            {sent && (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Sent
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadTasks}
              className="h-8"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Task List */}
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No eligible tasks found for today.</p>
          </div>
        ) : (
          <>
            {/* Select controls */}
            <div className="flex items-center gap-3 mb-3 text-xs">
              <span className="text-muted-foreground">
                {selectedIds.size}/{eligibleCount} selected
              </span>
              <button
                onClick={selectAll}
                className="text-indigo-600 hover:underline"
              >
                Select all
              </button>
              <button
                onClick={deselectAll}
                className="text-gray-500 hover:underline"
              >
                Clear
              </button>
            </div>

            {/* Tasks */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    !task.eligible
                      ? "bg-gray-50 opacity-60 cursor-not-allowed"
                      : selectedIds.has(task.id)
                        ? "bg-indigo-50 border-indigo-200"
                        : "bg-white hover:bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="pt-0.5">
                    <Checkbox
                      checked={selectedIds.has(task.id)}
                      onCheckedChange={() => toggleTask(task.id)}
                      disabled={!task.eligible}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">
                        {task.title}
                      </span>
                      {getStatusBadge(task.status)}
                    </div>
                    {task.clientName && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {task.clientName}
                      </p>
                    )}
                    {!task.eligible && task.disabledReason && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {task.disabledReason}
                      </p>
                    )}
                    {task.eligible && task.proofLinks.length > 0 && (
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {task.proofLinks.slice(0, 3).map((link, i) => (
                          <a
                            key={i}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {getLinkIcon(link.type)}
                            <span className="truncate max-w-[120px]">
                              {link.name}
                            </span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ))}
                        {task.proofLinks.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{task.proofLinks.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes for today..."
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
                rows={2}
              />
            </div>

            {/* Preview Toggle */}
            {selectedIds.size > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {showPreview ? "Hide" : "Show"} Slack preview
                  {showPreview ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>

                {showPreview && (
                  <div className="mt-2 p-4 bg-[#1a1d21] text-white rounded-lg text-sm font-mono whitespace-pre-wrap leading-relaxed">
                    <p className="font-bold">
                      📌 EOD Report — You
                    </p>
                    <p className="text-gray-400">
                      Date: {formatPreviewDate(reportDate)}
                    </p>
                    <p className="mt-2 font-bold">
                      ✅ Tasks Completed / Worked On
                    </p>
                    {selectedTasks.map((task, i) => (
                      <div key={task.id} className="mt-2">
                        <p>
                          {i + 1}. {task.title}
                        </p>
                        {task.proofLinks.length > 0 && (
                          <>
                            <p className="text-gray-400 text-xs">
                              Cloudflare/Output Link:
                            </p>
                            {task.proofLinks.map((link, j) => (
                              <p
                                key={j}
                                className="text-blue-400 text-xs truncate"
                              >
                                {link.url}
                              </p>
                            ))}
                          </>
                        )}
                      </div>
                    ))}
                    {notes.trim() && (
                      <div className="mt-3">
                        <p className="font-bold">Notes:</p>
                        <p className="text-gray-300">{notes.trim()}</p>
                      </div>
                    )}
                    <p className="mt-3 text-gray-500 text-xs italic">
                      Generated from E8 App.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Send Button */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {selectedIds.size} task{selectedIds.size !== 1 ? "s" : ""}{" "}
                selected
              </p>
              <Button
                onClick={handleSend}
                disabled={selectedIds.size === 0 || sending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
              >
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
      </CardContent>
    </Card>
  );
}