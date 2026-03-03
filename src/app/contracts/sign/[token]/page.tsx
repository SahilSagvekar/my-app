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
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Stable 3.11.x worker initialization – eliminates Next.js evaluation crashes
if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
}

export default function PublicSigningPage({ params }: { params: Promise<{ token: string }> }) {
    const [token, setToken] = useState<string>("");
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [signing, setSigning] = useState(false);
    const [signed, setSigned] = useState(false);
    const [showSignature, setShowSignature] = useState(false);
    const [numPages, setNumPages] = useState<number>(0);
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

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
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

    // Check if current signer has pending required fields
    const signerFields = annotations.filter(a => a.assignedTo === signer.email);
    const requiredPendingCount = signerFields.filter(f => f.required && !filledValues[f.id]).length;

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

                        <button
                            onClick={() => setShowSignature(true)}
                            disabled={requiredPendingCount > 0}
                            className={`flex items-center gap-2 px-8 py-2.5 rounded-xl font-black text-xs transition-all shadow-xl tracking-tight ${requiredPendingCount === 0
                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 transform hover:-translate-y-0.5"
                                : "bg-gray-100 text-gray-400 cursor-not-allowed grayscale"
                                }`}
                        >
                            <PenLine className="h-4 w-4" />
                            {requiredPendingCount > 0 ? `Fill ${requiredPendingCount} more to sign` : "Adopt and Sign"}
                        </button>
                    </div>
                </div>
            </div>

            <main className="flex-1 overflow-auto flex py-10 justify-center custom-scrollbar">
                <div className="relative" style={{ width: `${(800 * zoom) / 100}px` }}>
                    <div className="bg-white shadow-2xl rounded-sm">
                        <Document
                            file={`/api/contracts/${contract.id}/preview`}
                            onLoadSuccess={onDocumentLoadSuccess}
                            loading={
                                <div className="p-40 text-center">
                                    <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
                                    <p className="text-gray-400 font-bold">Rendering document...</p>
                                </div>
                            }
                        >
                            {Array.from(new Array(numPages), (el, index) => (
                                <div key={`page_${index + 1}`} className="mb-4 shadow-sm relative">
                                    <Page
                                        pageNumber={index + 1}
                                        width={(800 * zoom) / 100}
                                        renderAnnotationLayer={false}
                                        renderTextLayer={false}
                                        className="h-auto"
                                    />
                                </div>
                            ))}
                        </Document>

                        {/* Interactive Fields Overlay */}
                        <div className="absolute inset-0 z-10 pointer-events-none">
                            {annotations.map((ann) => {
                                const isForMe = ann.assignedTo === signer.email;
                                const isOwner = ann.assignedTo === contract.createdBy?.email || ann.assignedTo === "owner";
                                const color = isOwner ? "#3b82f6" : "#f97316";
                                const isFilled = !!filledValues[ann.id];

                                return (
                                    <div
                                        key={ann.id}
                                        className={`absolute transition-all ${isForMe ? "pointer-events-auto cursor-pointer" : ""}`}
                                        style={{
                                            left: `${ann.x}%`,
                                            top: `${ann.y}%`,
                                            width: `${ann.width}%`,
                                            height: `${ann.height}%`,
                                        }}
                                        onClick={() => {
                                            if (isForMe) {
                                                if (ann.type === 'signature' || ann.type === 'initials') {
                                                    setShowSignature(true);
                                                    setSelectedFieldId(ann.id);
                                                }
                                            }
                                        }}
                                    >
                                        <div
                                            className={`w-full h-full flex flex-col items-center justify-center p-1 rounded-sm border-2 transition-all ${isForMe ? (isFilled ? "bg-white border-green-500 shadow-sm" : "bg-[#fff7ed] border-orange-400 hover:bg-orange-50 hover:border-orange-500 shadow-md") : "bg-gray-50 border-gray-200 opacity-40 grayscale"
                                                }`}
                                        >
                                            {isForMe && ann.required && !isFilled && (
                                                <div className="absolute top-0 right-1 text-[8px] font-black text-orange-600 bg-orange-100 px-1.5 rounded-bl">REQUIRED</div>
                                            )}

                                            <div className="flex items-center gap-1.5 px-2">
                                                {ann.type === 'signature' || ann.type === 'initials' ? (
                                                    isFilled ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[14px] font-serif italic text-blue-800 leading-tight">
                                                                {signer.name}
                                                            </span>
                                                            <div className="h-[1px] w-full bg-blue-800 mt-0.5 opacity-30" />
                                                            <span className="text-[7px] text-gray-400 font-mono mt-0.5">Signed by {signer.name}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <PenLine className="h-4 w-4 text-orange-400" />
                                                            <span className="text-[11px] font-black text-orange-600 tracking-tight">Click to Sign</span>
                                                        </div>
                                                    )
                                                ) : ann.type === 'checkbox' ? (
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 text-orange-500 rounded border-gray-300 pointer-events-auto"
                                                        checked={!!filledValues[ann.id]}
                                                        onChange={(e) => handleFieldFill(ann.id, e.target.checked)}
                                                        disabled={!isForMe}
                                                    />
                                                ) : (
                                                    <input
                                                        type="text"
                                                        placeholder={ann.placeholder || ann.type}
                                                        className={`w-full bg-transparent border-none text-[12px] font-bold outline-none text-center placeholder:text-gray-300 pointer-events-auto ${isForMe ? 'text-gray-800' : 'text-gray-400'}`}
                                                        value={filledValues[ann.id] || ""}
                                                        onChange={(e) => handleFieldFill(ann.id, e.target.value)}
                                                        disabled={!isForMe}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
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
