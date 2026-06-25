"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    FileText,
    Plus,
    Trash2,
    Upload,
    Loader2,
    X,
    UserPlus,
    Send,
    Calendar,
} from "lucide-react";

interface Signer {
    name: string;
    email: string;
}

interface CreateContractDialogProps {
    onClose: () => void;
    onCreated: () => void;
    /** Pre-fill clientId when opened from a client's context */
    clientId?: string;
    /** Alias used by ClientContractsInvoices */
    defaultClientId?: string;
    /** Pre-fill signers list */
    defaultSigners?: Signer[];
}

export function CreateContractDialog({
    onClose,
    onCreated,
    clientId,
    defaultClientId,
    defaultSigners,
}: CreateContractDialogProps) {
    // Support both clientId and defaultClientId (used by ClientContractsInvoices)
    const resolvedClientId = clientId || defaultClientId;
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [message, setMessage] = useState("");
    const [expiresInDays, setExpiresInDays] = useState(30);
    const [signers, setSigners] = useState<Signer[]>(defaultSigners && defaultSigners.length > 0 ? defaultSigners : [{ name: "", email: "" }]);
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Trap focus inside dialog
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    const addSigner = () =>
        setSigners((prev) => [...prev, { name: "", email: "" }]);

    const removeSigner = (index: number) =>
        setSigners((prev) => prev.filter((_, i) => i !== index));

    const updateSigner = (index: number, field: keyof Signer, value: string) =>
        setSigners((prev) =>
            prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
        );

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.type !== "application/pdf") {
            setError("Only PDF files are accepted.");
            return;
        }
        if (f.size > 20 * 1024 * 1024) {
            setError("File must be smaller than 20 MB.");
            return;
        }
        setError(null);
        setFile(f);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim()) return setError("Title is required.");
        if (!file) return setError("Please upload a PDF file.");
        const validSigners = signers.filter((s) => s.name.trim() && s.email.trim());
        if (validSigners.length === 0)
            return setError("At least one signer with name and email is required.");

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("title", title.trim());
            if (description.trim()) formData.append("description", description.trim());
            if (message.trim()) formData.append("message", message.trim());
            if (resolvedClientId) formData.append("clientId", resolvedClientId);
            formData.append("expiresInDays", String(expiresInDays));
            formData.append("signers", JSON.stringify(validSigners));

            const res = await fetch("/api/contracts", {
                method: "POST",
                credentials: "include",
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Server error (${res.status})`);
            }

            onCreated();
        } catch (err: any) {
            setError(err.message || "Failed to create contract. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <FileText className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">New Contract</h2>
                                <p className="text-xs text-gray-500">
                                    Upload a PDF and send for signatures via SignWell
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                        {/* Error */}
                        {error && (
                            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Title */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Contract Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Service Agreement — Acme Corp"
                                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Description <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Brief description of this contract..."
                                rows={2}
                                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            />
                        </div>

                        {/* Message to signers */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Message to Signers <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Hi, please review and sign the attached document..."
                                rows={2}
                                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            />
                        </div>

                        {/* PDF Upload */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                PDF Document <span className="text-red-500">*</span>
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="application/pdf"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            {file ? (
                                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="p-1.5 bg-green-100 rounded-md">
                                        <FileText className="h-4 w-4 text-green-700" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-green-800 truncate">{file.name}</p>
                                        <p className="text-xs text-green-600">
                                            {(file.size / 1024).toFixed(0)} KB
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFile(null)}
                                        className="p-1 hover:bg-green-200 rounded transition-colors text-green-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/30 transition-colors group"
                                >
                                    <Upload className="h-6 w-6 text-gray-400 group-hover:text-blue-500" />
                                    <span className="text-sm font-medium text-gray-500 group-hover:text-blue-600">
                                        Click to upload PDF
                                    </span>
                                    <span className="text-xs text-gray-400">Max 20 MB</span>
                                </button>
                            )}
                        </div>

                        {/* Expiry */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                Expires In (days)
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={365}
                                value={expiresInDays}
                                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                                className="w-32 px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Signers */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-semibold text-gray-700">
                                    Signers <span className="text-red-500">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={addSigner}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-50 rounded-md transition-colors"
                                >
                                    <UserPlus className="h-3.5 w-3.5" />
                                    Add Signer
                                </button>
                            </div>
                            <div className="space-y-2.5">
                                {signers.map((signer, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                            <input
                                                type="text"
                                                value={signer.name}
                                                onChange={(e) => updateSigner(index, "name", e.target.value)}
                                                placeholder="Full name"
                                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                            <input
                                                type="email"
                                                value={signer.email}
                                                onChange={(e) => updateSigner(index, "email", e.target.value)}
                                                placeholder="Email address"
                                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                        </div>
                                        {signers.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeSigner(index)}
                                                className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-md transition-colors flex-shrink-0"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </form>

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
                        <p className="text-xs text-gray-400">
                            Contract will be sent via SignWell for e-signatures
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form=""
                                disabled={submitting}
                                onClick={handleSubmit}
                                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Sending…
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" />
                                        Create &amp; Send
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}