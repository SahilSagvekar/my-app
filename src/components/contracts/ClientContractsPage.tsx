"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    FileText,
    CheckCircle2,
    Clock,
    Download,
    Eye,
    Loader2,
    ExternalLink,
    AlertCircle,
} from "lucide-react";
import { ContractStatusBadge, SignerStatusBadge } from "./ContractStatusBadge";

export function ClientContractsPage() {
    const [contracts, setContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchContracts = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/contracts", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setContracts(data);
            }
        } catch (err) {
            console.error("Failed to fetch contracts:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchContracts();
    }, [fetchContracts]);

    const handleDownload = async (contractId: string, type: "original" | "signed") => {
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
            console.error("Download failed:", err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    const needsAction = contracts.filter(
        (c) => c.status === "SENT" || c.status === "PARTIALLY_SIGNED"
    );
    const completed = contracts.filter((c) => c.status === "COMPLETED");
    const other = contracts.filter(
        (c) =>
            c.status !== "SENT" &&
            c.status !== "PARTIALLY_SIGNED" &&
            c.status !== "COMPLETED"
    );

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                    My Contracts
                </h1>
                <p className="text-muted-foreground mt-1 text-lg">
                    Review and sign your contracts
                </p>
            </div>

            {contracts.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-1">
                        No contracts yet
                    </h3>
                    <p className="text-sm text-gray-400">
                        You'll see contracts here when they are sent to you for signing
                    </p>
                </div>
            ) : (
                <>
                    {/* Needs Action */}
                    {needsAction.length > 0 && (
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-amber-500" />
                                Needs Your Signature ({needsAction.length})
                            </h2>
                            <div className="space-y-3">
                                {needsAction.map((contract) => (
                                    <ContractCard
                                        key={contract.id}
                                        contract={contract}
                                        onDownload={handleDownload}
                                        showSignButton
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Completed */}
                    {completed.length > 0 && (
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                Completed ({completed.length})
                            </h2>
                            <div className="space-y-3">
                                {completed.map((contract) => (
                                    <ContractCard
                                        key={contract.id}
                                        contract={contract}
                                        onDownload={handleDownload}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Other */}
                    {other.length > 0 && (
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-3">
                                Other ({other.length})
                            </h2>
                            <div className="space-y-3">
                                {other.map((contract) => (
                                    <ContractCard
                                        key={contract.id}
                                        contract={contract}
                                        onDownload={handleDownload}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function ContractCard({
    contract,
    onDownload,
    showSignButton,
}: {
    contract: any;
    onDownload: (id: string, type: "original" | "signed") => void;
    showSignButton?: boolean;
}) {
    // Find the signer entry for the current user (we don't have user email here,
    // but the backend already filtered). We show the first "non-signed" signer's
    // link or just the first signer's link.
    const mySigner = contract.signers?.[0]; // backend filters to only show relevant contracts

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 rounded-lg">
                        <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">{contract.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            From {contract.createdBy?.name || contract.createdBy?.email} •{" "}
                            {new Date(contract.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                            })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <ContractStatusBadge status={contract.status} />
                </div>
            </div>

            {/* Signers Preview */}
            <div className="mt-4 flex items-center gap-2 flex-wrap">
                {contract.signers?.map((signer: any) => (
                    <div
                        key={signer.id}
                        className="inline-flex items-center gap-1.5 bg-gray-50 rounded-full px-2.5 py-1"
                    >
                        <div
                            className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center ${signer.status === "SIGNED"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-200 text-gray-600"
                                }`}
                        >
                            {signer.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-xs text-gray-600">{signer.name}</span>
                        <SignerStatusBadge status={signer.status} />
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="mt-4 flex items-center gap-2">
                <button
                    onClick={() => onDownload(contract.id, "original")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                >
                    <Download className="h-3.5 w-3.5" />
                    Download
                </button>
                {/* {contract.status === "COMPLETED" && (
                    <button
                        onClick={() => onDownload(contract.id, "signed")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 rounded-lg border border-green-200 transition-colors"
                    >
                        <Download className="h-3.5 w-3.5" />
                        Signed Copy
                    </button>
                )} */}
            </div>
        </div>
    );
}
