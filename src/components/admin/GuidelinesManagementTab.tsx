"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { FilterSelect } from "../ui/filter-select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../ui/dialog";
import {
    Plus,
    Search,
    BookOpen,
    Edit,
    Trash2,
    Filter,
    CheckCircle,
    Video,
    Palette,
    FileText,
    AlertTriangle,
    Target,
    Hash,
    X,
} from "lucide-react";
import { toast } from "sonner";

interface Guideline {
    id: string;
    category: string;
    title: string;
    content: string;
    role: string | null;
    clientId: string | null;
    createdAt: string;
    client?: {
        name: string;
        companyName: string;
    };
}

const CATEGORIES = [
    "General E8 Rules",
    "Specific E8 Client Rules",
];

const ROLES = [
    { id: "all", name: "All Roles" },
    { id: "qc", name: "QC Specialist" },
    { id: "editor", name: "Editor" },
    { id: "scheduler", name: "Scheduler" },
];

export function GuidelinesManagementTab() {
    const [guidelines, setGuidelines] = useState<Guideline[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [roleFilter, setRoleFilter] = useState("all");
    const [clientFilter, setClientFilter] = useState("all");

    const [showAddDialog, setShowAddDialog] = useState(false);
    const [editingGuideline, setEditingGuideline] = useState<Guideline | null>(null);
    const [formData, setFormData] = useState({
        title: "",
        content: "",
        category: CATEGORIES[0],
        role: "all",
        clientId: "all",
    });

    // Template hashtags for the client picked in the form. They live on the
    // client record (not on the guideline), so this state is kept apart from
    // formData — which is what gets POSTed as the guideline itself — and is
    // saved through /api/clients/:id/hashtags. That list is what clients see
    // as selectable tags on their review screen.
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [savedHashtags, setSavedHashtags] = useState<string[]>([]);
    const [hashtagInput, setHashtagInput] = useState("");
    const [hashtagsStatus, setHashtagsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

    const resetHashtagState = () => {
        setHashtags([]);
        setSavedHashtags([]);
        setHashtagInput("");
        setHashtagsStatus("idle");
    };

    // Load the selected client's current hashtags whenever the dialog is open
    // on a specific client. Editing stays disabled until this succeeds, so a
    // failed load can never be followed by a save that overwrites the real
    // list with a partial one.
    useEffect(() => {
        if (!showAddDialog || formData.clientId === "all") {
            resetHashtagState();
            return;
        }

        let cancelled = false;
        setHashtagsStatus("loading");
        setHashtagInput("");
        fetch(`/api/clients/${formData.clientId}/hashtags`, { credentials: "include" })
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (cancelled) return;
                const list: string[] = Array.isArray(data.hashtags) ? data.hashtags : [];
                setHashtags(list);
                setSavedHashtags(list);
                setHashtagsStatus("ready");
            })
            .catch((error) => {
                if (cancelled) return;
                console.error("Failed to load client hashtags", error);
                setHashtags([]);
                setSavedHashtags([]);
                setHashtagsStatus("error");
            });

        return () => {
            cancelled = true;
        };
    }, [showAddDialog, formData.clientId]);

    const normalizeTag = (tag: string) => tag.trim().replace(/^#/, "").toLowerCase();

    const addHashtag = () => {
        const raw = hashtagInput.trim().replace(/^#+/, "").replace(/\s+/g, "");
        if (!raw) return;
        const tag = `#${raw}`;
        // De-dupe ignoring case and the leading "#" (older entries may have been saved without it).
        if (!hashtags.some((t) => normalizeTag(t) === normalizeTag(tag))) {
            setHashtags([...hashtags, tag]);
        }
        setHashtagInput("");
    };

    const removeHashtag = (tag: string) => {
        setHashtags(hashtags.filter((t) => t !== tag));
    };

    const hashtagsChanged =
        hashtags.length !== savedHashtags.length ||
        hashtags.some((t, i) => t !== savedHashtags[i]);

    useEffect(() => {
        loadGuidelines();
        loadClients();
    }, []);

    async function loadGuidelines() {
        try {
            setLoading(true);
            const res = await fetch("/api/guidelines");
            const data = await res.json();
            if (data.ok) {
                setGuidelines(data.guidelines);
            }
        } catch (error) {
            console.error("Failed to load guidelines", error);
            toast.error("Failed to load guidelines");
        } finally {
            setLoading(false);
        }
    }

    async function loadClients() {
        try {
            const res = await fetch("/api/clients");
            const data = await res.json();
            if (data.clients) {
                setClients(data.clients);
            }
        } catch (error) {
            console.error("Failed to load clients", error);
        }
    }

    const handleCreateOrUpdate = async () => {
        if (!formData.title || !formData.content) {
            toast.error("Title and Content are required");
            return;
        }

        try {
            const method = editingGuideline ? "PATCH" : "POST";
            const url = editingGuideline
                ? `/api/admin/guidelines/${editingGuideline.id}`
                : "/api/admin/guidelines";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await res.json();
            if (data.ok) {
                toast.success(`Guideline ${editingGuideline ? "updated" : "created"} successfully`);

                // The guideline itself is saved — now sync the client's
                // template hashtags if they were edited. Done second and
                // reported separately so a hashtag failure never looks like
                // the guideline failed to save.
                if (formData.clientId !== "all" && hashtagsStatus === "ready" && hashtagsChanged) {
                    try {
                        const tagRes = await fetch(`/api/clients/${formData.clientId}/hashtags`, {
                            method: "PUT",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ hashtags }),
                        });
                        const tagData = await tagRes.json().catch(() => ({}));
                        if (tagRes.ok) {
                            toast.success("Client hashtags updated");
                        } else {
                            toast.error(`Guideline saved, but hashtags weren't updated: ${tagData.message || tagRes.status}`);
                        }
                    } catch (tagError) {
                        console.error("Error saving client hashtags", tagError);
                        toast.error("Guideline saved, but hashtags weren't updated");
                    }
                }

                setShowAddDialog(false);
                setEditingGuideline(null);
                setFormData({
                    title: "",
                    content: "",
                    category: CATEGORIES[0],
                    role: "all",
                    clientId: "all",
                });
                resetHashtagState();
                loadGuidelines();
            } else {
                toast.error(data.message || "Something went wrong");
            }
        } catch (error) {
            console.error("Error saving guideline", error);
            toast.error("Error saving guideline");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this guideline?")) return;

        try {
            const res = await fetch(`/api/admin/guidelines/${id}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (data.ok) {
                toast.success("Guideline deleted successfully");
                loadGuidelines();
            }
        } catch (error) {
            console.error("Error deleting guideline", error);
            toast.error("Error deleting guideline");
        }
    };

    const openEditDialog = (guideline: Guideline) => {
        setEditingGuideline(guideline);
        setFormData({
            title: guideline.title,
            content: guideline.content,
            category: guideline.category,
            role: guideline.role || "all",
            clientId: guideline.clientId || "all",
        });
        setShowAddDialog(true);
    };

    const filteredGuidelines = guidelines.filter((g) => {
        const matchesSearch =
            g.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            g.content.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === "all" || g.category === categoryFilter;
        const matchesRole = roleFilter === "all" || g.role === roleFilter;
        const matchesClient = clientFilter === "all" || g.clientId === clientFilter;

        return matchesSearch && matchesCategory && matchesRole && matchesClient;
    });

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen className="h-5 w-5" />
                                Guidelines Management
                            </CardTitle>
                        </div>
                        <Dialog open={showAddDialog} onOpenChange={(open) => {
                            setShowAddDialog(open);
                            if (!open) {
                                setEditingGuideline(null);
                                setFormData({
                                    title: "",
                                    content: "",
                                    category: CATEGORIES[0],
                                    role: "all",
                                    clientId: "all",
                                });
                            }
                        }}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Guideline
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>{editingGuideline ? "Edit Guideline" : "Add New Guideline"}</DialogTitle>
                                    <DialogDescription>
                                        Create or update rules and standards for QC and Editor teams.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Category</Label>
                                            <Select
                                                value={formData.category}
                                                onValueChange={(val) => setFormData({ ...formData, category: val })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {CATEGORIES.map(cat => (
                                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Target Role</Label>
                                            <Select
                                                value={formData.role}
                                                onValueChange={(val) => setFormData({ ...formData, role: val })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ROLES.map(role => (
                                                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Client (Optional)</Label>
                                        <Select
                                            value={formData.clientId}
                                            onValueChange={(val) => setFormData({ ...formData, clientId: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select client" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Not specific to any client</SelectItem>
                                                {clients.map(client => (
                                                    <SelectItem key={client.id} value={client.id}>{client.companyName || client.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {formData.clientId !== "all" && (
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-1.5">
                                                <Hash className="h-4 w-4 text-blue-500" />
                                                Template Hashtags
                                            </Label>
                                            <p className="text-sm text-muted-foreground">
                                                Shown as selectable tags when this client reviews a video. Saved to the client&apos;s template hashtags along with this guideline.
                                            </p>
                                            {hashtagsStatus === "error" ? (
                                                <p className="text-sm text-destructive">
                                                    Couldn&apos;t load this client&apos;s hashtags, so they can&apos;t be edited right now. Re-select the client to try again.
                                                </p>
                                            ) : (
                                                <>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={hashtagInput}
                                                            onChange={(e) => setHashtagInput(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    e.preventDefault();
                                                                    addHashtag();
                                                                }
                                                            }}
                                                            placeholder={hashtagsStatus === "loading" ? "Loading hashtags..." : "e.g. contentcreation"}
                                                            disabled={hashtagsStatus !== "ready"}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={addHashtag}
                                                            disabled={hashtagsStatus !== "ready"}
                                                        >
                                                            Add
                                                        </Button>
                                                    </div>
                                                    {hashtags.length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {hashtags.map((tag) => (
                                                                <Badge
                                                                    key={tag}
                                                                    variant="secondary"
                                                                    className="gap-1.5 pr-1.5 bg-blue-50 text-blue-700 border-blue-200"
                                                                >
                                                                    {tag}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeHashtag(tag)}
                                                                        className="text-blue-400 hover:text-blue-700"
                                                                        aria-label={`Remove ${tag}`}
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </button>
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label>Title</Label>
                                        <Input
                                            placeholder="e.g. Video Quality Standards"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Content</Label>
                                        <Textarea
                                            placeholder="Enter the detailed guideline content..."
                                            rows={6}
                                            className="max-h-[300px] overflow-y-auto [field-sizing:fixed]"
                                            value={formData.content}
                                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                                    <Button onClick={handleCreateOrUpdate}>
                                        {editingGuideline ? "Update Guideline" : "Save Guideline"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-center gap-4 mb-6">
                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search guidelines..."
                                className="pl-10 bg-secondary/30 h-10 border-transparent focus-visible:ring-1 focus-visible:ring-primary/20 transition-all rounded-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <FilterSelect
                            value={categoryFilter}
                            onValueChange={setCategoryFilter}
                            placeholder="All Categories"
                            options={[
                                { value: "all", label: "All Categories" },
                                ...CATEGORIES.map(cat => ({ value: cat, label: cat })),
                            ]}
                        />

                        <FilterSelect
                            value={roleFilter}
                            onValueChange={setRoleFilter}
                            placeholder="All Roles"
                            options={ROLES.map(role => ({ value: role.id, label: role.name }))}
                        />

                        <FilterSelect
                            value={clientFilter}
                            onValueChange={setClientFilter}
                            placeholder="All Clients"
                            options={[
                                { value: "all", label: "All Clients" },
                                ...clients.map(client => ({ value: client.id, label: client.companyName || client.name })),
                            ]}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {loading ? (
                            <div className="col-span-full py-20 text-center">
                                <p className="text-muted-foreground animate-pulse">Loading guidelines...</p>
                            </div>
                        ) : filteredGuidelines.length > 0 ? (
                            filteredGuidelines.map((g) => (
                                <Card key={g.id} className="border border-muted hover:border-primary/20 transition-colors">
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold">{g.title}</h4>
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                                        {g.category}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    {g.role ? (
                                                        <Badge variant="outline" className="text-[10px] px-1 h-3.5 border-blue-200 text-blue-700 bg-blue-50/50">
                                                            {ROLES.find(r => r.id === g.role)?.name || g.role}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[10px] px-1 h-3.5 border-green-200 text-green-700 bg-green-50/50">
                                                            Everyone
                                                        </Badge>
                                                    )}
                                                    {g.clientId && (
                                                        <Badge variant="outline" className="text-[10px] px-1 h-3.5 border-orange-200 text-orange-700 bg-orange-50/50">
                                                            {g.client?.companyName || g.client?.name}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(g)}>
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => handleDelete(g.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                                            {g.content}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            <div className="col-span-full py-20 text-center border-2 border-dashed rounded-lg">
                                <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-20" />
                                <p className="text-muted-foreground">No guidelines found</p>
                                <Button variant="link" onClick={() => { setSearchTerm(""); setCategoryFilter("all"); setRoleFilter("all"); setClientFilter("all"); }}>
                                    Clear all filters
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}