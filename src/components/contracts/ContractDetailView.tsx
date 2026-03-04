"use client";

import React, { useState, useEffect } from "react";
import {
    ArrowLeft,
    Send,
    Bell,
    Download,
    Trash2,
    Edit3,
    FileText,
    Clock,
    CheckCircle2,
    Eye,
    XCircle,
    Loader2,
    Copy,
    ExternalLink,
    User,
    PenLine,
} from "lucide-react";
import { ContractStatusBadge, SignerStatusBadge } from "./ContractStatusBadge";
import dynamic from "next/dynamic";

const ContractEditor = dynamic(() => import("./ContractEditor").then(mod => mod.ContractEditor), {
    ssr: false,
    loading: () => (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
                <p className="text-sm font-bold text-gray-400 font-sans">Initializing Editor...</p>
            </div>
        </div>
    )
});
import { SignatureCapture } from "./SignatureCapture";
import { useAuth } from "@/components/auth/AuthContext";

interface ContractDetailViewProps {
    contractId: string;
    onBack: () => void;
}

export function ContractDetailView({ contractId, onBack }: ContractDetailViewProps) {
    const { user } = useAuth();
    const [contract, setContract] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState("");
    const [showEditor, setShowEditor] = useState(false);
    const [showSignPanel, setShowSignPanel] = useState(false);
    const [signing, setSigning] = useState(false);
    const [fieldValues, setFieldValues] = useState<Record<string, any>>({});

    const fetchContract = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/contracts/${contractId}`, {
                credentials: "include",
            });
            if (res.ok) {
                const data = await res.json();
                setContract(data);
            }
        } catch (err) {
            console.error("Failed to fetch contract:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContract();
    }, [contractId]);

    const handleSend = async () => {
        if (!confirm("Send this contract to all signers?")) return;
        setActionLoading("send");
        try {
            const res = await fetch(`/api/contracts/${contractId}/send`, {
                method: "POST",
                credentials: "include",
            });
            if (res.ok) {
                await fetchContract();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to send");
            }
        } catch (err) {
            alert("Network error");
        } finally {
            setActionLoading("");
        }
    };

    const handleRemind = async () => {
        setActionLoading("remind");
        try {
            const res = await fetch(`/api/contracts/${contractId}/remind`, {
                method: "POST",
                credentials: "include",
            });
            if (res.ok) {
                const data = await res.json();
                alert(`Reminders sent to ${data.emailResults?.length || 0} signer(s)`);
                await fetchContract();
            }
        } catch (err) {
            alert("Network error");
        } finally {
            setActionLoading("");
        }
    };

    const handleCancel = async () => {
        if (!confirm("Cancel this contract? This action cannot be undone.")) return;
        setActionLoading("cancel");
        try {
            const res = await fetch(`/api/contracts/${contractId}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "cancel" }),
            });
            if (res.ok) {
                await fetchContract();
            }
        } catch (err) {
            alert("Network error");
        } finally {
            setActionLoading("");
        }
    };

    const handleDownload = async (type: "original" | "signed") => {
        setActionLoading("download");
        try {
            const res = await fetch(
                `/api/contracts/${contractId}/download?type=${type}`,
                { credentials: "include" }
            );
            if (res.ok) {
                const data = await res.json();
                window.open(data.downloadUrl, "_blank");
            }
        } catch (err) {
            alert("Download failed");
        } finally {
            setActionLoading("");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!contract) {
        return (
            <div className="text-center py-20">
                <p className="text-gray-500">Contract not found</p>
                <button onClick={onBack} className="text-blue-600 hover:underline mt-2">
                    Go Back
                </button>
            </div>
        );
    }

    if (showEditor && contract.status === "DRAFT") {
        return (
            <ContractEditor
                contract={contract}
                onBack={() => {
                    setShowEditor(false);
                    fetchContract();
                }}
            />
        );
    }

    const actionIcon = (name: string) =>
        actionLoading === name ? (
            <Loader2 className="h-4 w-4 animate-spin" />
        ) : null;

    // Find if the current user is a signer on this contract
    const mySigner = contract?.signers?.find(
        (s: any) => s.email.toLowerCase() === (user?.email || "").toLowerCase()
    );
    const canSignNow = mySigner && mySigner.status !== "SIGNED" && mySigner.status !== "DECLINED"
        && contract.status !== "CANCELLED" && contract.status !== "EXPIRED" && contract.status !== "DRAFT";

    // Parse annotations for field-filling
    const annotations: any[] = contract?.annotations
        ? (typeof contract.annotations === 'string'
            ? (() => { try { return JSON.parse(contract.annotations); } catch { return []; } })()
            : Array.isArray(contract.annotations) ? contract.annotations : [])
        : [];
    const fillableFields = annotations.filter(a => a.type !== 'signature' && a.type !== 'initials');
    const requiredFields = annotations.filter(a => a.required);
    const unfilledRequired = requiredFields.filter(a => !fieldValues[a.id]);
    const allRequiredFilled = unfilledRequired.length === 0;

    const handleFieldFill = (id: string, value: any) => {
        setFieldValues(prev => ({ ...prev, [id]: value }));
    };

    const handleSignNow = async (signatureDataUrl: string, signatureType: "draw" | "type") => {
        if (!mySigner) return;
        setSigning(true);
        try {
            const res = await fetch(`/api/contracts/sign/${mySigner.signToken}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    signatureData: signatureDataUrl,
                    signatureType,
                    fieldValues,
                }),
            });
            if (res.ok) {
                const result = await res.json();
                setShowSignPanel(false);
                await fetchContract();
                if (result.completed) {
                    alert("🎉 Contract fully signed and completed!");
                } else {
                    alert("✅ Your signature has been recorded!");
                }
            } else {
                const data = await res.json();
                alert(data.error || "Signing failed");
            }
        } catch (err) {
            alert("Network error");
        } finally {
            setSigning(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-gray-500" />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-900">{contract.title}</h1>
                        <ContractStatusBadge status={contract.status} />
                    </div>
                    {contract.description && (
                        <p className="text-sm text-gray-500 mt-1">{contract.description}</p>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
                {contract.status === "DRAFT" && (
                    <>
                        <button
                            onClick={handleSend}
                            disabled={!!actionLoading}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {actionIcon("send") || <Send className="h-4 w-4" />}
                            Send for Signing
                        </button>
                        <button
                            onClick={() => setShowEditor(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-100 transition-colors border border-purple-200"
                        >
                            <Edit3 className="h-4 w-4" />
                            Edit Contract
                        </button>
                    </>
                )}

                {(contract.status === "SENT" || contract.status === "PARTIALLY_SIGNED") && (
                    <button
                        onClick={handleRemind}
                        disabled={!!actionLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-semibold hover:bg-amber-100 disabled:opacity-50 transition-colors border border-amber-200"
                    >
                        {actionIcon("remind") || <Bell className="h-4 w-4" />}
                        Send Reminder
                    </button>
                )}

                <button
                    onClick={() => handleDownload("original")}
                    disabled={!!actionLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50 transition-colors border border-gray-200"
                >
                    {actionIcon("download") || <Download className="h-4 w-4" />}
                    Download Original
                </button>

                {contract.signedS3Key && (
                    <button
                        onClick={() => handleDownload("signed")}
                        disabled={!!actionLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-semibold hover:bg-green-100 disabled:opacity-50 transition-colors border border-green-200"
                    >
                        <Download className="h-4 w-4" />
                        Download Signed
                    </button>
                )}

                {contract.status !== "COMPLETED" && contract.status !== "CANCELLED" && (
                    <button
                        onClick={handleCancel}
                        disabled={!!actionLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                        <XCircle className="h-4 w-4" />
                        Cancel
                    </button>
                )}

                {canSignNow && (
                    <button
                        onClick={() => setShowSignPanel(!showSignPanel)}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg text-sm font-bold hover:from-green-700 hover:to-emerald-700 transition-all shadow-md shadow-green-200"
                    >
                        <PenLine className="h-4 w-4" />
                        {showSignPanel ? "Hide Signing" : "✍️ Sign Now"}
                    </button>
                )}

                {mySigner?.status === "SIGNED" && (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-semibold border border-green-200">
                        <CheckCircle2 className="h-4 w-4" />
                        You've Signed
                    </span>
                )}
            </div>

            {/* Inline Sign Panel — with field-filling before signature */}
            {showSignPanel && canSignNow && (
                <div className="bg-gradient-to-b from-indigo-50 to-white rounded-xl border-2 border-indigo-200 p-6 shadow-sm space-y-6">
                    {/* Step 1: Fill in required fields */}
                    {fillableFields.length > 0 && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-indigo-100 rounded-lg">
                                    <Edit3 className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Fill in Your Details</h3>
                                    <p className="text-sm text-gray-500">
                                        {unfilledRequired.length > 0
                                            ? `Please complete ${unfilledRequired.length} required field${unfilledRequired.length === 1 ? '' : 's'} before signing`
                                            : 'All fields filled — you can now sign below'}
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {fillableFields.map((field: any) => {
                                    const isFilled = !!fieldValues[field.id];
                                    return (
                                        <div key={field.id} className="space-y-1">
                                            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                                                {field.fieldName || field.placeholder || field.type}
                                                {field.required && !isFilled && (
                                                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">REQUIRED</span>
                                                )}
                                                {isFilled && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                                            </label>
                                            {field.type === 'checkbox' ? (
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 accent-indigo-500 rounded"
                                                        checked={!!fieldValues[field.id]}
                                                        onChange={(e) => handleFieldFill(field.id, e.target.checked)}
                                                    />
                                                    <span className="text-sm text-gray-700">{field.placeholder || 'Check to agree'}</span>
                                                </label>
                                            ) : (
                                                <input
                                                    type="text"
                                                    placeholder={field.placeholder || field.type}
                                                    className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-all ${
                                                        isFilled
                                                            ? 'border-green-300 bg-green-50 focus:ring-2 focus:ring-green-100'
                                                            : field.required
                                                                ? 'border-indigo-300 bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400'
                                                                : 'border-gray-200 bg-white focus:ring-2 focus:ring-gray-100'
                                                    }`}
                                                    value={fieldValues[field.id] || ''}
                                                    onChange={(e) => handleFieldFill(field.id, e.target.value)}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Signature — only enabled when all required fields are filled */}
                    <div className={!allRequiredFilled ? 'opacity-50 pointer-events-none' : ''}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-indigo-100 rounded-lg">
                                <PenLine className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Sign This Contract</h3>
                                <p className="text-sm text-gray-500">
                                    {allRequiredFilled
                                        ? 'Draw or type your signature below'
                                        : 'Complete all required fields above first'}
                                </p>
                            </div>
                        </div>
                        {signing ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="text-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm">Submitting your signature...</p>
                                </div>
                            </div>
                        ) : (
                            <SignatureCapture
                                onCapture={handleSignNow}
                                signerName={mySigner.name}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                        Document Info
                    </h3>
                    <div className="space-y-2.5">
                        <div className="flex items-center gap-2 text-sm">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600 truncate">{contract.fileName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">
                                Created {new Date(contract.createdAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">
                                {contract.createdBy.name || contract.createdBy.email}
                            </span>
                        </div>
                        {contract.expiresAt && (
                            <div className="flex items-center gap-2 text-sm text-amber-600">
                                <Clock className="h-4 w-4" />
                                Expires {new Date(contract.expiresAt).toLocaleDateString()}
                            </div>
                        )}
                    </div>
                </div>

                {/* Signers Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 md:col-span-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                        Signers ({contract.signers.length})
                    </h3>
                    <div className="space-y-3">
                        {contract.signers.map((signer: any) => (
                            <div
                                key={signer.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${signer.status === "SIGNED"
                                            ? "bg-green-100 text-green-700"
                                            : signer.status === "VIEWED"
                                                ? "bg-blue-100 text-blue-700"
                                                : "bg-gray-200 text-gray-600"
                                            }`}
                                    >
                                        {signer.name
                                            .split(" ")
                                            .map((n: string) => n[0])
                                            .join("")
                                            .toUpperCase()
                                            .slice(0, 2)}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm text-gray-900">{signer.name}</p>
                                        <p className="text-xs text-gray-400">{signer.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <SignerStatusBadge status={signer.status} />
                                    {signer.signedAt && (
                                        <span className="text-[11px] text-gray-400">
                                            {new Date(signer.signedAt).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* PDF Preview */}
            {contract.pdfUrl && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">Document Preview</h3>
                        <button
                            onClick={() => window.open(contract.pdfUrl, "_blank")}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                        >
                            <ExternalLink className="h-3 w-3" />
                            Open in New Tab
                        </button>
                    </div>
                    <iframe
                        src={`/api/contracts/${contractId}/preview`}
                        className="w-full h-[600px]"
                        title="Contract PDF Preview"
                    />
                </div>
            )}

            {/* Audit Trail */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                    Audit Trail
                </h3>
                <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                    <div className="space-y-4">
                        {contract.auditLogs.map((log: any, index: number) => (
                            <div key={log.id} className="flex items-start gap-4 relative">
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 border-white shadow-sm ${log.action === "completed"
                                        ? "bg-green-100"
                                        : log.action === "signed"
                                            ? "bg-blue-100"
                                            : log.action === "cancelled"
                                                ? "bg-red-100"
                                                : log.action === "sent"
                                                    ? "bg-purple-100"
                                                    : "bg-gray-100"
                                        }`}
                                >
                                    {log.action === "completed" && (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    )}
                                    {log.action === "signed" && (
                                        <Edit3 className="h-4 w-4 text-blue-600" />
                                    )}
                                    {log.action === "sent" && (
                                        <Send className="h-4 w-4 text-purple-600" />
                                    )}
                                    {log.action === "viewed" && (
                                        <Eye className="h-4 w-4 text-gray-500" />
                                    )}
                                    {log.action === "created" && (
                                        <FileText className="h-4 w-4 text-gray-500" />
                                    )}
                                    {log.action === "edited" && (
                                        <Edit3 className="h-4 w-4 text-purple-500" />
                                    )}
                                    {log.action === "cancelled" && (
                                        <XCircle className="h-4 w-4 text-red-500" />
                                    )}
                                    {log.action === "reminder_sent" && (
                                        <Bell className="h-4 w-4 text-amber-500" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 pb-4">
                                    <p className="text-sm font-medium text-gray-900 capitalize">
                                        {log.action.replace(/_/g, " ")}
                                    </p>
                                    {log.performedBy && (
                                        <p className="text-xs text-gray-500">by {log.performedBy}</p>
                                    )}
                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                        {new Date(log.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
