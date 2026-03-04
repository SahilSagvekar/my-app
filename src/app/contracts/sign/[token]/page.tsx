"use client";

import React, { useState, useEffect } from "react";
import {
    FileText,
    CheckCircle2,
    XCircle,
    Loader2,
    Shield,
    AlertTriangle,
    PenLine,
    ArrowLeft,
    CheckSquare,
    ChevronDown,
    Type,
    Circle,
    Calendar,
    Mail,
    Building2,
    Briefcase,
    Settings,
    LayoutGrid,
    ZoomIn,
    ZoomOut,
} from "lucide-react";
import { SignatureCapture } from "@/components/contracts/SignatureCapture";
import dynamic from "next/dynamic";

// Dynamically import the entire PDF viewer component to avoid pdfjs-dist SSR/webpack crash
// (Object.defineProperty called on non-object during module init in Next.js 15)
const SigningPDFViewer = dynamic(
    () => import("@/components/contracts/SigningPDFViewer"),
    {
        ssr: false,
        loading: () => (
            <div className="p-40 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
                <p className="text-gray-400 font-bold">Loading document viewer...</p>
            </div>
        ),
    }
);

export default function PublicSigningPage({ params }: { params: Promise<{ token: string }> }) {
    const [token, setToken] = useState<string>("");
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [signing, setSigning] = useState(false);
    const [signed, setSigned] = useState(false);
    const [showSignature, setShowSignature] = useState(false);
    const [zoom, setZoom] = useState(100);
    const [filledValues, setFilledValues] = useState<Record<string, any>>({});
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

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

    const handleFieldFill = (id: string, value: any) => {
        setFilledValues(prev => ({ ...prev, [id]: value }));
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
                    fieldValues: filledValues,
                }),
            });

            if (!res.ok) {
                const d = await res.json();
                setError(d.error || "Signing failed");
                return;
            }

            setSigned(true);
        } catch (err) {
            setError("Network error. Please try again.");
        } finally {
            setSigning(false);
            setShowSignature(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-sm font-bold text-gray-400">Loading document...</p>
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6 text-center">
                <div className="max-w-md bg-white p-10 rounded-2xl shadow-sm border border-gray-100">
                    <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold mb-2">Access Denied</h1>
                    <p className="text-sm text-gray-500 mb-6">{error}</p>
                </div>
            </div>
        );
    }

    if (signed) {
        return (
            <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6 text-center animate-in zoom-in-95 duration-500">
                <div className="max-w-md bg-white p-12 rounded-3xl shadow-xl border border-gray-100">
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="h-10 w-10 text-green-500" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Signed Successfully</h1>
                    <p className="text-sm text-gray-500 leading-relaxed mb-8">
                        You&apos;ve securely signed <strong>&quot;{data?.contract.title}&quot;</strong>. You&apos;ll receive a copy once all parties have completed the process.
                    </p>
                    <div className="flex items-center gap-2 justify-center text-xs text-gray-400 font-bold border-t pt-6">
                        <Shield className="h-3 w-3 text-green-500" />
                        SECURE RECORD SAVED
                    </div>
                </div>
            </div>
        );
    }

    const contract = data?.contract;
    const signer = data?.signer;
    const annotations: any[] = contract.annotations ? (typeof contract.annotations === 'string' ? JSON.parse(contract.annotations) : contract.annotations) : [];

    // All fields are for the signer to fill — no owner/signer distinction
    const requiredFields = annotations.filter((f: any) => f.required);
    const unfilledRequired = requiredFields.filter((f: any) => !filledValues[f.id]);
    const requiredPendingCount = unfilledRequired.length;

    return (
        <div className="min-h-screen bg-[#f1f3f6] flex flex-col font-sans">
            {/* Signing Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm backdrop-blur-md bg-white/90">
                <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-gray-900 leading-none">{contract.title}</p>
                            <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wider">Review & Sign • From {contract.senderName}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 border border-gray-200">
                            <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="p-1 hover:bg-white rounded transition-all">
                                <ZoomOut className="h-4 w-4 text-gray-400" />
                            </button>
                            <span className="text-[10px] font-bold text-gray-500 w-10 text-center">{zoom}%</span>
                            <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="p-1 hover:bg-white rounded transition-all">
                                <ZoomIn className="h-4 w-4 text-gray-400" />
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            {requiredPendingCount > 0 && (
                                <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                                    <AlertTriangle className="h-3 w-3" />
                                    {requiredPendingCount} required {requiredPendingCount === 1 ? 'field' : 'fields'} remaining
                                </div>
                            )}
                            <button
                                onClick={() => setShowSignature(true)}
                                disabled={requiredPendingCount > 0}
                                className={`flex items-center gap-2 px-8 py-2.5 rounded-xl font-black text-xs transition-all shadow-xl tracking-tight ${requiredPendingCount === 0
                                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 transform hover:-translate-y-0.5"
                                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                    }`}
                            >
                                <PenLine className="h-4 w-4" />
                                {requiredPendingCount > 0 ? `Fill ${requiredPendingCount} field${requiredPendingCount === 1 ? '' : 's'} to sign` : "Adopt and Sign"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <main className="flex-1 overflow-auto flex py-10 justify-center custom-scrollbar">
                <div className="relative" style={{ width: `${(800 * zoom) / 100}px` }}>
                    <div className="bg-white shadow-2xl rounded-sm">
                        <SigningPDFViewer
                            pdfUrl={`/api/contracts/sign/${token}/preview`}
                            annotations={annotations}
                            filledValues={filledValues}
                            onFieldFill={handleFieldFill}
                            onSignatureClick={(fieldId) => {
                                if (fieldId) {
                                    setSelectedFieldId(fieldId);
                                }
                                setShowSignature(true);
                            }}
                            signerName={signer.name}
                            zoom={zoom}
                        />
                    </div>
                </div>
            </main>

            {/* Signature Capture Modal */}
            {showSignature && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/40 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
                        <div className="p-8 pb-0 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Adopt Your Signature</h2>
                                <p className="text-gray-400 text-sm font-medium mt-1">This signature will be applied to your selected fields.</p>
                            </div>
                            <button onClick={() => setShowSignature(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                <ArrowLeft className="h-6 w-6 text-gray-400 rotate-180" />
                            </button>
                        </div>

                        <div className="p-8">
                            {signing ? (
                                <div className="py-20 text-center">
                                    <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
                                    <p className="text-gray-500 font-bold">Submitting your signature...</p>
                                </div>
                            ) : (
                                <SignatureCapture
                                    onCapture={(dataUrl, type) => {
                                        if (selectedFieldId) {
                                            handleFieldFill(selectedFieldId, { dataUrl, type });
                                            setShowSignature(false);
                                            setSelectedFieldId(null);
                                        } else {
                                            handleSign(dataUrl, type);
                                        }
                                    }}
                                    signerName={signer.name}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 10px; height: 10px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 3px solid #e2e8f0; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </div>
    );
}
