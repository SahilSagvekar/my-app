"use client";

// components/admin/PortfolioJourneyManager.tsx
// Admin CRUD for the public /portfolio "Before & After" tab
// (src/components/landing/BeforeAfterJourney.tsx) — replaces what used to be
// a hardcoded client list + picsum.photos placeholder images.

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import {
    Plus,
    Trash2,
    Loader2,
    ArrowUp,
    ArrowDown,
    ChevronDown,
    ChevronRight,
    Image as ImageIcon,
    Upload,
} from "lucide-react";
import { toast } from "sonner";

interface JourneyStep {
    id: string;
    imageUrl: string;
    caption: string;
    order: number;
}

interface JourneyClient {
    id: string;
    label: string;
    sublabel: string | null;
    iconKey: string | null;
    order: number;
    isActive: boolean;
    steps: JourneyStep[];
}

const ICON_OPTIONS = [
    { value: "none", label: "None" },
    { value: "youtube", label: "YouTube" },
    { value: "facebook", label: "Facebook" },
    { value: "instagram", label: "Instagram" },
    { value: "tiktok", label: "TikTok" },
    { value: "twitter", label: "X / Twitter" },
];

export default function PortfolioJourneyManager() {
    const [clients, setClients] = useState<JourneyClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const [newLabel, setNewLabel] = useState("");
    const [newSublabel, setNewSublabel] = useState("");
    const [newIcon, setNewIcon] = useState("none");
    const [creating, setCreating] = useState(false);

    const [newCaption, setNewCaption] = useState<Record<string, string>>({});
    const [uploadingFor, setUploadingFor] = useState<string | null>(null);

    const fetchClients = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/portfolio/journey-clients?all=true");
            const data = await res.json();
            setClients(data.clients || []);
        } catch {
            toast.error("Failed to load journey clients");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    async function handleCreateClient() {
        if (!newLabel.trim()) return;
        setCreating(true);
        try {
            const res = await fetch("/api/portfolio/journey-clients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    label: newLabel.trim(),
                    sublabel: newSublabel.trim() || null,
                    iconKey: newIcon === "none" ? null : newIcon,
                    order: clients.length,
                }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.message);
            setClients((prev) => [...prev, data.client]);
            setNewLabel("");
            setNewSublabel("");
            setNewIcon("none");
            toast.success("Client added");
        } catch (err: any) {
            toast.error(err.message || "Failed to add client");
        } finally {
            setCreating(false);
        }
    }

    async function handleToggleActive(client: JourneyClient) {
        try {
            const res = await fetch(`/api/portfolio/journey-clients/${client.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !client.isActive }),
            });
            if (!res.ok) throw new Error();
            setClients((prev) =>
                prev.map((c) => (c.id === client.id ? { ...c, isActive: !c.isActive } : c))
            );
        } catch {
            toast.error("Failed to toggle visibility");
        }
    }

    async function handleDeleteClient(client: JourneyClient) {
        if (!confirm(`Delete "${client.label}" and all its images? This can't be undone.`)) return;
        try {
            const res = await fetch(`/api/portfolio/journey-clients/${client.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            setClients((prev) => prev.filter((c) => c.id !== client.id));
            toast.success("Client deleted");
        } catch {
            toast.error("Failed to delete client");
        }
    }

    async function handleReorderClient(client: JourneyClient, direction: "up" | "down") {
        const sorted = [...clients].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex((c) => c.id === client.id);
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;
        const swap = sorted[swapIdx];
        try {
            await Promise.all([
                fetch(`/api/portfolio/journey-clients/${client.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ order: swap.order }),
                }),
                fetch(`/api/portfolio/journey-clients/${swap.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ order: client.order }),
                }),
            ]);
            fetchClients();
        } catch {
            toast.error("Failed to reorder");
        }
    }

    async function handleUploadStep(client: JourneyClient, file: File) {
        const caption = (newCaption[client.id] || "").trim();
        if (!caption) {
            toast.error("Add a caption before uploading an image");
            return;
        }
        setUploadingFor(client.id);
        const toastId = toast.loading("Uploading image...");
        try {
            const formDataPayload = new FormData();
            formDataPayload.append("file", file);
            const uploadRes = await fetch("/api/portfolio/upload", {
                method: "POST",
                body: formDataPayload,
            });
            const uploadData = await uploadRes.json();
            if (!uploadData.ok) throw new Error(uploadData.message || "Upload failed");

            const stepRes = await fetch(`/api/portfolio/journey-clients/${client.id}/steps`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageUrl: uploadData.url,
                    caption,
                    order: client.steps.length,
                }),
            });
            const stepData = await stepRes.json();
            if (!stepData.ok) throw new Error(stepData.message);

            setClients((prev) =>
                prev.map((c) =>
                    c.id === client.id ? { ...c, steps: [...c.steps, stepData.step] } : c
                )
            );
            setNewCaption((prev) => ({ ...prev, [client.id]: "" }));
            toast.success("Step added", { id: toastId });
        } catch (err: any) {
            toast.error(err.message || "Failed to add step", { id: toastId });
        } finally {
            setUploadingFor(null);
        }
    }

    async function handleDeleteStep(clientId: string, step: JourneyStep) {
        if (!confirm(`Delete step "${step.caption}"?`)) return;
        try {
            const res = await fetch(`/api/portfolio/journey-steps/${step.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            setClients((prev) =>
                prev.map((c) =>
                    c.id === clientId ? { ...c, steps: c.steps.filter((s) => s.id !== step.id) } : c
                )
            );
        } catch {
            toast.error("Failed to delete step");
        }
    }

    async function handleReorderStep(clientId: string, step: JourneyStep, direction: "up" | "down") {
        const client = clients.find((c) => c.id === clientId);
        if (!client) return;
        const sorted = [...client.steps].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex((s) => s.id === step.id);
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;
        const swap = sorted[swapIdx];
        try {
            await Promise.all([
                fetch(`/api/portfolio/journey-steps/${step.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ order: swap.order }),
                }),
                fetch(`/api/portfolio/journey-steps/${swap.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ order: step.order }),
                }),
            ]);
            fetchClients();
        } catch {
            toast.error("Failed to reorder step");
        }
    }

    const sortedClients = [...clients].sort((a, b) => a.order - b.order);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Add Client</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <Label>Name</Label>
                        <Input
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            placeholder="e.g. Cole"
                            className="w-48"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Sublabel (optional)</Label>
                        <Input
                            value={newSublabel}
                            onChange={(e) => setNewSublabel(e.target.value)}
                            placeholder="e.g. YouTube"
                            className="w-48"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Platform icon</Label>
                        <Select value={newIcon} onValueChange={setNewIcon}>
                            <SelectTrigger className="w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ICON_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleCreateClient} disabled={creating || !newLabel.trim()}>
                        {creating ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                            <Plus className="h-4 w-4 mr-1" />
                        )}
                        Add
                    </Button>
                </CardContent>
            </Card>

            {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
            ) : sortedClients.length === 0 ? (
                <p className="text-sm text-muted-foreground">No clients yet — add one above.</p>
            ) : (
                <div className="space-y-3">
                    {sortedClients.map((client, idx) => {
                        const isExpanded = expandedId === client.id;
                        const sortedSteps = [...client.steps].sort((a, b) => a.order - b.order);
                        return (
                            <Card key={client.id}>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <button
                                            className="flex items-center gap-2 min-w-0 text-left"
                                            onClick={() => setExpandedId(isExpanded ? null : client.id)}
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="h-4 w-4 shrink-0" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 shrink-0" />
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {client.label}
                                                    {client.sublabel && (
                                                        <span className="text-muted-foreground"> · {client.sublabel}</span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {client.steps.length} image{client.steps.length !== 1 ? "s" : ""}
                                                </p>
                                            </div>
                                        </button>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0"
                                                disabled={idx === 0}
                                                onClick={() => handleReorderClient(client, "up")}
                                            >
                                                <ArrowUp className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0"
                                                disabled={idx === sortedClients.length - 1}
                                                onClick={() => handleReorderClient(client, "down")}
                                            >
                                                <ArrowDown className="h-3 w-3" />
                                            </Button>
                                            <Switch
                                                checked={client.isActive}
                                                onCheckedChange={() => handleToggleActive(client)}
                                            />
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                                                onClick={() => handleDeleteClient(client)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="mt-4 pl-6 space-y-3 border-t pt-4">
                                            {sortedSteps.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">
                                                    No images yet — add the first one below.
                                                </p>
                                            ) : (
                                                sortedSteps.map((step, sIdx) => (
                                                    <div
                                                        key={step.id}
                                                        className="flex items-center gap-3 p-2 border rounded-lg"
                                                    >
                                                        <img
                                                            src={step.imageUrl}
                                                            alt={step.caption}
                                                            className="w-16 h-10 object-cover rounded border shrink-0"
                                                        />
                                                        <span className="text-sm flex-1 truncate">{step.caption}</span>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 w-7 p-0"
                                                            disabled={sIdx === 0}
                                                            onClick={() => handleReorderStep(client.id, step, "up")}
                                                        >
                                                            <ArrowUp className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 w-7 p-0"
                                                            disabled={sIdx === sortedSteps.length - 1}
                                                            onClick={() => handleReorderStep(client.id, step, "down")}
                                                        >
                                                            <ArrowDown className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                                                            onClick={() => handleDeleteStep(client.id, step)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                ))
                                            )}

                                            <div className="flex items-center gap-2 pt-2">
                                                <Input
                                                    placeholder="Caption (e.g. Month 1, Today)"
                                                    value={newCaption[client.id] || ""}
                                                    onChange={(e) =>
                                                        setNewCaption((prev) => ({ ...prev, [client.id]: e.target.value }))
                                                    }
                                                    className="max-w-xs"
                                                />
                                                <input
                                                    id={`journey-step-file-${client.id}`}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleUploadStep(client, file);
                                                        e.target.value = "";
                                                    }}
                                                    disabled={uploadingFor === client.id}
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={uploadingFor === client.id}
                                                    onClick={() =>
                                                        document.getElementById(`journey-step-file-${client.id}`)?.click()
                                                    }
                                                >
                                                    {uploadingFor === client.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                                    ) : (
                                                        <Upload className="h-4 w-4 mr-1" />
                                                    )}
                                                    Upload Image
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
