'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Link2, Unlink, RefreshCw, Building2 } from 'lucide-react';

interface QBStatus {
    connected: boolean;
    companyName: string | null;
    connectedAt: string | null;
}

export function QuickBooksSettings() {
    const [status, setStatus] = useState<QBStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [disconnecting, setDisconnecting] = useState(false);

    useEffect(() => {
        fetchStatus();
    }, []);

    async function fetchStatus() {
        try {
            setLoading(true);
            const res = await fetch('/api/quickbooks/status');
            const data = await res.json();
            setStatus(data);
        } catch (err) {
            console.error('Failed to fetch QB status:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleDisconnect() {
        if (!confirm('Are you sure you want to disconnect QuickBooks? You will need to reconnect to send invoices.')) return;

        setDisconnecting(true);
        try {
            await fetch('/api/quickbooks/disconnect', { method: 'POST' });
            await fetchStatus();
        } catch (err) {
            console.error('Failed to disconnect:', err);
        } finally {
            setDisconnecting(false);
        }
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6 flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5" />
                    QuickBooks Integration
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${status?.connected ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <div>
                            <p className="font-medium text-sm">
                                {status?.connected ? 'Connected' : 'Not Connected'}
                            </p>
                            {status?.connected && status.companyName && (
                                <p className="text-xs text-muted-foreground">{status.companyName}</p>
                            )}
                            {status?.connected && status.connectedAt && (
                                <p className="text-xs text-muted-foreground">
                                    Since {new Date(status.connectedAt).toLocaleDateString()}
                                </p>
                            )}
                        </div>
                    </div>

                    <Badge variant={status?.connected ? 'default' : 'secondary'}>
                        {status?.connected ? 'Active' : 'Inactive'}
                    </Badge>
                </div>

                <div className="flex gap-2">
                    {status?.connected ? (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDisconnect}
                            disabled={disconnecting}
                        >
                            <Unlink className="h-4 w-4 mr-2" />
                            {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            onClick={() => window.location.href = '/api/quickbooks/connect'}
                        >
                            <Link2 className="h-4 w-4 mr-2" />
                            Connect to QuickBooks
                        </Button>
                    )}
                </div>

                {!status?.connected && (
                    <p className="text-xs text-muted-foreground">
                        Connect your QuickBooks Online account to create and send invoices directly from the app.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
