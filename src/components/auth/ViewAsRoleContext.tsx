"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

// 🔥 ONLY admin can switch to view QC dashboard
// (QC cannot switch to admin because APIs would reject the requests)
const SWITCHABLE_EMAILS = [
    "eric@e8productions.com", // Admin can switch to QC
];

// Map email to their "other" role
const ROLE_SWITCH_MAP: Record<string, string> = {
    "eric@e8productions.com": "qc",      // Admin can switch to QC
};

interface ViewAsRoleContextType {
    viewingAsRole: string | null;
    canSwitchRole: boolean;
    targetSwitchRole: string | null;
    isViewingAsOther: boolean;
    toggleRole: () => void;
    resetToOriginal: () => void;
}

const ViewAsRoleContext = createContext<ViewAsRoleContextType | undefined>(undefined);

interface ViewAsRoleProviderProps {
    children: React.ReactNode;
    userEmail: string | null | undefined;
    userRole: string | null;
}

export function ViewAsRoleProvider({ children, userEmail, userRole }: ViewAsRoleProviderProps) {
    const [viewingAsRole, setViewingAsRole] = useState<string | null>(userRole);
    const [isViewingAsOther, setIsViewingAsOther] = useState(false);

    // Check if this user can switch roles
    const canSwitchRole = userEmail ? SWITCHABLE_EMAILS.includes(userEmail.toLowerCase()) : false;

    // What role would they switch to?
    const targetSwitchRole = userEmail ? ROLE_SWITCH_MAP[userEmail.toLowerCase()] || null : null;

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
            if (saved && saved !== userRole) {
                setViewingAsRole(saved);
                setIsViewingAsOther(true);
            }
        }
    }, [canSwitchRole, userEmail, userRole]);

    const toggleRole = () => {
        if (!canSwitchRole || !targetSwitchRole || !userEmail) return;

        if (isViewingAsOther) {
            // Switch back to original role
            setViewingAsRole(userRole);
            setIsViewingAsOther(false);
            localStorage.removeItem(`viewingAs_${userEmail}`);
        } else {
            // Switch to other role
            setViewingAsRole(targetSwitchRole);
            setIsViewingAsOther(true);
            localStorage.setItem(`viewingAs_${userEmail}`, targetSwitchRole);
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
                targetSwitchRole,
                isViewingAsOther,
                toggleRole,
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
