// src/components/meta/MetaAnalyticsWrapper.tsx
"use client";

import { useEffect, useState } from "react";
import MetaStudio from "./MetaStudio";
import AdminMetaAnalytics from "./AdminMetaAnalytics";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../ui/button";
import { ChevronLeft, Instagram } from "lucide-react";

export function MetaAnalyticsWrapper() {
    const { user } = useAuth();
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [clientId, setClientId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchClientId() {
            if (!user) return;

            // Check for cached clientId in user object (from session/context)
            if ((user as any).linkedClientId) {
                setClientId((user as any).linkedClientId);
                setLoading(false);
                return;
            }

            try {
                const res = await fetch("/api/auth/me");
                const data = await res.json();

                if (data.user?.linkedClientId) {
                    setClientId(data.user.linkedClientId);
                } else if (user.role === 'client') {
                    setError("No client account linked to your profile. Please contact support.");
                } else {
                    // Admin/Manager - no specific clientId by default, they see the overview first
                    setClientId(null);
                }
            } catch (err) {
                setError("Failed to load client information");
            } finally {
                setLoading(false);
            }
        }

        fetchClientId();
    }, [user]);

    if (loading) return (
        <div className="p-12 flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-pink-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-pink-600 border-t-transparent rounded-full animate-spin"></div>
                <Instagram className="absolute inset-0 m-auto w-6 h-6 text-pink-600" />
            </div>
            <p className="text-muted-foreground animate-pulse font-medium">Loading Instagram Insights...</p>
        </div>
    );

    // If it's a client and there's an error (no linked account)
    if (error && user?.role === 'client') return (
        <div className="p-8 max-w-md mx-auto text-center border rounded-xl bg-muted/20">
            <div className="text-destructive font-bold text-lg mb-2">Attention Required</div>
            <div className="text-muted-foreground">{error}</div>
        </div>
    );

    // Admin/Manager View
    if (user?.role === 'admin' || user?.role === 'manager') {
        // If a specific client is selected, show their studio
        if (selectedClientId) {
            return (
                <div className="relative">
                    <div className="mb-6">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedClientId(null)}
                            className="hover:text-pink-600 hover:border-pink-200 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Back to Master Overview
                        </Button>
                    </div>
                    <MetaStudio clientId={selectedClientId} />
                </div>
            );
        }

        // Otherwise show the admin overview
        return <AdminMetaAnalytics onSelectClient={(id) => setSelectedClientId(id)} />;
    }

    // Standard Client View
    if (!clientId) return (
        <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-2xl">
            <Instagram className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No client account linked to this profile.</p>
        </div>
    );

    return <MetaStudio clientId={clientId} />;
}
