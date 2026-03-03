"use client";

import React, { useState, useEffect } from "react";
import {
    FileText,
    CheckCircle2,
    XCircle,
    Loader2,
    Shield,
    AlertTriangle
} from "lucide-react";
import { SignatureCapture } from "@/components/contracts/SignatureCapture";

export default function PublicSigningPage({ params }: { params: Promise<{ token: string }> }) {
    const [token, setToken] = useState<string>("");
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [signing, setSigning] = useState(false);
    const [signed, setSigned] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [showSignature, setShowSignature] = useState(false);

    useEffect(() => {
        params.then((p) => {
            setToken(p.token);
            fetchContract(p.token);
        });
    }, [params]);

    const fetchContract = async (tok: string) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/contracts/sign/${tok}`);

            if (!res.ok) {
                const d = await res.json();
                setError(d.error || "Failed to load contract");
                return;
            }

            const d = await res.json();
            setData(d);

            if (d.signer.status === "SIGNED") {
                setSigned(true);
            }
        } catch (err: any) {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSign = async (signatureDataUrl: string, signatureType: "draw" | "type") => {
        setSigning(true);
        try {
            const res = await fetch(`/api/contracts/sign/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    signatureData: signatureDataUrl,
                    signatureType,
                }),
            });

            if (!res.ok) {
                const d = await res.json();
                setError(d.error || "Signing failed");
                return;
            }

            const result = await res.json();
            setSigned(true);
        } catch (err) {
            setError("Network error. Please try again.");
        } finally {
            setSigning(false);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-gray-500">Loading contract...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error && !data) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-red-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-10 text-center max-w-md">
                    <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Unable to Load</h1>
                    <p className="text-gray-500">{error}</p>
                </div>
            </div>
        );
    }

    // Already signed
    if (signed) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-green-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-10 text-center max-w-md">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        Successfully Signed! 🎉
                    </h1>
                    <p className="text-gray-500 mb-2">
                        You have signed <strong>"{data?.contract.title}"</strong>.
                    </p>
                    <p className="text-sm text-gray-400">
                        You&apos;ll receive a copy when all parties have signed.
                    </p>
                    <div className="mt-6 p-4 bg-green-50 rounded-xl">
                        <div className="flex items-center gap-2 justify-center text-green-700">
                            <Shield className="h-4 w-4" />
                            <span className="text-sm font-medium">
                                Your signature has been securely recorded
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const contract = data?.contract;
    const signer = data?.signer;

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">{contract.title}</p>
                            <p className="text-xs text-gray-500">
                                From {contract.senderName}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Shield className="h-4 w-4 text-green-500" />
                        Secure Signing
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
                {/* Message */}
                {contract.message && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <p className="text-sm text-gray-500 font-medium mb-1">
                            Message from {contract.senderName}:
                        </p>
                        <p className="text-gray-700">{contract.message}</p>
                    </div>
                )}

                {/* Signer Info */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <p className="text-sm text-gray-500 mb-2">Signing as:</p>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                            {signer.name
                                .split(" ")
                                .map((n: string) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">{signer.name}</p>
                            <p className="text-xs text-gray-500">{signer.email}</p>
                        </div>
                    </div>
                </div>

                {/* Document Preview */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-700">
                            📄 {contract.fileName}
                        </h3>
                    </div>
                    <iframe
                        src={`/api/contracts/sign/${token}/preview`}
                        className="w-full h-[600px]"
                        title="Contract PDF"
                    />
                </div>

                {/* Agree and Sign */}
                {!showSignature ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                        <div className="flex items-start gap-3">
                            <input
                                type="checkbox"
                                id="agree"
                                checked={agreed}
                                onChange={(e) => setAgreed(e.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="agree" className="text-sm text-gray-700">
                                I have reviewed the document above and agree to sign it
                                electronically. I understand this constitutes a legal signature.
                            </label>
                        </div>

                        <button
                            onClick={() => setShowSignature(true)}
                            disabled={!agreed}
                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                            Continue to Sign
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            ✍️ Your Signature
                        </h3>
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
                                {error}
                            </div>
                        )}
                        {signing ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="text-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm">Submitting your signature...</p>
                                </div>
                            </div>
                        ) : (
                            <SignatureCapture
                                onCapture={handleSign}
                                signerName={signer.name}
                            />
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="text-center text-xs text-gray-400 pb-8 space-y-1">
                    <p>This document is being sent via E8 Productions.</p>
                    <div className="flex items-center justify-center gap-1">
                        <Shield className="h-3 w-3" />
                        <span>
                            Your signature and IP are recorded for legal verification.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
