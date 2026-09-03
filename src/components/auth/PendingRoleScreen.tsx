"use client";

import { useState } from "react";
import { Inter } from "next/font/google";
import { Clock, Check, RefreshCw, LogOut } from "lucide-react";
import { useAuth } from "./AuthContext";

// Design handoff calls for Inter specifically; the rest of the app uses a
// system-ui stack, so this is scoped to just this screen rather than
// changing the global font.
const inter = Inter({ subsets: ["latin"], weight: ["400", "600", "700"] });

interface PendingRoleScreenProps {
    user: {
        email: string;
        name?: string;
        provider?: string;
    };
    onLogout: () => void;
}

const GRAY = {
    950: "#0a0a0b",
    800: "#222225",
    500: "#6b6b72",
    200: "#d3d3d6",
    50: "#f4f4f5",
};
const TEXT_SECONDARY = "#505056";

function providerLabel(provider?: string): string {
    // "Google" | "Slack" | "email" — see AuthContext's User.provider.
    // Falls back to "email" (credentials login) when unset.
    if (provider === "Google" || provider === "Slack") return provider;
    return "email";
}

/**
 * Post-signup gate: an authenticated user with no role assigned yet lands
 * here instead of the dashboard. Confirms the account exists, states that
 * E8 has been notified, and offers "Check status" / "Sign out".
 *
 * Design handoff: Account Pending Assignment (E8 neutral token set, high
 * fidelity — see design_handoff_account_pending/README.md).
 */
export function PendingRoleScreen({ user, onLogout }: PendingRoleScreenProps) {
    const { refreshUser } = useAuth();
    const [checking, setChecking] = useState(false);
    const [checkError, setCheckError] = useState<string | null>(null);
    const [noRoleYet, setNoRoleYet] = useState(false);

    const displayName = user.name || user.email;
    const provider = providerLabel(user.provider);

    const handleCheckStatus = async () => {
        if (checking) return;
        setChecking(true);
        setCheckError(null);
        setNoRoleYet(false);
        try {
            const role = await refreshUser();
            if (!role) {
                // Still unassigned — App.tsx keeps rendering this screen;
                // just surface a brief inline confirmation.
                setNoRoleYet(true);
                setTimeout(() => setNoRoleYet(false), 4000);
            }
            // If a role IS now present, App.tsx's `!user.role` guard stops
            // rendering this screen on the next render — no redirect needed here.
        } catch {
            setCheckError("Status check failed — retry in 30s");
        } finally {
            setChecking(false);
        }
    };

    return (
        <div
            className={inter.className}
            style={{
                minHeight: "100vh",
                background: GRAY[50],
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "48px 24px",
                boxSizing: "border-box",
                gap: 32,
                color: GRAY[950],
            }}
        >
            {/* Logo lockup */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <img src="/assets/e8-logo-black.png" alt="E8 Productions, LLC" style={{ height: 40, width: "auto", display: "block" }} />
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: ".14em",
                        textTransform: "uppercase",
                        color: GRAY[500],
                    }}
                >
                    E8 Productions, LLC
                </div>
            </div>

            {/* Card */}
            <div
                style={{
                    width: "100%",
                    maxWidth: 480,
                    background: "#ffffff",
                    borderRadius: 16,
                    boxShadow: "0 1px 2px rgba(10,10,11,.04), 0 8px 24px rgba(10,10,11,.06)",
                    overflow: "hidden",
                }}
            >
                {/* Header block */}
                <div style={{ padding: "32px 32px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Clock size={20} color={GRAY[950]} strokeWidth={1.5} style={{ flex: "none" }} />
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: ".12em",
                                textTransform: "uppercase",
                                color: GRAY[950],
                            }}
                        >
                            Pending role assignment
                        </span>
                    </div>

                    <h1
                        style={{
                            margin: 0,
                            fontSize: 28,
                            lineHeight: 1.2,
                            fontWeight: 700,
                            letterSpacing: "-.02em",
                        }}
                    >
                        Your account is waiting on a role
                    </h1>

                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: TEXT_SECONDARY }}>
                        Hi <strong style={{ color: GRAY[950], fontWeight: 600 }}>{displayName}</strong>, your
                        account was created successfully via {provider}. An administrator assigns your role
                        before the dashboard opens.
                    </p>
                </div>

                {/* Status block */}
                <div style={{ padding: "0 32px 24px" }}>
                    <div
                        style={{
                            border: `${checkError ? 2 : 1}px solid ${checkError ? GRAY[950] : GRAY[200]}`,
                            borderRadius: 12,
                            padding: 16,
                            display: "grid",
                            gridTemplateColumns: "20px 1fr",
                            gap: 12,
                            alignItems: "start",
                        }}
                    >
                        <Check size={20} color={GRAY[950]} strokeWidth={1.5} style={{ flex: "none", marginTop: 1 }} />
                        <span style={{ fontSize: 14, lineHeight: 1.6, color: GRAY[800] }}>
                            {checkError
                                ? checkError
                                : "E8 has been notified. You will get an email once your role has been updated."}
                        </span>
                    </div>
                    {noRoleYet && !checkError && (
                        <div style={{ marginTop: 8, fontSize: 12, color: GRAY[500] }}>No role yet</div>
                    )}
                </div>

                {/* Action bar */}
                <div
                    style={{
                        padding: "20px 32px",
                        borderTop: `1px solid ${GRAY[200]}`,
                        background: GRAY[50],
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                        flexWrap: "wrap",
                    }}
                >
                    <button
                        type="button"
                        onClick={handleCheckStatus}
                        disabled={checking}
                        className="max-[380px]:w-full"
                        style={{
                            fontFamily: "inherit",
                            fontWeight: 600,
                            fontSize: 14,
                            borderRadius: 8,
                            border: "1px solid transparent",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            lineHeight: 1,
                            padding: "10px 16px",
                            transition: "opacity .12s ease",
                            cursor: checking ? "not-allowed" : "pointer",
                            background: checking ? "#e7e7e9" : GRAY[950],
                            color: checking ? "#b0b0b5" : "#ffffff",
                        }}
                        onMouseEnter={(e) => { if (!checking) e.currentTarget.style.opacity = ".85"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                    >
                        <RefreshCw size={16} strokeWidth={1.5} className={checking ? "animate-spin" : undefined} />
                        {checking ? "Checking…" : "Check status"}
                    </button>

                    <button
                        type="button"
                        onClick={onLogout}
                        className="max-[380px]:w-full"
                        style={{
                            fontFamily: "inherit",
                            fontWeight: 600,
                            fontSize: 14,
                            borderRadius: 8,
                            border: `1px solid ${GRAY[950]}`,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            lineHeight: 1,
                            padding: "10px 16px",
                            transition: "opacity .12s ease, background .12s ease",
                            cursor: "pointer",
                            background: "transparent",
                            color: GRAY[950],
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = GRAY[50]; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                        <LogOut size={16} strokeWidth={1.5} />
                        Sign out
                    </button>
                </div>
            </div>

            {/* Footer note */}
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: GRAY[500], textAlign: "center", maxWidth: 420 }}>
                Access is granted per role. Questions about permissions contact E8.
            </p>
        </div>
    );
}