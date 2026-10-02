"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { isDevPortalEmail } from "@/lib/dev-portal-access";

// 🔥 Preview-only switching: lets specific people look at another role's
// dashboard UI without it being a real, backend-authorized capability.
// Kept as-is for backward compatibility — don't add new people here.
const ROLE_SWITCH_MAP: Record<string, string[]> = {
    // Specific Users - ALWAYS allowed to switch to these
    "eric@e8productions.com": ["qc", "sales", "sales_manager", "scheduler", "videographer", "host"],
    "sahilsagvekar230@gmail.com": ["qc", "sales", "sales_manager", "scheduler", "videographer", "host"],
};

const DEFAULT_ADMIN_SWITCH_ROLES = ["qc", "sales", "sales_manager", "scheduler", "videographer", "host"];

// 🔥 Client-portal preview: lets a specific admin account switch into ONE
// specific client's portal (not just the generic "client" role shell).
// Unlike ROLE_SWITCH_MAP above, "client" always needs a concrete target —
// there's no such thing as previewing "client" in the abstract — so this
// is a separate map from {email -> {clientId, label}} rather than another
// entry in a role-name array. The backend (/api/tasks and friends) trusts
// this only when the request ALSO supplies the matching clientId, so
// adding an entry here is the only place this needs to be granted.
const CLIENT_PREVIEW_MAP: Record<string, { clientId: string; label: string }> = {
    "eric@e8productions.com": { clientId: "cmtssco9a000001s64o80aqy8", label: "E8 Client" },
};

interface ViewAsRoleContextType {
    viewingAsRole: string | null;
    canSwitchRole: boolean;
    switchableRoles: string[];
    isViewingAsOther: boolean;
    // Set only when viewingAsRole === "client" via CLIENT_PREVIEW_MAP —
    // the specific client's ID to scope data-fetching to. null for a real
    // client user (who doesn't need an override) and for every other role.
    viewingAsClientId: string | null;
    // Display label for the above (e.g. "The Drew Meyers"), so the switch
    // role dropdown can show the actual client name instead of "Client".
    viewingAsClientLabel: string | null;
    switchToRole: (role: string) => void;
    resetToOriginal: () => void;
}

const ViewAsRoleContext = createContext<ViewAsRoleContextType | undefined>(undefined);

interface ViewAsRoleProviderProps {
    children: React.ReactNode;
    userEmail: string | null | undefined;
    userRole: string | null;
    // Real, backend-authorized roles this account can act as (e.g. an
    // editor who's also scheduler + qc). Switching into one of these is
    // a genuine capability change, not just a UI preview.
    userRoles?: string[];
}

export function ViewAsRoleProvider({ children, userEmail, userRole, userRoles }: ViewAsRoleProviderProps) {
    const [viewingAsRole, setViewingAsRole] = useState<string | null>(userRole);
    const [isViewingAsOther, setIsViewingAsOther] = useState(false);
    const [viewingAsClientId, setViewingAsClientId] = useState<string | null>(null);

    const emailKey = userEmail?.toLowerCase() || "";
    const clientPreview = CLIENT_PREVIEW_MAP[emailKey] || null;

    // Check if this user can switch roles (real roles[] OR the legacy preview map OR admin default)
    const switchableRoles = React.useMemo(() => {
        const roleKey = userRole?.toLowerCase() || "";

        // 1. Real, authorized additional roles (e.g. Daena: editor + scheduler + qc)
        let permittedRoles = Array.isArray(userRoles) ? userRoles.map(r => r.toLowerCase()) : [];

        // 2. Legacy preview-only map, for accounts grandfathered in
        permittedRoles = Array.from(new Set([...permittedRoles, ...(ROLE_SWITCH_MAP[emailKey] || [])]));

        // 3. If user is an admin, they can always switch to the default preview set
        if (roleKey === "admin") {
            permittedRoles = Array.from(new Set([...permittedRoles, ...DEFAULT_ADMIN_SWITCH_ROLES]));
        }

        // 4. Client-portal preview — only if this email has a specific
        // client assigned above; "client" is otherwise never offered
        // generically, since there'd be no client to scope it to.
        if (clientPreview) {
            permittedRoles = Array.from(new Set([...permittedRoles, "client"]));
        }

        // 5. Dev Portal — a pseudo-role (not a DB role) offered only to the
        // emails in DEV_PORTAL_EMAILS. The API re-checks the email server-side.
        if (isDevPortalEmail(emailKey)) {
            permittedRoles = Array.from(new Set([...permittedRoles, "dev"]));
        }

        // Remove the user's current original role from the list if present
        return permittedRoles.filter(role => role !== roleKey);
    }, [emailKey, userRole, userRoles, clientPreview]);

    const canSwitchRole = switchableRoles.length > 0;

    // Reset viewing role when actual user role changes
    useEffect(() => {
        if (!isViewingAsOther) {
            setViewingAsRole(userRole);
        }
    }, [userRole, isViewingAsOther]);

    // Load saved preference from localStorage
    useEffect(() => {
        if (canSwitchRole && userEmail) {
            const saved = localStorage.getItem(`viewingAs_${userEmail}`);
            if (saved && saved !== userRole && switchableRoles.includes(saved)) {
                setViewingAsRole(saved);
                setIsViewingAsOther(true);
                if (saved === "client" && clientPreview) {
                    setViewingAsClientId(clientPreview.clientId);
                }
            }
        }
    }, [canSwitchRole, userEmail, userRole, switchableRoles, clientPreview]);

    const switchToRole = (targetRole: string) => {
        if (!canSwitchRole || !userEmail) return;

        if (targetRole === userRole) {
            resetToOriginal();
            return;
        }

        if (switchableRoles.includes(targetRole)) {
            setViewingAsRole(targetRole);
            setIsViewingAsOther(true);
            setViewingAsClientId(targetRole === "client" && clientPreview ? clientPreview.clientId : null);
            localStorage.setItem(`viewingAs_${userEmail}`, targetRole);
        }
    };

    const resetToOriginal = () => {
        setViewingAsRole(userRole);
        setIsViewingAsOther(false);
        setViewingAsClientId(null);
        if (userEmail) {
            localStorage.removeItem(`viewingAs_${userEmail}`);
        }
    };

    return (
        <ViewAsRoleContext.Provider
            value={{
                viewingAsRole,
                canSwitchRole,
                switchableRoles,
                isViewingAsOther,
                viewingAsClientId,
                viewingAsClientLabel: viewingAsRole === "client" ? (clientPreview?.label ?? null) : null,
                switchToRole,
                resetToOriginal,
            }}
        >
            {children}
        </ViewAsRoleContext.Provider>
    );
}

const nullContext: ViewAsRoleContextType = {
    viewingAsRole: null,
    canSwitchRole: false,
    switchableRoles: [],
    isViewingAsOther: false,
    viewingAsClientId: null,
    viewingAsClientLabel: null,
    switchToRole: () => {},
    resetToOriginal: () => {},
};

export function useViewAsRole() {
    const context = useContext(ViewAsRoleContext);
    return context ?? nullContext;
}