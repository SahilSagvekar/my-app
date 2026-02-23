'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import {
    Loader2,
    Plus,
    Trash2,
    UserCheck,
    ChevronDown,
    ChevronUp,
    RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface PermittedClient {
    id: string;
    clientId: string;
}

interface EditorWithPerms {
    id: number;
    name: string | null;
    email: string;
    image: string | null;
    editorClientPermissions: PermittedClient[];
}

interface ClientOption {
    id: string;
    name: string;
    companyName: string | null;
}

export function EditorTaskPermissionsPanel() {
    const [editors, setEditors] = useState<EditorWithPerms[]>([]);
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedEditor, setExpandedEditor] = useState<number | null>(null);
    const [addingFor, setAddingFor] = useState<number | null>(null);
    const [selectedClient, setSelectedClient] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/editor-client-permissions');
            if (!res.ok) throw new Error('Failed to load');
            const data = await res.json();
            setEditors(data.editors || []);
            setClients(data.clients || []);
        } catch {
            toast.error('Failed to load editor permissions');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const grantPermission = async (editorId: number) => {
        const clientId = selectedClient[editorId];
        if (!clientId) {
            toast.error('Select a client first');
            return;
        }

        setSaving(`grant-${editorId}-${clientId}`);
        try {
            const res = await fetch('/api/admin/editor-client-permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ editorId, clientId }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            toast.success('Permission granted');
            setSelectedClient(prev => ({ ...prev, [editorId]: '' }));
            await fetchData();
        } catch (err: any) {
            toast.error(err.message || 'Failed to grant permission');
        } finally {
            setSaving(null);
        }
    };

    const revokePermission = async (editorId: number, clientId: string) => {
        setSaving(`revoke-${editorId}-${clientId}`);
        try {
            const res = await fetch('/api/admin/editor-client-permissions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ editorId, clientId }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            toast.success('Permission revoked');
            await fetchData();
        } catch (err: any) {
            toast.error(err.message || 'Failed to revoke permission');
        } finally {
            setSaving(null);
        }
    };

    const getClientName = (clientId: string) => {
        const c = clients.find(c => c.id === clientId);
        return c ? (c.companyName || c.name) : clientId;
    };

    const getAvailableClients = (editor: EditorWithPerms) => {
        const grantedIds = new Set(editor.editorClientPermissions.map(p => p.clientId));
        return clients.filter(c => !grantedIds.has(c.id));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-primary" />
                        Editor Task Creation Permissions
                    </CardTitle>
                    <CardDescription>
                        Control which editors can create one-off tasks — and for which clients.
                        Editors will only see clients they have been granted access to.
                    </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} className="shrink-0">
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Refresh
                </Button>
            </CardHeader>

            <CardContent>
                {editors.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No editors found in the system.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {editors.map(editor => {
                            const isExpanded = expandedEditor === editor.id;
                            const permCount = editor.editorClientPermissions.length;
                            const availableClients = getAvailableClients(editor);

                            return (
                                <div
                                    key={editor.id}
                                    className="border rounded-lg overflow-hidden transition-all"
                                >
                                    {/* Editor row header */}
                                    <button
                                        className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left"
                                        onClick={() => setExpandedEditor(isExpanded ? null : editor.id)}
                                        id={`editor-perm-${editor.id}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={editor.image || ''} />
                                                <AvatarFallback className="text-xs">
                                                    {editor.name?.charAt(0) ?? editor.email.charAt(0)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="text-left">
                                                <p className="font-medium text-sm">
                                                    {editor.name || editor.email}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {editor.email}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {permCount > 0 ? (
                                                <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                                                    {permCount} client{permCount !== 1 ? 's' : ''}
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-xs">
                                                    No access
                                                </Badge>
                                            )}
                                            {isExpanded ? (
                                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </div>
                                    </button>

                                    {/* Expanded panel */}
                                    {isExpanded && (
                                        <div className="border-t bg-muted/20 p-4 space-y-4">
                                            {/* Existing permissions */}
                                            {editor.editorClientPermissions.length > 0 ? (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                        Permitted Clients
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {editor.editorClientPermissions.map(perm => (
                                                            <div
                                                                key={perm.id}
                                                                className="flex items-center gap-1.5 bg-white border rounded-full pl-3 pr-1.5 py-1 text-sm shadow-sm"
                                                            >
                                                                <span className="text-xs font-medium">
                                                                    {getClientName(perm.clientId)}
                                                                </span>
                                                                <button
                                                                    onClick={() => revokePermission(editor.id, perm.clientId)}
                                                                    disabled={saving === `revoke-${editor.id}-${perm.clientId}`}
                                                                    className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-destructive hover:text-white transition-colors text-muted-foreground"
                                                                    title="Revoke access"
                                                                >
                                                                    {saving === `revoke-${editor.id}-${perm.clientId}` ? (
                                                                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                                    ) : (
                                                                        <Trash2 className="h-2.5 w-2.5" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground italic">
                                                    This editor cannot create tasks for any client yet.
                                                </p>
                                            )}

                                            {/* Grant new permission */}
                                            <div className="space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                    Grant Access to a Client
                                                </p>
                                                {availableClients.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground">
                                                        All active clients already granted.
                                                    </p>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <Select
                                                            value={selectedClient[editor.id] || ''}
                                                            onValueChange={v =>
                                                                setSelectedClient(prev => ({ ...prev, [editor.id]: v }))
                                                            }
                                                        >
                                                            <SelectTrigger
                                                                className="flex-1 max-w-xs h-8 text-xs"
                                                                id={`client-select-${editor.id}`}
                                                            >
                                                                <SelectValue placeholder="Select client…" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {availableClients.map(c => (
                                                                    <SelectItem key={c.id} value={c.id}>
                                                                        {c.companyName || c.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>

                                                        <Button
                                                            size="sm"
                                                            className="h-8 gap-1.5 text-xs"
                                                            onClick={() => grantPermission(editor.id)}
                                                            disabled={
                                                                !selectedClient[editor.id] ||
                                                                saving === `grant-${editor.id}-${selectedClient[editor.id]}`
                                                            }
                                                            id={`grant-btn-${editor.id}`}
                                                        >
                                                            {saving?.startsWith(`grant-${editor.id}`) ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <Plus className="h-3 w-3" />
                                                            )}
                                                            Grant
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
