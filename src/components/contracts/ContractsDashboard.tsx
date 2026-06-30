"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    FileText,
    Plus,
    Search,
    Send,
    Download,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Eye,
    Bell,
    Loader2,
    RefreshCw,
    X,
    PenLine,
    ExternalLink,
} from "lucide-react";
import dynamic from "next/dynamic";
import { ContractStatusBadge, SignerStatusBadge } from "./ContractStatusBadge";
import { CreateContractDialog } from "./CreateContractDialog";

const ContractDetailView = dynamic(() => import("./ContractDetailView").then(mod => mod.ContractDetailView), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center p-20">
            <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
                <p className="text-sm font-bold text-gray-400">Loading Document Details...</p>
            </div>
        </div>
    )
});

interface Signer {
    id: string;
    name: string;
    email: string;
    status: string;
    signedAt: string | null;
    role: string;
}

interface Contract {
    id: string;
    title: string;
    description: string | null;
    status: string;
    fileName: string;
    fileSize: string;
    message: string | null;
    clientId: string | null;
    expiresAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
    signers: Signer[];
    createdBy: { id: number; name: string | null; email: string };
}

const STATUS_TABS = [
    { id: "all", label: "All", icon: FileText },
    { id: "DRAFT", label: "Draft", icon: Clock },
    { id: "SENT", label: "Sent", icon: Send },
    { id: "PARTIALLY_SIGNED", label: "Partially Signed", icon: AlertCircle },
    { id: "COMPLETED", label: "Completed", icon: CheckCircle2 },
    { id: "CANCELLED", label: "Cancelled", icon: XCircle },
];

interface ViewModal {
    contractId: string;
    viewUrl: string;
    title: string;
    mode: 'sign' | 'view' | 'external';
}

