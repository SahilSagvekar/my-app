"use client";

import { useEffect, useState } from "react";
import YouTubeStudio from "./YouTubeStudio";
import AdminYouTubeAnalytics from "./AdminYouTubeAnalytics";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../ui/button";
import { ChevronLeft } from "lucide-react";

export function YouTubeAnalyticsWrapper() {
    const { user } = useAuth();
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [clientId, setClientId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchClientId() {
            if (!user) return;

            // If user object already has linkedClientId, use it
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
                    // Admin/Manager - don't set error, they'll see the admin view
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

    if (loading) return <div className="p-8 text-center text-muted-foreground italic flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        Loading Analytics...
    </div>;

    // If it's a client and there's an error (no linked account)
    if (error && user?.role === 'client') return <div className="p-8 text-center">
        <div className="text-destructive font-medium mb-2">Notice</div>
        <div className="text-muted-foreground">{error}</div>
    </div>;

    // Admin/Manager View
    if (user?.role === 'admin' || user?.role === 'manager') {
        // If a specific client is selected, show their studio
        if (selectedClientId) {
            return (
                <div className="relative">
                    <div className="absolute top-8 left-8 z-10">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedClientId(null)}
                            className="bg-background/80 backdrop-blur-sm"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Back to Overview
                        </Button>
                    </div>
                    <YouTubeStudio clientId={selectedClientId} />
                </div>
            );
        }

        // Otherwise show the admin overview
        return <AdminYouTubeAnalytics onSelectClient={(id) => setSelectedClientId(id)} />;
    }

    // Standard Client View
    if (!clientId) return <div className="p-8 text-center text-muted-foreground">No client account linked to this profile.</div>;

    return <YouTubeStudio clientId={clientId} />;
}
