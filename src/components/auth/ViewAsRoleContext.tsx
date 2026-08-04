"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

// 🔥 Preview-only switching: lets specific people look at another role's
// dashboard UI without it being a real, backend-authorized capability.
// Kept as-is for backward compatibility — don't add new people here.
const ROLE_SWITCH_MAP: Record<string, string[]> = {
    // Specific Users - ALWAYS allowed to switch to these
    "eric@e8productions.com": ["qc", "sales", "sales_manager", "scheduler"],
    "sahilsagvekar230@gmail.com": ["qc", "sales", "sales_manager", "scheduler"],
};

const DEFAULT_ADMIN_SWITCH_ROLES = ["qc", "sales", "sales_manager", "scheduler"];

interface ViewAsRoleContextType {
    viewingAsRole: string | null;
    canSwitchRole: boolean;
    switchableRoles: string[];
    isViewingAsOther: boolean;
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

    // Check if this user can switch roles (real roles[] OR the legacy preview map OR admin default)
    const switchableRoles = React.useMemo(() => {
        const emailKey = userEmail?.toLowerCase() || "";
        const roleKey = userRole?.toLowerCase() || "";

        // 1. Real, authorized additional roles (e.g. Daena: editor + scheduler + qc)
        let permittedRoles = Array.isArray(userRoles) ? userRoles.map(r => r.toLowerCase()) : [];

        // 2. Legacy preview-only map, for accounts grandfathered in
        permittedRoles = Array.from(new Set([...permittedRoles, ...(ROLE_SWITCH_MAP[emailKey] || [])]));

        // 3. If user is an admin, they can always switch to the default preview set
        if (roleKey === "admin") {
            permittedRoles = Array.from(new Set([...permittedRoles, ...DEFAULT_ADMIN_SWITCH_ROLES]));
        }

        // Remove the user's current original role from the list if present
        return permittedRoles.filter(role => role !== roleKey);
    }, [userEmail, userRole, userRoles]);

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
            }
        }
    }, [canSwitchRole, userEmail, userRole, switchableRoles]);

    const switchToRole = (targetRole: string) => {
        if (!canSwitchRole || !userEmail) return;

        if (targetRole === userRole) {
            resetToOriginal();
            return;
        }

        if (switchableRoles.includes(targetRole)) {
            setViewingAsRole(targetRole);
            setIsViewingAsOther(true);
            localStorage.setItem(`viewingAs_${userEmail}`, targetRole);
        }
    };

    const resetToOriginal = () => {
        setViewingAsRole(userRole);
        setIsViewingAsOther(false);
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
    switchToRole: () => {},
    resetToOriginal: () => {},
};

export function useViewAsRole() {
    const context = useContext(ViewAsRoleContext);
    return context ?? nullContext;
}