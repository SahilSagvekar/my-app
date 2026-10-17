"use client";
import React  from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Bug, ChevronDown, ChevronUp, ExternalLink, ImagePlus, Loader2, MessageSquare, Plus, Trash2, Video, X, RefreshCw } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { PageHeader } from "../ui/page-header";

// ── constants ─────────────────────────────────────────────────────────────
const TYPES = [
  { id: "BUG", label: "Bug" },
  { id: "REQUEST", label: "Request" },
  { id: "IMPROVEMENT", label: "Improvement" },
  { id: "QUESTION", label: "Question" },
];
const PRIORITIES = [
  { id: "UNSET", label: "Not set", style: "bg-gray-100 text-gray-700" },
  { id: "LOW", label: "Low", style: "bg-blue-100 text-blue-800" },
  { id: "MEDIUM", label: "Medium", style: "bg-yellow-100 text-yellow-800" },
  { id: "HIGH", label: "High", style: "bg-orange-100 text-orange-800" },
  { id: "URGENT", label: "Urgent", style: "bg-red-100 text-red-800" },
];
const STATUSES = [
  { id: "OPEN", label: "Open", style: "bg-yellow-100 text-yellow-800" },
  { id: "IN_PROGRESS", label: "In progress", style: "bg-blue-100 text-blue-800" },
  { id: "DONE", label: "Done", style: "bg-green-100 text-green-800" },
  { id: "WONT_FIX", label: "Won't fix", style: "bg-gray-100 text-gray-700" },
];

interface Ticket {
  id: string;
  title: string;
  description: string | null;
  type: string;
  source: "INTERNAL" | "CLIENT";
  clientName: string | null;
  priority: string;
  status: string;
  loomUrl: string | null;
  reporterId: number;
  reporterName: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  createdAt: string;
  attachmentCount: number;
}
interface Attachment { id: string; fileName: string; url: string }
interface Comment { id: string; message: string; createdAt: string; authorName: string | null }
interface Detail {
  ticket: Ticket;
  attachments: Attachment[];
  comments: Comment[];
  me: { userId: number; canTriage: boolean };
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
};

// DB timestamps are UTC without a zone suffix.
const toDate = (iso: string) => new Date(/Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");
const fmtLogged = (iso: string) =>
  toDate(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }) + " ET";

const loomEmbed = (url: string) => {
  const m = url.match(/loom\.com\/(?:share|embed)\/([A-Za-z0-9]+)/i);
  return m ? `https://www.loom.com/embed/${m[1]}` : null;
};

const priorityOf = (id: string) => PRIORITIES.find((p) => p.id === id) ?? PRIORITIES[0];
const statusOf = (id: string) => STATUSES.find((s) => s.id === id) ?? STATUSES[0];

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

async function uploadScreenshots(ticketId: string, files: File[]) {
  for (const file of files) {
    const fd = new FormData();
    fd.append("file", file);
    await api(`/api/dev-portal/tickets/${ticketId}/attachments`, { method: "POST", body: fd });
  }
}

