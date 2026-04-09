"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

// 🔥 Define which roles/emails have the ability to switch views
// This allows developers or admins to preview the portal as other roles
const ROLE_SWITCH_MAP: Record<string, string[]> = {
    // Specific Users - ALWAYS allowed to switch to these
    "eric@e8productions.com": ["qc", "sales", "scheduler"],
    "sahilsagvekar230@gmail.com": ["qc", "sales", "scheduler"],
};

const DEFAULT_ADMIN_SWITCH_ROLES = ["qc", "sales", "scheduler"];

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
}

function safeLocalStorageGet(key: string): string | null {
    if (typeof window === "undefined") return null;

    try {
        return window.localStorage.getItem(key);
    } catch (error) {
        console.warn("⚠️ Unable to read localStorage in ViewAsRoleProvider:", error);
        return null;
    }
}

function safeLocalStorageSet(key: string, value: string) {
    if (typeof window === "undefined") return;

    try {
        window.localStorage.setItem(key, value);
    } catch (error) {
        console.warn("⚠️ Unable to write localStorage in ViewAsRoleProvider:", error);
    }
}

function safeLocalStorageRemove(key: string) {
    if (typeof window === "undefined") return;

    try {
        window.localStorage.removeItem(key);
    } catch (error) {
        console.warn("⚠️ Unable to clear localStorage in ViewAsRoleProvider:", error);
    }
}

export function ViewAsRoleProvider({ children, userEmail, userRole }: ViewAsRoleProviderProps) {
    const [viewingAsRole, setViewingAsRole] = useState<string | null>(userRole);
    const [isViewingAsOther, setIsViewingAsOther] = useState(false);

    // Check if this user can switch roles (strictly check email OR if they are an admin)
    const switchableRoles = React.useMemo(() => {
        const emailKey = userEmail?.toLowerCase() || "";
        const roleKey = userRole?.toLowerCase() || "";

        // 1. Check if email matches specific high-privilege list
        let permittedRoles = ROLE_SWITCH_MAP[emailKey] || [];

        // 2. If user is an admin, they can always switch to the default set
        if (roleKey === "admin") {
            permittedRoles = Array.from(new Set([...permittedRoles, ...DEFAULT_ADMIN_SWITCH_ROLES]));
        }

        // Remove the user's current original role from the list if present
        return permittedRoles.filter(role => role !== roleKey);
    }, [userEmail, userRole]);

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
            const saved = safeLocalStorageGet(`viewingAs_${userEmail}`);
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
            safeLocalStorageSet(`viewingAs_${userEmail}`, targetRole);
        }
    };

    const resetToOriginal = () => {
        setViewingAsRole(userRole);
        setIsViewingAsOther(false);
        if (userEmail) {
            safeLocalStorageRemove(`viewingAs_${userEmail}`);
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

export function useViewAsRole() {
    const context = useContext(ViewAsRoleContext);
    if (!context) {
        throw new Error("useViewAsRole must be used within a ViewAsRoleProvider");
    }
    return context;
}
