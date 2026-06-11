"use client";

// src/components/editor/RequestRawsButton.tsx
// Dropdown + send button for editor to request raw footage.
// Each click = one Slack message to the client's channel (or e8app fallback).

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
import { FolderOpen, SendHorizonal, Loader2 } from "lucide-react";

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
  // Track send count per client so the editor can see how many requests they've sent
  const [sentCounts, setSentCounts] = useState<Record<string, number>>({});

  if (clients.length === 0) return null;

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const sentCount = selectedClientId ? (sentCounts[selectedClientId] ?? 0) : 0;

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

      // Increment local counter
      setSentCounts((prev) => ({
        ...prev,
        [selectedClientId]: (prev[selectedClientId] ?? 0) + 1,
      }));

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
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
        <FolderOpen className="h-4 w-4" />
        <span className="text-sm hidden sm:inline">Request Raws:</span>
      </div>

      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Select client" />
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
        variant="outline"
        onClick={handleRequest}
        disabled={!selectedClientId || loading}
        className="relative shrink-0"
        title={
          selectedClient
            ? `Request raws for ${selectedClient.name}`
            : "Select a client"
        }
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <SendHorizonal className="h-4 w-4" />
        )}
        <span className="ml-1.5 hidden sm:inline">Send</span>
        {sentCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-semibold text-white leading-none">
            {sentCount > 9 ? "9+" : sentCount}
          </span>
        )}
      </Button>
    </div>
  );
}