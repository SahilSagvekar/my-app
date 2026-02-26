"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

// 🔥 ONLY admin can switch to view QC dashboard
// (QC cannot switch to admin because APIs would reject the requests)
const SWITCHABLE_EMAILS = [
    "eric@e8productions.com", // Admin can switch to QC
];

// Map email to their "other" roles
const ROLE_SWITCH_MAP: Record<string, string[]> = {
    "eric@e8productions.com": ["qc", "sales"],      // Admin can switch to QC or Sales
};

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

export function ViewAsRoleProvider({ children, userEmail, userRole }: ViewAsRoleProviderProps) {
    const [viewingAsRole, setViewingAsRole] = useState<string | null>(userRole);
    const [isViewingAsOther, setIsViewingAsOther] = useState(false);

    // Check if this user can switch roles
    const switchableRoles = userEmail ? ROLE_SWITCH_MAP[userEmail.toLowerCase()] || [] : [];
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

export function useViewAsRole() {
    const context = useContext(ViewAsRoleContext);
    if (!context) {
        throw new Error("useViewAsRole must be used within a ViewAsRoleProvider");
    }
    return context;
}