export function ContractsDashboard() {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [selectedContract, setSelectedContract] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [viewModal, setViewModal] = useState<ViewModal | null>(null);
    const [viewLoading, setViewLoading] = useState<string | null>(null);
    const [downloadLoading, setDownloadLoading] = useState<string | null>(null);
    const [syncingAll, setSyncingAll] = useState(false);
    const [syncAllResult, setSyncAllResult] = useState<string | null>(null);

    const syncWithSignWell = useCallback(async () => {
        try {
            setSyncing(true);
            const res = await fetch("/api/contracts/sync");
            if (res.ok) {
                const data = await res.json();
                if (data.syncedCount > 0) {
                    await fetchContracts();
                }
            }
        } catch (err) {
            console.error("Failed to sync:", err);
        } finally {
            setSyncing(false);
        }
    }, [fetchContracts]);

    // Fix all stuck PENDING signers across all contracts in one shot
    const syncAllSigners = useCallback(async () => {
        setSyncingAll(true);
        setSyncAllResult(null);
        try {
            const res = await fetch('/api/contracts/sync-all-signers', {
                method: 'POST',
                credentials: 'include',
            });
            const data = await res.json();
            if (res.ok) {
                setSyncAllResult(
                    `Fixed ${data.signersFixed} signer(s) across ${data.contractsFixed} contract(s).`
                );
                await fetchContracts();
            } else {
                setSyncAllResult(data.error || 'Sync failed');
            }
        } catch (err) {
            setSyncAllResult('Network error — check console');
            console.error('syncAllSigners failed:', err);
        } finally {
            setSyncingAll(false);
            // Clear the result message after 5 seconds
            setTimeout(() => setSyncAllResult(null), 5000);
        }
    }, [fetchContracts]);

    const fetchContracts = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (activeTab !== "all") params.set("status", activeTab);
            if (searchQuery) params.set("search", searchQuery);

            const res = await fetch(`/api/contracts?${params.toString()}`, {
                credentials: "include",
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
    }, [activeTab, searchQuery]);

    useEffect(() => {
        fetchContracts();
    }, [fetchContracts]);

    // Automatically sync in the background on mount and every 30 seconds
    useEffect(() => {
        syncWithSignWell();
        const intervalId = setInterval(syncWithSignWell, 30000);
        return () => clearInterval(intervalId);
    }, [syncWithSignWell]);

    const getSignerSummary = (signers: Signer[]) => {
        const signed = signers.filter((s) => s.status === "SIGNED").length;
        return `${signed}/${signers.length}`;
    };

    const handleViewContract = useCallback(async (contractId: string, contractTitle: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setViewLoading(contractId);
        try {
            const res = await fetch(`/api/contracts/${contractId}/view-url`, { credentials: 'include' });
            const data = await res.json();
            if (res.ok && data.viewUrl) {
                if (data.mode === 'external') {
                    // Open SignWell web portal in a new tab
                    window.open(data.viewUrl, '_blank');
                } else {
                    setViewModal({
                        contractId,
                        viewUrl: data.viewUrl,
                        title: contractTitle,
                        mode: data.mode,
                    });
                }
            } else {
                alert(data.error || 'Could not load contract viewer');
            }
        } catch (err) {
            console.error('View contract failed:', err);
            alert('Failed to load contract viewer');
        } finally {
            setViewLoading(null);
        }
    }, []);

    const handleDownloadContract = useCallback(async (contractId: string, contractTitle: string, status: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDownloadLoading(contractId);
        const type = status === 'COMPLETED' ? 'signed' : 'original';
        try {
            const res = await fetch(`/api/contracts/${contractId}/download?type=${type}`, { credentials: 'include' });
            const data = await res.json();
            if (res.ok && data.downloadUrl) {
                // Trigger browser download
                const a = document.createElement('a');
                a.href = data.downloadUrl;
                a.download = data.filename || `${contractTitle}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else {
                alert(data.error || 'Download failed — no PDF available yet');
            }
        } catch (err) {
            console.error('Download failed:', err);
            alert('Failed to download contract');
        } finally {
            setDownloadLoading(null);
        }
    }, []);

    if (selectedContract) {
        return (
            <ContractDetailView
                contractId={selectedContract}
                onBack={() => {
                    setSelectedContract(null);
                    fetchContracts();
                }}
            />
        );
    }

    return (
        <>
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        Contracts
                    </h1>
                    <p className="text-muted-foreground mt-1 text-lg">
                        Create, send, and track signed contracts
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {syncing && <RefreshCw className="h-4 w-4 text-gray-400 animate-spin mr-2" />}
                    {/* Fix stuck signer statuses */}
                    <button
                        onClick={syncAllSigners}
                        disabled={syncingAll}
                        title="Re-sync all signer statuses from SignWell — fixes signers showing as Pending after signing"
                        className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
                    >
                        {syncingAll
                            ? <><RefreshCw className="h-4 w-4 animate-spin" /> Syncing...</>
                            : <><RefreshCw className="h-4 w-4" /> Sync Signers</>}
                    </button>
                    <button
                        onClick={() => setShowCreateDialog(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Plus className="h-4 w-4" />
                        New Contract
                    </button>
                </div>
            </div>

            {/* Sync result toast */}
            {syncAllResult && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    {syncAllResult}
                </div>
            )}

            {/* Status Tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl overflow-x-auto">
                {STATUS_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const count =
                        tab.id === "all"
                            ? contracts.length
                            : contracts.filter((c) => c.status === tab.id).length;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {tab.label}
                            {count > 0 && (
                                <span
                                    className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${activeTab === tab.id
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-gray-200 text-gray-600"
                                        }`}
                                >
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search contracts..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                />
            </div>

            {/* Contracts List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            ) : contracts.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-1">
                        No contracts yet
                    </h3>
                    <p className="text-sm text-gray-400 mb-4">
                        Create your first contract to get started
                    </p>
                    <button
                        onClick={() => setShowCreateDialog(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" />
                        Create Contract
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Contract
                                </th>
                                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Signers
                                </th>
                                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Created
                                </th>
                                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {contracts.map((contract) => (
                                <tr
                                    key={contract.id}
                                    className="hover:bg-blue-50/30 cursor-pointer transition-colors"
                                    onClick={() => setSelectedContract(contract.id)}
                                >
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 rounded-lg">
                                                <FileText className="h-4 w-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 text-sm">
                                                    {contract.title}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {contract.fileName}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <ContractStatusBadge status={contract.status} />
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="flex -space-x-1.5">
                                                {contract.signers.slice(0, 3).map((signer) => (
                                                    <div
                                                        key={signer.id}
                                                        className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold ${signer.status === "SIGNED"
                                                            ? "bg-green-100 text-green-700"
                                                            : signer.status === "VIEWED"
                                                                ? "bg-blue-100 text-blue-700"
                                                                : "bg-gray-100 text-gray-600"
                                                            }`}
                                                        title={`${signer.name} (${signer.status})`}
                                                    >
                                                        {signer.name
                                                            .split(" ")
                                                            .map((n) => n[0])
                                                            .join("")
                                                            .toUpperCase()
                                                            .slice(0, 2)}
                                                    </div>
                                                ))}
                                                {contract.signers.length > 3 && (
                                                    <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                                                        +{contract.signers.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-xs text-gray-500 font-medium">
                                                {getSignerSummary(contract.signers)} signed
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="text-sm text-gray-600">
                                            {new Date(contract.createdAt).toLocaleDateString(
                                                "en-US",
                                                {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric",
                                                }
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            by {contract.createdBy.name || contract.createdBy.email}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {/* Eye — opens SignWell contract viewer in modal */}
                                            <button
                                                onClick={(e) => handleViewContract(contract.id, contract.title, e)}
                                                disabled={viewLoading === contract.id}
                                                title="View contract"
                                                className="p-1.5 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50 group"
                                            >
                                                {viewLoading === contract.id
                                                    ? <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                                                    : <Eye className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />}
                                            </button>
                                            {/* Download — triggers PDF download */}
                                            <button
                                                onClick={(e) => handleDownloadContract(contract.id, contract.title, contract.status, e)}
                                                disabled={downloadLoading === contract.id}
                                                title={contract.status === 'COMPLETED' ? 'Download signed PDF' : 'Download original PDF'}
                                                className="p-1.5 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50 group"
                                            >
                                                {downloadLoading === contract.id
                                                    ? <Loader2 className="h-4 w-4 text-green-400 animate-spin" />
                                                    : <Download className="h-4 w-4 text-gray-400 group-hover:text-green-600" />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Dialog */}
            {showCreateDialog && (
                <CreateContractDialog
                    onClose={() => setShowCreateDialog(false)}
                    onCreated={() => {
                        setShowCreateDialog(false);
                        fetchContracts();
                    }}
                />
            )}
        </div>

        {/* Contract Viewer Modal */}
        {viewModal && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <PenLine className="h-4 w-4 text-blue-600" />
                            <span className="font-semibold text-gray-900 text-sm">
                                {viewModal.mode === 'sign' ? 'Sign Contract' : 'View Contract'}
                            </span>
                            <span className="text-xs text-gray-400">— {viewModal.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href={viewModal.viewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-500 hover:text-gray-700"
                                title="Open in new tab"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </a>
                            <button
                                onClick={() => setViewModal(null)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition"
                            >
                                <X className="h-4 w-4 text-gray-500" />
                            </button>
                        </div>
                    </div>
                    {/* Iframe */}
                    <div className="flex-1 overflow-hidden rounded-b-2xl">
                        <iframe
                            src={viewModal.viewUrl}
                            className="w-full h-full border-0"
                            title={viewModal.title}
                            allow="camera; microphone"
                        />
                    </div>
                </div>
            </div>
        )}
        </>
    );
}