// ── page ──────────────────────────────────────────────────────────────────
export function DevPortalPage() {
  const [status, setStatus] = useState("active");
  const [priority, setPriority] = useState("all");
  const [source, setSource] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [sortBy, setSortBy] = useState("latest");
  const [openId, setOpenId] = useState<string | null>(null);

  const qs = new URLSearchParams();
  if (status !== "active" && status !== "all") qs.set("status", status);
  if (priority !== "all") qs.set("priority", priority);
  if (source !== "all") qs.set("source", source);
  if (assignee !== "all") qs.set("assignee", assignee);

  const { data, error, isLoading, mutate } = useSWR<{ tickets: Ticket[]; me: { userId: number; canTriage: boolean } }>(
    `/api/dev-portal/tickets?${qs.toString()}`,
    fetcher
  );
  const { data: assigneeData } = useSWR<{ users: { id: number; name: string }[] }>("/api/dev-portal/assignees", fetcher);

  const tickets = useMemo(() => {
    let list = data?.tickets ?? [];
    if (status === "active") {
      list = list.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS");
    }
    // Sort by date
    if (sortBy === "latest") {
      list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === "oldest") {
      list = [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return list;
  }, [data, status, sortBy]);

  const clientOpen = tickets.filter((t) => t.source === "CLIENT" && (t.status === "OPEN" || t.status === "IN_PROGRESS")).length;

  return (
    <div className="space-y-6 px-4 sm:px-6 max-w-6xl mx-auto">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Bug className="h-6 w-6" /> Dev Tickets
          </span>
        }
        description={
          <>
            Log problems, requests and ideas. Client reports are pinned to the top.
            {clientOpen > 0 && <span className="font-medium text-red-600"> {clientOpen} open from clients.</span>}
          </>
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5 border-gray-300">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      <QuickAdd onCreated={() => mutate(undefined, { revalidate: true })} />

      <div className="flex flex-wrap gap-2">
        <FilterSelect value={status} onChange={setStatus} label="Status" options={[{ id: "active", label: "Active" }, { id: "all", label: "All" }, ...STATUSES]} />
        <FilterSelect value={priority} onChange={setPriority} label="Priority" options={[{ id: "all", label: "Any priority" }, ...PRIORITIES]} />
        <FilterSelect value={source} onChange={setSource} label="Source" options={[{ id: "all", label: "All sources" }, { id: "CLIENT", label: "Clients" }, { id: "INTERNAL", label: "Internal" }]} />
        <FilterSelect value={sortBy} onChange={setSortBy} label="Sort by" options={[{ id: "latest", label: "Latest" }, { id: "oldest", label: "Oldest" }]} />
        <FilterSelect
          value={assignee}
          onChange={setAssignee}
          label="Assignee"
          options={[
            { id: "all", label: "Anyone" },
            { id: "me", label: "Assigned to me" },
            { id: "none", label: "Unassigned" },
            ...(assigneeData?.users ?? []).map((u) => ({ id: String(u.id), label: u.name })),
          ]}
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : tickets.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nothing here. Nice.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <TicketRow key={t.id} ticket={t} onClick={() => setOpenId(t.id)} />
          ))}
        </div>
      )}

      <TicketDialog
        ticketId={openId}
        assignees={assigneeData?.users ?? []}
        onClose={() => setOpenId(null)}
        onChanged={() => mutate()}
      />
    </div>
  );
}

