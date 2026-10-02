"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Bug, ExternalLink, ImagePlus, Loader2, MessageSquare, Plus, Trash2, Video, X } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

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
    const list = data?.tickets ?? [];
    return status === "active" ? list.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS") : list;
  }, [data, status]);

  const clientOpen = tickets.filter((t) => t.source === "CLIENT" && (t.status === "OPEN" || t.status === "IN_PROGRESS")).length;

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bug className="h-6 w-6" /> Dev Tickets
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Log problems, requests and ideas. Client reports are pinned to the top.
          {clientOpen > 0 && <span className="font-medium text-red-600"> {clientOpen} open from clients.</span>}
        </p>
      </div>

      <QuickAdd onCreated={() => mutate()} />

      <div className="flex flex-wrap gap-2">
        <FilterSelect value={status} onChange={setStatus} label="Status" options={[{ id: "active", label: "Active" }, { id: "all", label: "All" }, ...STATUSES]} />
        <FilterSelect value={priority} onChange={setPriority} label="Priority" options={[{ id: "all", label: "Any priority" }, ...PRIORITIES]} />
        <FilterSelect value={source} onChange={setSource} label="Source" options={[{ id: "all", label: "All sources" }, { id: "CLIENT", label: "Clients" }, { id: "INTERNAL", label: "Internal" }]} />
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
          await uploadScreenshots(ticket.id, files);
        } catch (err: any) {
          toast.error(`Ticket logged, but a screenshot failed: ${err.message}`);
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

  return (
    <Card>
      <CardContent className="p-4 space-y-3" onPaste={onPaste}>
        <div className="flex flex-wrap gap-2">
          <Input
            className="flex-1 min-w-[220px]"
            placeholder="What's wrong, or what do you need?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            maxLength={200}
          />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setExpanded((v) => !v)} type="button">
            {expanded ? "Less" : "Details"}
          </Button>
          <Button onClick={submit} disabled={saving || !title.trim()} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Log it
          </Button>
        </div>

        {expanded && (
          <div className="space-y-3">
            <Textarea placeholder="Steps to reproduce, what you expected, who's affected…" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input placeholder="Loom link (optional) — https://www.loom.com/share/…" value={loomUrl} onChange={(e) => setLoomUrl(e.target.value)} />
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addImages(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
              <Button variant="outline" size="sm" type="button" className="gap-1.5" onClick={() => fileRef.current?.click()}>
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
                    <button type="button" aria-label="Remove" className="absolute -top-1.5 -right-1.5 rounded-full bg-background border p-0.5" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3" />
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border bg-card p-3 sm:p-4 hover:bg-muted/50 transition ${t.source === "CLIENT" && !done ? "border-red-300 ring-1 ring-red-100" : ""} ${done ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {t.source === "CLIENT" && <Badge className="bg-red-600 text-white">Client{t.clientName ? ` · ${t.clientName}` : ""}</Badge>}
            <Badge className={pri.style}>{pri.label}</Badge>
            <Badge variant="outline">{TYPES.find((x) => x.id === t.type)?.label ?? t.type}</Badge>
            <Badge className={st.style}>{st.label}</Badge>
          </div>
          <p className={`font-medium ${done ? "line-through" : ""}`}>{t.title}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Logged {fmtLogged(t.createdAt)} by {t.reporterName ?? "unknown"}
            {t.assigneeName ? ` · → ${t.assigneeName}` : " · unassigned"}
          </p>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground text-xs shrink-0">
          {t.attachmentCount > 0 && <span className="flex items-center gap-1"><ImagePlus className="h-3.5 w-3.5" />{t.attachmentCount}</span>}
          {t.loomUrl && <Video className="h-3.5 w-3.5" />}
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

  const t = data?.ticket;
  const canTriage = !!data?.me.canTriage;

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
    try {
      await uploadScreenshots(ticketId, files.filter((f) => f.type.startsWith("image/")));
      await mutate();
      onChanged();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const removeAttachment = async (id: string) => {
    if (!ticketId) return;
    try {
      await api(`/api/dev-portal/tickets/${ticketId}/attachments?attachmentId=${id}`, { method: "DELETE" });
      await mutate();
      onChanged();
    } catch (err: any) {
      toast.error(err.message);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <LabeledSelect label="Priority" value={t.priority} disabled={!canTriage} onChange={(v) => patch({ priority: v })} options={PRIORITIES} />
              <LabeledSelect label="Status" value={t.status} disabled={!canTriage} onChange={(v) => patch({ status: v })} options={STATUSES} />
              <LabeledSelect
                label="Assignee"
                value={t.assigneeId ? String(t.assigneeId) : "none"}
                disabled={!canTriage}
                onChange={(v) => patch({ assigneeId: v === "none" ? null : Number(v) })}
                options={[{ id: "none", label: "Unassigned" }, ...assignees.map((u) => ({ id: String(u.id), label: u.name }))]}
              />
            </div>

            {t.description && <p className="text-sm whitespace-pre-wrap">{t.description}</p>}

            {t.loomUrl && (
              <div className="space-y-2">
                {embed && <iframe src={embed} className="w-full aspect-video rounded-lg border" allowFullScreen title="Loom recording" />}
                <a href={t.loomUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm underline">
                  <ExternalLink className="h-3.5 w-3.5" /> Open Loom
                </a>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Screenshots ({data!.attachments.length})</p>
                <>
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="h-3.5 w-3.5" /> Add
                  </Button>
                </>
              </div>
              {data!.attachments.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {data!.attachments.map((a) => (
                    <div key={a.id} className="relative group">
                      <a href={a.url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt={a.fileName} className="w-full h-28 object-cover rounded-md border" />
                      </a>
                      <button
                        type="button"
                        aria-label="Remove screenshot"
                        className="absolute top-1 right-1 rounded-full bg-background/90 border p-1 opacity-0 group-hover:opacity-100 transition"
                        onClick={() => removeAttachment(a.id)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-1.5"><MessageSquare className="h-4 w-4" /> Comments ({data!.comments.length})</p>
              {data!.comments.map((c) => (
                <div key={c.id} className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-xs text-muted-foreground">{c.authorName ?? "Someone"} · {fmtLogged(c.createdAt)}</p>
                  <p className="text-sm whitespace-pre-wrap mt-0.5">{c.message}</p>
                </div>
              ))}
              <div className="flex gap-2">
                <Textarea rows={2} placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
                <Button onClick={postComment} disabled={posting || !comment.trim()}>Post</Button>
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
