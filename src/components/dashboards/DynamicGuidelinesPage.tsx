"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { CheckCircle, BookOpen, Loader2, Plus, Edit, Trash2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthContext';

interface Guideline {
    id: string;
    category: string;
    title: string;
    content: string;
    role: string | null;
    clientId: string | null;
    client?: {
        name: string;
        companyName: string;
    };
}

interface DynamicGuidelinesPageProps {
    role: "qc" | "editor";
    title: string;
    description: string;
}

const CATEGORIES = [
    "General E8 Rules",
    "Specific E8 Client Rules",
];

export function DynamicGuidelinesPage({ role, title, description }: DynamicGuidelinesPageProps) {
    const { user } = useAuth();
    const [guidelines, setGuidelines] = useState<Guideline[]>([]);
    const [loading, setLoading] = useState(true);
    const [clients, setClients] = useState<any[]>([]);

    // Edit/Add dialog state
    const [showDialog, setShowDialog] = useState(false);
    const [editingGuideline, setEditingGuideline] = useState<Guideline | null>(null);
    const [formData, setFormData] = useState({
        title: "",
        content: "",
        category: CATEGORIES[0],
        role: role,
        clientId: "all",
    });

    const userRole = user?.role?.toLowerCase() || "";
    const canEdit = userRole === "admin" || userRole === "qc" || userRole === "manager";

    useEffect(() => {
        fetchGuidelines();
        if (canEdit) {
            fetchClients();
        }
    }, [role, canEdit]);

    async function fetchGuidelines() {
        try {
            setLoading(true);
            const res = await fetch(`/api/guidelines?role=${role}`);
            const data = await res.json();
            if (data.ok) {
                setGuidelines(data.guidelines);
            }
        } catch (error) {
            console.error("Failed to fetch guidelines", error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchClients() {
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
                setShowDialog(false);
                setEditingGuideline(null);
                resetForm();
                fetchGuidelines();
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
                toast.success("Guideline deleted");
                fetchGuidelines();
            } else {
                toast.error(data.message || "Failed to delete");
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
            role: guideline.role || role,
            clientId: guideline.clientId || "all",
        });
        setShowDialog(true);
    };

    const openAddDialog = () => {
        setEditingGuideline(null);
        resetForm();
        setShowDialog(true);
    };

    const resetForm = () => {
        setFormData({
            title: "",
            content: "",
            category: CATEGORIES[0],
            role: role,
            clientId: "all",
        });
    };

    // Group by category
    const categories = Array.from(new Set(guidelines.map(g => g.category)));

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{title}</h1>
                    <p className="text-muted-foreground mt-2">
                        {description}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {canEdit && (
                        <Button onClick={openAddDialog} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add Guideline
                        </Button>
                    )}
                    <BookOpen className="h-10 w-10 text-primary opacity-20" />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                    <p>Loading guidelines...</p>
                </div>
            ) : guidelines.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                    {categories.map((category) => (
                        <Card key={category}>
                            <CardHeader className="border-b bg-muted/30">
                                <CardTitle className="text-xl">{category}</CardTitle>
                                <CardDescription>
                                    Standards and rules categorized under {category}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-8">
                                {guidelines
                                    .filter(g => g.category === category)
                                    .map((g, idx, arr) => (
                                        <div key={g.id} className="space-y-4">
                                            <div className="flex items-start gap-4">
                                                <div className="p-2 bg-primary/10 rounded-lg mt-1">
                                                    <CheckCircle className="h-5 w-5 text-primary" />
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-lg">{g.title}</h3>
                                                        {g.clientId && (
                                                            <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">
                                                                {g.client?.companyName || g.client?.name}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                                        {g.content}
                                                    </div>
                                                </div>
                                                {canEdit && (
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => openEditDialog(g)}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-500 hover:text-red-600"
                                                            onClick={() => handleDelete(g.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                            {idx < arr.length - 1 && <Separator className="ml-14" />}
                                        </div>
                                    ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="border-dashed border-2 py-20">
                    <CardContent className="flex flex-col items-center justify-center text-center">
                        <BookOpen className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                        <h3 className="text-lg font-medium">No guidelines found</h3>
                        <p className="text-muted-foreground max-w-sm mt-1">
                            There are currently no specific guidelines assigned to the {role === 'qc' ? 'QC' : 'Editor'} role.
                        </p>
                        {canEdit && (
                            <Button onClick={openAddDialog} className="gap-2 mt-4">
                                <Plus className="h-4 w-4" />
                                Add First Guideline
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Add/Edit Dialog */}
            {canEdit && (
                <Dialog open={showDialog} onOpenChange={(open) => {
                    setShowDialog(open);
                    if (!open) {
                        setEditingGuideline(null);
                        resetForm();
                    }
                }}>
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
                            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
                            <Button onClick={handleCreateOrUpdate}>
                                {editingGuideline ? "Update Guideline" : "Save Guideline"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
