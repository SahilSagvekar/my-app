'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Loader, Save, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface NavItem {
    id: string;
    label: string;
}

interface RolePermission {
    role: string;
    enabledItems: string[];
    allPossibleItems: NavItem[];
}

export function PermissionsTab() {
    const [permissions, setPermissions] = useState<RolePermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    const fetchPermissions = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/permissions');
            if (res.ok) {
                const data = await res.json();
                setPermissions(data);
            } else {
                toast.error('Failed to fetch permissions');
            }
        } catch (error) {
            console.error('Error fetching permissions:', error);
            toast.error('Error connecting to server');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPermissions();
    }, []);

    const handleToggle = (role: string, itemId: string, enabled: boolean) => {
        setPermissions(prev => prev.map(p => {
            if (p.role !== role) return p;

            const newEnabled = enabled
                ? [...p.enabledItems, itemId]
                : p.enabledItems.filter(id => id !== itemId);

            return { ...p, enabledItems: newEnabled };
        }));
    };

    const savePermissions = async (role: string) => {
        const rolePerm = permissions.find(p => p.role === role);
        if (!rolePerm) return;

        try {
            setSaving(role);
            const res = await fetch('/api/admin/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: rolePerm.role,
                    enabledItems: rolePerm.enabledItems
                })
            });

            if (res.ok) {
                toast.success(`Permissions updated for ${role}`);
            } else {
                toast.error('Failed to update permissions');
            }
        } catch (error) {
            console.error('Error saving permissions:', error);
            toast.error('Error connecting to server');
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                {/* <div>
                    <h2 className="text-2xl font-bold tracking-tight">Permissions Control</h2>
                    <p className="text-muted-foreground">
                        Manage which sidebar menu items are visible for each user role.
                    </p>
                </div> */}
                <Button variant="outline" size="sm" onClick={fetchPermissions}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {permissions.map((rolePerm) => (
                    <Card key={rolePerm.role}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="space-y-1">
                                <CardTitle className="capitalize">{rolePerm.role} UI Permissions</CardTitle>
                                <CardDescription>
                                    Enable or disable menu items
                                </CardDescription>
                            </div>
                            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="mt-4 space-y-4">
                                <div className="grid grid-cols-1 gap-4">
                                    {rolePerm.allPossibleItems.map((item) => (
                                        <div key={item.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`${rolePerm.role}-${item.id}`}
                                                checked={rolePerm.enabledItems.includes(item.id)}
                                                onCheckedChange={(checked) => handleToggle(rolePerm.role, item.id, !!checked)}
                                            />
                                            <label
                                                htmlFor={`${rolePerm.role}-${item.id}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                            >
                                                {item.label}
                                            </label>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-4 border-t">
                                    <Button
                                        onClick={() => savePermissions(rolePerm.role)}
                                        disabled={saving === rolePerm.role}
                                        className="w-full"
                                    >
                                        {saving === rolePerm.role ? (
                                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Save className="mr-2 h-4 w-4" />
                                        )}
                                        Save {rolePerm.role} Permissions
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