function FilterSelect({
  value, onChange, label, options,
}: { value: string; onChange: (v: string) => void; label: string; options: { id: string; label: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[170px] h-9" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── quick add ─────────────────────────────────────────────────────────────
function QuickAdd({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("BUG");
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState("");
  const [loomUrl, setLoomUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addImages = useCallback((incoming: File[]) => {
    const imgs = incoming.filter((f) => f.type.startsWith("image/"));
    if (imgs.length) {
      setFiles((prev) => [...prev, ...imgs].slice(0, 8));
      setExpanded(true);
    }
  }, []);

  // Paste a screenshot straight from the clipboard.
  const onPaste = (e: React.ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length) {
      e.preventDefault();
      addImages(imgs);
    }
  };

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const { ticket } = await api("/api/dev-portal/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type, description: description || undefined, loomUrl: loomUrl || undefined }),
      });
      if (files.length) {
        try {
          setUploading(true);
          await uploadScreenshots(ticket.id, files);
        } catch (err: any) {
          toast.error(`Ticket logged, but a screenshot failed: ${err.message}`);
        } finally {
          setUploading(false);
        }
      }
      toast.success("Logged");
      setTitle(""); setDescription(""); setLoomUrl(""); setFiles([]); setType("BUG"); setExpanded(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Auto-expand details when user starts typing in title
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    if (!expanded && e.target.value.length > 0) {
      setExpanded(true);
    }
  };

  return (
    <Card className="border-2 border-gray-200">
      <CardContent className="p-5 space-y-4" onPaste={onPaste}>
        <div className="flex flex-wrap gap-3">
          <Input
            className="flex-1 min-w-[220px] h-10 border-gray-300 focus:border-gray-400"
            placeholder="What's wrong, or what do you need?"
            value={title}
            onChange={handleTitleChange}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            maxLength={200}
          />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[150px] h-10 border-gray-300"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setExpanded((v) => !v)} type="button" className="h-10 border-gray-300 gap-1.5">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? "Less" : "More"}
          </Button>
          <Button onClick={submit} disabled={saving || !title.trim()} className="gap-1.5 h-10 bg-gray-900 hover:bg-gray-800">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create ticket
          </Button>
        </div>

        {expanded && (
          <div className="space-y-3">
            <Textarea placeholder="Steps to reproduce, what you expected, who's affected…" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="border-gray-300 focus:border-gray-400" />
            <Input placeholder="Loom link (optional) — https://www.loom.com/share/…" value={loomUrl} onChange={(e) => setLoomUrl(e.target.value)} className="border-gray-300 focus:border-gray-400" />
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addImages(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
              <Button variant="outline" size="sm" type="button" className="gap-1.5 border-gray-300" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4" /> Add screenshots
              </Button>
              <span className="text-xs text-muted-foreground">or paste one (Ctrl/⌘+V). Up to 8.</span>
            </div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previews[i]} alt={f.name} className="h-16 w-16 rounded-md object-cover border" />
                    {uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-md">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                      </div>
                    )}
                    <button type="button" aria-label="Remove" className="absolute -top-1.5 -right-1.5 rounded-full bg-gray-200 border border-gray-300 p-1" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4 text-black" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── list row ──────────────────────────────────────────────────────────────
function TicketRow({ ticket: t, onClick }: { ticket: Ticket; onClick: () => void }) {
  const pri = priorityOf(t.priority);
  const st = statusOf(t.status);
  const done = t.status === "DONE" || t.status === "WONT_FIX";

  // Border color based on status
  const getBorderColor = () => {
    if (t.source === "CLIENT" && !done) return "border-red-300 ring-1 ring-red-100";
    if (t.status === "OPEN") return "border-yellow-300";
    if (t.status === "IN_PROGRESS") return "border-blue-300";
    if (t.status === "DONE") return "border-green-300";
    if (t.status === "WONT_FIX") return "border-gray-300";
    return "border-gray-200";
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border bg-white p-4 hover:bg-gray-50 transition ${getBorderColor()} ${done ? "opacity-60" : ""}`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          {/* Ticket title */}
          <p className={`font-medium text-gray-900 ${done ? "line-through" : ""} flex-1`}>{t.title}</p>

          {/* Assignee badge in right corner */}
          {t.assigneeName ? (
            <Badge variant="outline" className="bg-gray-100 border-gray-300 text-gray-700 shrink-0">
              {t.assigneeName}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-gray-50 border-gray-200 text-gray-400 shrink-0">
              Unassigned
            </Badge>
          )}
        </div>

        {/* Tags and logged info in same flex row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1.5">
            {t.source === "CLIENT" && <Badge className="bg-red-600 text-white">Client{t.clientName ? ` · ${t.clientName}` : ""}</Badge>}
            <Badge className={pri.style}>{pri.label}</Badge>
            <Badge variant="outline" className="border-gray-300">{TYPES.find((x) => x.id === t.type)?.label ?? t.type}</Badge>
            <Badge className={st.style}>{st.label}</Badge>
          </div>

          {/* Logged info */}
          <p className="text-xs text-gray-500">
            Logged <span className="font-bold text-black">{fmtLogged(t.createdAt)}</span> by {t.reporterName ?? "unknown"}
          </p>

          {/* Icons */}
          <div className="flex items-center gap-3 text-gray-400 text-xs shrink-0 ml-auto">
            {t.attachmentCount > 0 && <span className="flex items-center gap-1"><ImagePlus className="h-3.5 w-3.5" />{t.attachmentCount}</span>}
            {t.loomUrl && <Video className="h-3.5 w-3.5" />}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── detail dialog ─────────────────────────────────────────────────────────
function TicketDialog({
  ticketId, assignees, onClose, onChanged,
}: { ticketId: string | null; assignees: { id: number; name: string }[]; onClose: () => void; onChanged: () => void }) {
  const { data, mutate } = useSWR<Detail>(ticketId ? `/api/dev-portal/tickets/${ticketId}` : null, fetcher);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Track pending changes for triage controls
  const [pendingPriority, setPendingPriority] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [pendingAssignee, setPendingAssignee] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Track uploading and deleting states
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [deletingAttachments, setDeletingAttachments] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);

  const t = data?.ticket;
  const canTriage = !!data?.me.canTriage;
  // Mirrors the API: triagers can edit anything; the reporter can edit their own ticket while it is OPEN.
  const canEditDetails = canTriage || (!!t && data?.me.userId === t.reporterId && t.status === "OPEN");

  // Track description / loom editing
  const [descriptionText, setDescriptionText] = useState(t?.description || "");
  const [loomUrlText, setLoomUrlText] = useState(t?.loomUrl || "");
  const [descriptionModified, setDescriptionModified] = useState(false);
  const [loomUrlModified, setLoomUrlModified] = useState(false);

  // Reset pending state when ticket data changes
  React.useEffect(() => {
    if (t) {
      setPendingPriority(null);
      setPendingStatus(null);
      setPendingAssignee(null);
      setDescriptionText(t.description || "");
      setLoomUrlText(t.loomUrl || "");
      setDescriptionModified(false);
      setLoomUrlModified(false);
    }
  }, [t?.id, t?.priority, t?.status, t?.assigneeId, t?.description, t?.loomUrl]);

  const hasUnsavedChanges = pendingPriority !== null || pendingStatus !== null || pendingAssignee !== null || descriptionModified || loomUrlModified;

  const saveChanges = async () => {
    if (!ticketId || !hasUnsavedChanges) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (pendingPriority !== null) body.priority = pendingPriority;
      if (pendingStatus !== null) body.status = pendingStatus;
      if (pendingAssignee !== null) body.assigneeId = pendingAssignee === "none" ? null : Number(pendingAssignee);
      if (descriptionModified) body.description = descriptionText || null;
      if (loomUrlModified) body.loomUrl = loomUrlText || null;

      await api(`/api/dev-portal/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await mutate();
      onChanged();
      toast.success("Saved");
      setDescriptionModified(false);
      setLoomUrlModified(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const patch = async (body: Record<string, unknown>) => {
    if (!ticketId) return;
    try {
      await api(`/api/dev-portal/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await mutate();
      onChanged();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const postComment = async () => {
    if (!ticketId || !comment.trim()) return;
    setPosting(true);
    try {
      await api(`/api/dev-portal/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: comment }),
      });
      setComment("");
      await mutate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPosting(false);
    }
  };

  const addFiles = async (files: File[]) => {
    if (!ticketId) return;
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    setIsUploading(true);
    try {
      await uploadScreenshots(ticketId, imageFiles);
      await mutate();
      onChanged();
      toast.success("Screenshots uploaded");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = async (id: string) => {
    if (!ticketId) return;
    setDeletingAttachments((prev) => new Set([...prev, id]));
    try {
      await api(`/api/dev-portal/tickets/${ticketId}/attachments?attachmentId=${id}`, { method: "DELETE" });
      await mutate();
      onChanged();
      toast.success("Screenshot removed");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeletingAttachments((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const remove = async () => {
    if (!ticketId || !confirm("Delete this ticket and its screenshots? This can't be undone.")) return;
    try {
      await api(`/api/dev-portal/tickets/${ticketId}`, { method: "DELETE" });
      toast.success("Deleted");
      onChanged();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const embed = t?.loomUrl ? loomEmbed(t.loomUrl) : null;

  return (
    <Dialog open={!!ticketId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:w-[60vw] sm:max-w-[1200px]">
        {!t ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6">{t.title}</DialogTitle>
              <p className="text-xs text-muted-foreground">
                Logged {fmtLogged(t.createdAt)} by {t.reporterName ?? "unknown"}
                {t.source === "CLIENT" && ` · Client${t.clientName ? `: ${t.clientName}` : ""}`}
              </p>
            </DialogHeader>

            {/* Triage controls (admins) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <LabeledSelect label="Priority" value={pendingPriority ?? t.priority} disabled={!canTriage} onChange={setPendingPriority} options={PRIORITIES} />
              <LabeledSelect label="Status" value={pendingStatus ?? t.status} disabled={!canTriage} onChange={setPendingStatus} options={STATUSES} />
              <LabeledSelect
                label="Assignee"
                value={pendingAssignee ?? (t.assigneeId ? String(t.assigneeId) : "none")}
                disabled={!canTriage}
                onChange={setPendingAssignee}
                options={[{ id: "none", label: "Unassigned" }, ...assignees.map((u) => ({ id: String(u.id), label: u.name }))]}
              />
            </div>

            {/* Description */}
            {canEditDetails ? (
              <Textarea
                placeholder="Steps to reproduce, what you expected, who's affected…"
                value={descriptionText}
                onChange={(e) => { setDescriptionText(e.target.value); setDescriptionModified(true); }}
                className="border-gray-300 focus:border-gray-400"
                rows={4}
              />
            ) : (
              t.description && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-200">{t.description}</p>
              )
            )}

            {/* Loom link (editors only; everyone else sees the embed below) */}
            {canEditDetails && (
              <Input
                placeholder="Loom link (optional) — https://www.loom.com/share/…"
                value={loomUrlText}
                onChange={(e) => { setLoomUrlText(e.target.value); setLoomUrlModified(true); }}
                className="border-gray-300 focus:border-gray-400"
              />
            )}

            {/* Save button - only show when there are unsaved changes */}
            {hasUnsavedChanges && (
              <div className="flex justify-end">
                <Button onClick={saveChanges} disabled={saving} className="gap-1.5 bg-gray-900 hover:bg-gray-800">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save changes
                </Button>
              </div>
            )}

            {t.loomUrl && (
              <div className="space-y-2">
                {embed && <iframe src={embed} className="w-full aspect-video rounded-lg border" allowFullScreen title="Loom recording" />}
                <a href={t.loomUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm underline">
                  <ExternalLink className="h-3.5 w-3.5" /> Open Loom
                </a>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">Screenshots ({data!.attachments.length})</p>
                <>
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
                  <Button variant="outline" size="sm" className="gap-1.5 border-gray-300" onClick={() => fileRef.current?.click()} disabled={isUploading}>
                    {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Add
                  </Button>
                </>
              </div>
              {data!.attachments.length > 0 && (
                <div className="relative">
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg z-10">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
                        <p className="text-sm text-gray-600">Uploading...</p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {data!.attachments.map((a) => (
                      <div key={a.id} className="relative group">
                        <a href={a.url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.url} alt={a.fileName} className="w-full h-32 object-cover rounded-lg border border-gray-200" />
                        </a>
                        {deletingAttachments.has(a.id) && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                            <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                          </div>
                        )}
                        <button
                          type="button"
                          aria-label="Remove screenshot"
                          className="absolute top-1.5 right-1.5 rounded-full bg-gray-200 border border-gray-300 p-1.5 opacity-0 group-hover:opacity-100 transition shadow-sm"
                          onClick={() => removeAttachment(a.id)}
                          disabled={deletingAttachments.has(a.id)}
                        >
                          <X className="h-4 w-4 text-black" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5"><MessageSquare className="h-4 w-4" /> Comments ({data!.comments.length})</p>
              {data!.comments.map((c) => (
                <div key={c.id} className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">{c.authorName ?? "Someone"} · {fmtLogged(c.createdAt)}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{c.message}</p>
                </div>
              ))}
              <div className="flex gap-2">
                <Textarea rows={2} placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} className="border-gray-300 focus:border-gray-400" />
                <Button onClick={postComment} disabled={posting || !comment.trim()} className="bg-gray-900 hover:bg-gray-800">Post</Button>
              </div>
            </div>

            {canTriage && (
              <div className="pt-2 border-t flex justify-end">
                <Button variant="ghost" size="sm" className="gap-1.5 text-red-600" onClick={remove}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete ticket
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LabeledSelect({
  label, value, options, onChange, disabled,
}: { label: string; value: string; options: { id: string; label: string }[]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}