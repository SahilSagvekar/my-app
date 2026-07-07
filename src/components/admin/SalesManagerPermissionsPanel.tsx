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

interface PermittedRep {
    id: string;
    salesRepId: number;
}

interface ManagerWithPerms {
    id: number;
    name: string | null;
    email: string;
    image: string | null;
    salesManagerPermissions: PermittedRep[];
}

interface RepOption {
    id: number;
    name: string | null;
    email: string;
}

export function SalesManagerPermissionsPanel() {
    const [managers, setManagers] = useState<ManagerWithPerms[]>([]);
    const [salesReps, setSalesReps] = useState<RepOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedManager, setExpandedManager] = useState<number | null>(null);
    const [selectedRep, setSelectedRep] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/sales-manager-permissions');
            if (!res.ok) throw new Error('Failed to load');
            const data = await res.json();
            setManagers(data.managers || []);
            setSalesReps(data.salesReps || []);
        } catch {
            toast.error('Failed to load sales manager permissions');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const grantPermission = async (managerId: number) => {
        const salesRepId = selectedRep[managerId];
        if (!salesRepId) {
            toast.error('Select a sales rep first');
            return;
        }

        setSaving(`grant-${managerId}-${salesRepId}`);
        try {
            const res = await fetch('/api/admin/sales-manager-permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ managerId, salesRepId: Number(salesRepId) }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            toast.success('Permission granted');
            setSelectedRep(prev => ({ ...prev, [managerId]: '' }));
            await fetchData();
        } catch (err: any) {
            toast.error(err.message || 'Failed to grant permission');
        } finally {
            setSaving(null);
        }
    };

    const revokePermission = async (managerId: number, salesRepId: number) => {
        setSaving(`revoke-${managerId}-${salesRepId}`);
        try {
            const res = await fetch('/api/admin/sales-manager-permissions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ managerId, salesRepId }),
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

    const getRepName = (salesRepId: number) => {
        const r = salesReps.find(r => r.id === salesRepId);
        return r ? (r.name || r.email) : String(salesRepId);
    };

    const getAvailableReps = (manager: ManagerWithPerms) => {
        const grantedIds = new Set(manager.salesManagerPermissions.map(p => p.salesRepId));
        return salesReps.filter(r => !grantedIds.has(r.id));
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
                        Sales Manager Permissions
                    </CardTitle>
                    <CardDescription>
                        Control which sales reps each sales manager can see. Managers will only see
                        leads, assignments, and commissions for reps they have been granted access to.
                    </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} className="shrink-0">
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Refresh
                </Button>
            </CardHeader>

            <CardContent>
                {managers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No sales managers found in the system.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {managers.map(manager => {
                            const isExpanded = expandedManager === manager.id;
                            const permCount = manager.salesManagerPermissions.length;
                            const availableReps = getAvailableReps(manager);

                            return (
                                <div
                                    key={manager.id}
                                    className="border rounded-lg overflow-hidden transition-all"
                                >
                                    {/* Manager row header */}
                                    <button
                                        className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left"
                                        onClick={() => setExpandedManager(isExpanded ? null : manager.id)}
                                        id={`sales-manager-perm-${manager.id}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={manager.image || ''} />
                                                <AvatarFallback className="text-xs">
                                                    {manager.name?.charAt(0) ?? manager.email.charAt(0)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="text-left">
                                                <p className="font-medium text-sm">
                                                    {manager.name || manager.email}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {manager.email}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {permCount > 0 ? (
                                                <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                                                    {permCount} rep{permCount !== 1 ? 's' : ''}
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
                                            {manager.salesManagerPermissions.length > 0 ? (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                        Permitted Sales Reps
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {manager.salesManagerPermissions.map(perm => (
                                                            <div
                                                                key={perm.id}
                                                                className="flex items-center gap-1.5 bg-white border rounded-full pl-3 pr-1.5 py-1 text-sm shadow-sm"
                                                            >
                                                                <span className="text-xs font-medium">
                                                                    {getRepName(perm.salesRepId)}
                                                                </span>
                                                                <button
                                                                    onClick={() => revokePermission(manager.id, perm.salesRepId)}
                                                                    disabled={saving === `revoke-${manager.id}-${perm.salesRepId}`}
                                                                    className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-destructive hover:text-white transition-colors text-muted-foreground"
                                                                    title="Revoke access"
                                                                >
                                                                    {saving === `revoke-${manager.id}-${perm.salesRepId}` ? (
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
                                                    This manager cannot see any sales rep&apos;s data yet.
                                                </p>
                                            )}

                                            {/* Grant new permission */}
                                            <div className="space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                    Grant Access to a Sales Rep
                                                </p>
                                                {availableReps.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground">
                                                        All sales reps already granted.
                                                    </p>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <Select
                                                            value={selectedRep[manager.id] || ''}
                                                            onValueChange={v =>
                                                                setSelectedRep(prev => ({ ...prev, [manager.id]: v }))
                                                            }
                                                        >
                                                            <SelectTrigger
                                                                className="flex-1 max-w-xs h-8 text-xs"
                                                                id={`rep-select-${manager.id}`}
                                                            >
                                                                <SelectValue placeholder="Select sales rep…" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {availableReps.map(r => (
                                                                    <SelectItem key={r.id} value={String(r.id)}>
                                                                        {r.name || r.email}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>

                                                        <Button
                                                            size="sm"
                                                            className="h-8 gap-1.5 text-xs"
                                                            onClick={() => grantPermission(manager.id)}
                                                            disabled={
                                                                !selectedRep[manager.id] ||
                                                                saving === `grant-${manager.id}-${selectedRep[manager.id]}`
                                                            }
                                                            id={`grant-btn-${manager.id}`}
                                                        >
                                                            {saving?.startsWith(`grant-${manager.id}`) ? (
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
