"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Send, Bell, Download, Trash2, FileText,
  Clock, CheckCircle2, Eye, XCircle, Loader2, User,
  ExternalLink, RefreshCw, PenLine, X,
} from "lucide-react";
import { ContractStatusBadge, SignerStatusBadge } from "./ContractStatusBadge";
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
  const [showSignModal, setShowSignModal] = useState(false);
  const [embeddedUrl, setEmbeddedUrl] = useState<string | null>(null);
  const [embeddedLoading, setEmbeddedLoading] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const isClient = user?.role === "client";

  const fetchContract = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/contracts/${contractId}`, { credentials: "include" });
      if (res.ok) setContract(await res.json());
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { fetchContract(); }, [fetchContract]);

  const handleRemind = async () => {
    setActionLoading("remind");
    try {
      const res = await fetch(`/api/contracts/${contractId}/remind`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json();
      if (res.ok) alert("Reminder sent via SignWell!");
      else alert(data.error || "Failed to send reminder");
    } finally { setActionLoading(""); }
  };

  const handleDownload = async (type: "original" | "signed") => {
    setActionLoading(`download-${type}`);
    try {
      const res = await fetch(`/api/contracts/${contractId}/download?type=${type}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        window.open(data.downloadUrl, "_blank");
      }
    } finally { setActionLoading(""); }
  };

  const handleSyncStatus = async () => {
    setActionLoading("sync");
    try {
      const res = await fetch(`/api/contracts/${contractId}/send`, {
        method: "POST", credentials: "include",
      });
      if (res.ok) {
        await fetchContract();
        alert("Status synced from SignWell");
      }
    } finally { setActionLoading(""); }
  };

  const handleOpenEmbeddedSigning = async () => {
    setEmbeddedLoading(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/embedded-url`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.embeddedUrl) {
        setEmbeddedUrl(data.embeddedUrl);
        setShowSignModal(true);
      } else {
        alert(data.error || "Could not load signing page");
      }
    } finally { setEmbeddedLoading(false); }
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
      <div className="text-center py-20 text-gray-500">Contract not found</div>
    );
  }

  const pendingSigners = contract.signers?.filter(
    (s: any) => s.status === "PENDING" || s.status === "VIEWED"
  ) || [];

  const mySignerRecord = isClient
    ? contract.signers?.find((s: any) => s.email?.toLowerCase() === user?.email?.toLowerCase())
    : null;
  const iNeedToSign = mySignerRecord && mySignerRecord.status !== "SIGNED";

  return (
    <>
      <div className="space-y-6">
        {/* Back + Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Contracts
          </button>
          <div className="flex items-center gap-2">
            {isAdmin && contract.status !== "COMPLETED" && contract.status !== "CANCELLED" && (
              <>
                <button
                  onClick={handleSyncStatus}
                  disabled={!!actionLoading}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${actionLoading === "sync" ? "animate-spin" : ""}`} />
                  Sync Status
                </button>
                {pendingSigners.length > 0 && (
                  <button
                    onClick={handleRemind}
                    disabled={!!actionLoading}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    {actionLoading === "remind" ? "Sending..." : "Send Reminder"}
                  </button>
                )}
              </>
            )}
            {contract.status === "COMPLETED" && (
              <button
                onClick={() => handleDownload("signed")}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {actionLoading.startsWith("download") ? "Downloading..." : "Download Signed PDF"}
              </button>
            )}
            {contract.status !== "COMPLETED" && (
              <button
                onClick={() => handleDownload("original")}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
            )}
          </div>
        </div>

        {/* Header card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{contract.title}</h1>
              {contract.description && (
                <p className="text-gray-500 text-sm mt-0.5">{contract.description}</p>
              )}
            </div>
            <ContractStatusBadge status={contract.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Created by</span>
              <p className="font-medium text-gray-900 mt-0.5">
                {contract.createdBy?.name || contract.createdBy?.email}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Created</span>
              <p className="font-medium text-gray-900 mt-0.5">
                {new Date(contract.createdAt).toLocaleDateString("en-US", {
                  month: "long", day: "numeric", year: "numeric",
                })}
              </p>
            </div>
            {contract.expiresAt && (
              <div>
                <span className="text-gray-500">Expires</span>
                <p className="font-medium text-gray-900 mt-0.5">
                  {new Date(contract.expiresAt).toLocaleDateString("en-US", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </p>
              </div>
            )}
            {contract.completedAt && (
              <div>
                <span className="text-gray-500">Completed</span>
                <p className="font-medium text-green-700 mt-0.5">
                  {new Date(contract.completedAt).toLocaleDateString("en-US", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>

          {/* SignWell badge */}
          {contract.signwellDocumentId && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
              <PenLine className="h-3.5 w-3.5" />
              Powered by SignWell
              <span className="text-gray-300">·</span>
              <span className="font-mono text-gray-400">{contract.signwellDocumentId.slice(0, 16)}...</span>
            </div>
          )}
        </div>

        {/* Client sign CTA */}
        {isClient && iNeedToSign && contract.status !== "COMPLETED" && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-blue-900">Your signature is required</p>
              <p className="text-sm text-blue-700 mt-0.5">
                Sign directly here or check your email for the signing link.
              </p>
            </div>
            <button
              onClick={handleOpenEmbeddedSigning}
              disabled={embeddedLoading}
              className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
            >
              {embeddedLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading...</>
                : <><PenLine className="h-4 w-4" /> Sign Now</>
              }
            </button>
          </div>
        )}

        {/* Signers */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
            Signers ({contract.signers?.length || 0})
          </h2>
          <div className="space-y-3">
            {(contract.signers || []).map((signer: any) => (
              <div
                key={signer.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{signer.name}</p>
                    <p className="text-xs text-gray-500">{signer.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {signer.signedAt && (
                    <span className="text-xs text-gray-400">
                      {new Date(signer.signedAt).toLocaleDateString()}
                    </span>
                  )}
                  <SignerStatusBadge status={signer.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit log */}
        {isAdmin && contract.auditLogs?.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Activity Log
            </h2>
            <div className="space-y-2">
              {contract.auditLogs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium text-gray-900 capitalize">
                      {log.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-gray-500"> by {log.performedBy}</span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(log.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Embedded Signing Modal */}
      {showSignModal && embeddedUrl && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <PenLine className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-gray-900 text-sm">Sign Contract</span>
                <span className="text-xs text-gray-400">— {contract.title}</span>
              </div>
              <button
                onClick={() => { setShowSignModal(false); setEmbeddedUrl(null); fetchContract(); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden rounded-b-2xl">
              <iframe
                src={embeddedUrl}
                className="w-full h-full border-0"
                title="Sign Contract"
                allow="camera; microphone"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
