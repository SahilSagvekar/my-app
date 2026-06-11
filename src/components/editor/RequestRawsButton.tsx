"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderOpen, Send, Loader2, Check } from "lucide-react";

interface Client {
  id: string;
  name: string;
}

interface RequestRawsButtonProps {
  clients: Client[];
}

export function RequestRawsButton({ clients }: RequestRawsButtonProps) {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [sentCounts, setSentCounts] = useState<Record<string, number>>({});

  if (clients.length === 0) return null;

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const sentCount = selectedClientId ? (sentCounts[selectedClientId] ?? 0) : 0;

  async function handleRequest() {
    if (!selectedClientId) return;

    setLoading(true);
    try {
      const res = await fetch("/api/editor/request-raws", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clientId: selectedClientId }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to send request");
        return;
      }

      setSentCounts((prev) => ({
        ...prev,
        [selectedClientId]: (prev[selectedClientId] ?? 0) + 1,
      }));

      setJustSent(true);
      setTimeout(() => setJustSent(false), 2000);

      const destination = data.sentToClientChannel
        ? `${data.clientName} Slack channel`
        : "E8 app channel";
      toast.success(`Raw footage request sent to ${destination}`);
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 w-full max-w-xs">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <FolderOpen className="h-3.5 w-3.5" />
        Request raw footage
      </div>

      {/* Client select */}
      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a client..." />
        </SelectTrigger>
        <SelectContent>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Send button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={handleRequest}
        disabled={!selectedClientId || loading || justSent}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : justSent ? (
          <Check className="h-4 w-4 mr-2 text-green-600" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        {justSent ? "Sent!" : "Send request"}
      </Button>

      {/* Sent counter — only shows after at least one send */}
      {sentCount > 0 && selectedClient && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-medium">
            {sentCount > 9 ? "9+" : sentCount}
          </span>
          request{sentCount > 1 ? "s" : ""} sent for {selectedClient.name}
        </div>
      )}
    </div>
  );
}