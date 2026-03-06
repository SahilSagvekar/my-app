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
    Search,
} from "lucide-react";

import { ContractStatusBadge, SignerStatusBadge } from "./ContractStatusBadge";
import { ContractDetailView } from "./ContractDetailView";

export function ClientContractsPage() {
    const [contracts, setContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchContracts = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (searchQuery) params.set("search", searchQuery);

            const res = await fetch(`/api/contracts?${params.toString()}`, {
                credentials: "include"
            });
            if (res.ok) {
                const data = await res.json();
                setContracts(data);
            }
        } catch (err) {
            console.error("Failed to fetch contracts:", err);
        } finally {
            setLoading(false);
        }
    }, [searchQuery]);

    useEffect(() => {
        fetchContracts();
    }, [fetchContracts, searchQuery]);


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

    if (selectedContractId) {
        return (
            <div className="space-y-6">
                <ContractDetailView
                    contractId={selectedContractId}
                    onBack={() => {
                        setSelectedContractId(null);
                        fetchContracts();
                    }}
                />
            </div>
        );
    }

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
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        My Contracts
                    </h1>
                    <p className="text-muted-foreground mt-1 text-lg">
                        Review and sign your legal documents safely
                    </p>
                </div>

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search documents..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                    />
                </div>
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
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <div className="p-1.5 bg-amber-100 rounded-md">
                                    <AlertCircle className="h-4 w-4 text-amber-600" />
                                </div>
                                Needs Your Signature ({needsAction.length})
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {needsAction.map((contract) => (
                                    <ContractCard
                                        key={contract.id}
                                        contract={contract}
                                        onDownload={handleDownload}
                                        onSelect={(id) => setSelectedContractId(id)}
                                        showSignButton
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Completed */}
                    {completed.length > 0 && (
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <div className="p-1.5 bg-green-100 rounded-md">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                </div>
                                Completed ({completed.length})
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {completed.map((contract) => (
                                    <ContractCard
                                        key={contract.id}
                                        contract={contract}
                                        onDownload={handleDownload}
                                        onSelect={(id) => setSelectedContractId(id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Other */}
                    {other.length > 0 && (
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-4">
                                Other ({other.length})
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {other.map((contract) => (
                                    <ContractCard
                                        key={contract.id}
                                        contract={contract}
                                        onDownload={handleDownload}
                                        onSelect={(id) => setSelectedContractId(id)}
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
    onSelect,
    showSignButton,
}: {
    contract: any;
    onDownload: (id: string, type: "original" | "signed") => void;
    onSelect: (id: string) => void;
    showSignButton?: boolean;
}) {
    return (
        <div
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => onSelect(contract.id)}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                        <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{contract.title}</h3>
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
                        className="inline-flex items-center gap-1.5 bg-gray-50 rounded-full px-2.5 py-1 border border-gray-100"
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
            <div className="mt-5 flex items-center gap-2 pt-4 border-t border-gray-50">
                {showSignButton ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(contract.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        ✍️ Review & Sign
                    </button>
                ) : (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(contract.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                    >
                        <Eye className="h-3.5 w-3.5" />
                        View Details
                    </button>
                )}

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDownload(contract.id, "original");
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 rounded-lg transition-colors ml-auto"
                >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                </button>
            </div>
        </div>
    );
}
