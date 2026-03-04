"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

// 🔥 Define which roles/emails have the ability to switch views
// This allows developers or admins to preview the portal as other roles
const ROLE_SWITCH_MAP: Record<string, string[]> = {
    // Specific Users
    "eric@e8productions.com": ["qc", "sales"],
    
    // Role-based defaults
    "admin": ["qc", "sales"],
    "qc": ["admin", "sales"],
    "sales": ["qc", "admin"],
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

    // Check if this user can switch roles (check email first, then role)
    const switchableRoles = React.useMemo(() => {
        const emailKey = userEmail?.toLowerCase() || "";
        const roleKey = userRole?.toLowerCase() || "";
        
        const emailRoles = ROLE_SWITCH_MAP[emailKey] || [];
        const roleRoles = ROLE_SWITCH_MAP[roleKey] || [];
        
        // Merge and unique
        return Array.from(new Set([...emailRoles, ...roleRoles]));
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
