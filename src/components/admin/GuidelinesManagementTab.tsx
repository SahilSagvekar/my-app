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
                setShowAddDialog(false);
                setEditingGuideline(null);
                setFormData({
                    title: "",
                    content: "",
                    category: CATEGORIES[0],
                    role: "all",
                    clientId: "all",
                });
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
                            <DialogContent className="sm:max-w-[600px]">
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
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="All Roles" />
                            </SelectTrigger>
                            <SelectContent>
                                {ROLES.map(role => (
                                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={clientFilter} onValueChange={setClientFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="All Clients" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Clients</SelectItem>
                                {clients.map(client => (
                                    <SelectItem key={client.id} value={client.id}>{client.companyName || client.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                                                            {g.role === 'qc' ? 'QC' : 'Editor'}
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
