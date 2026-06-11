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
import { Send, Loader2 } from "lucide-react";

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

  if (clients.length === 0) return null;

  async function handleRequest() {
    if (!selectedClientId) {
      toast.error("Select a client first");
      return;
    }
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
      setJustSent(true);
      setTimeout(() => setJustSent(false), 2500);
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
    <>
      {/* Vertical divider to visually separate from Create Task */}
      <div className="h-6 w-px bg-border shrink-0" />

      <span className="text-sm text-muted-foreground shrink-0 hidden sm:inline">
        Request raws:
      </span>

      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Client" />
        </SelectTrigger>
        <SelectContent>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        variant={justSent ? "default" : "outline"}
        onClick={handleRequest}
        disabled={!selectedClientId || loading}
        className="h-9 shrink-0"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        <span className="ml-1.5">
          {justSent ? "Sent!" : "Send"}
        </span>
      </Button>
    </>
  );
}