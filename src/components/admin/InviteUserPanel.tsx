"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Mail, RefreshCw, UserPlus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

const INVITE_ROLES = [
  { id: "manager", name: "Manager" },
  { id: "editor", name: "Editor" },
  { id: "qc", name: "QC Specialist" },
  { id: "scheduler", name: "Scheduler" },
  { id: "videographer", name: "Videographer" },
  { id: "sales", name: "Sales" },
  { id: "sales_manager", name: "Sales Manager" },
  { id: "host", name: "Host" },
  { id: "admin", name: "Admin" },
];

const roleName = (id: string) => INVITE_ROLES.find((r) => r.id === id)?.name ?? id;

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ACCEPTED: "bg-green-100 text-green-800",
  EXPIRED: "bg-gray-100 text-gray-700",
  REVOKED: "bg-red-100 text-red-800",
};

interface Invite {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  invitedByName: string | null;
}

const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => r.json());

const fmt = (iso: string) =>
  new Date(iso + "Z").toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });

export function InviteUserPanel() {
  const { data, mutate } = useSWR<{ invites: Invite[] }>("/api/admin/users/invite", fetcher);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("editor");
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const invites = data?.invites ?? [];
  const visible = invites.filter((i) => i.status !== "ACCEPTED").slice(0, 20);

  const reset = () => {
    setEmail("");
    setName("");
    setRole("editor");
  };

  const reportResult = (json: any, okMsg: string) => {
    if (json.emailSent === false && json.inviteUrl) {
      // SMTP is down/unconfigured — hand the admin the link instead of failing silently.
      navigator.clipboard?.writeText(json.inviteUrl).catch(() => {});
      toast.warning("Email couldn't be sent. Invite link copied to your clipboard — send it manually.");
    } else {
      toast.success(okMsg);
    }
  };

  const sendInvite = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined, role }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to send invite");
        return;
      }
      reportResult(json, `Invite sent to ${email}`);
      setOpen(false);
      reset();
      mutate();
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  const resend = async (invite: Invite) => {
    setBusyId(invite.id);
    try {
      const res = await fetch(`/api/admin/users/invite/${invite.id}`, { method: "POST", credentials: "include" });
      const json = await res.json();
      if (!res.ok) toast.error(json.error || "Failed to resend");
      else reportResult(json, `Invite resent to ${invite.email}`);
      mutate();
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (invite: Invite) => {
    setBusyId(invite.id);
    try {
      const res = await fetch(`/api/admin/users/invite/${invite.id}`, { method: "DELETE", credentials: "include" });
      const json = await res.json();
      if (!res.ok) toast.error(json.error || "Failed to revoke");
      else toast.success("Invite revoked");
      mutate();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Invitations</CardTitle>
          <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Invite user
          </Button>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No open invitations. Invite someone by email and they'll get a link to register with their role pre-assigned.
            </p>
          ) : (
            <div className="divide-y">
              {visible.map((inv) => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {inv.name ? `${inv.name} · ` : ""}
                      {inv.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {roleName(inv.role)} · sent {fmt(inv.createdAt)}
                      {inv.invitedByName ? ` by ${inv.invitedByName}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_STYLE[inv.status] ?? ""}>{inv.status.toLowerCase()}</Badge>
                    {inv.status !== "REVOKED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        disabled={busyId === inv.id}
                        onClick={() => resend(inv)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Resend
                      </Button>
                    )}
                    {(inv.status === "PENDING" || inv.status === "EXPIRED") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-red-600"
                        disabled={busyId === inv.id}
                        onClick={() => revoke(inv)}
                      >
                        <X className="h-3 w-3" />
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a new user</DialogTitle>
            <DialogDescription>
              They'll get an email with a link to register. They choose their own password, and their portal is created as soon as they finish.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Full name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {INVITE_ROLES.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={sendInvite} disabled={sending || !email.includes("@")} className="gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {sending ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
