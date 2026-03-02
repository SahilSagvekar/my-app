"use client";

import React, { useState } from "react";
import { X, Upload, Plus, Trash2, Loader2, FileText, UserPlus } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

interface Signer {
    name: string;
    email: string;
    role: string;
}

interface CreateContractDialogProps {
    onClose: () => void;
    onCreated: () => void;
}

export function CreateContractDialog({ onClose, onCreated }: CreateContractDialogProps) {
    const { user } = useAuth();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [message, setMessage] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [signers, setSigners] = useState<Signer[]>([{ name: "", email: "", role: "signer" }]);
    const [expiresAt, setExpiresAt] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [dragOver, setDragOver] = useState(false);

    const isAlreadyAdded = signers.some(
        (s) => s.email.toLowerCase() === (user?.email || "").toLowerCase()
    );

    const addMeAsSigner = () => {
        if (!user || isAlreadyAdded) return;
        // Replace first empty signer row or add a new one
        const emptyIndex = signers.findIndex((s) => !s.name.trim() && !s.email.trim());
        if (emptyIndex >= 0) {
            const updated = [...signers];
            updated[emptyIndex] = { name: user.name || "", email: user.email, role: "signer" };
            setSigners(updated);
        } else {
            setSigners([...signers, { name: user.name || "", email: user.email, role: "signer" }]);
        }
    };

    const addSigner = () => {
        setSigners([...signers, { name: "", email: "", role: "signer" }]);
    };

    const removeSigner = (index: number) => {
        if (signers.length > 1) {
            setSigners(signers.filter((_, i) => i !== index));
        }
    };

    const updateSigner = (index: number, field: keyof Signer, value: string) => {
        const updated = [...signers];
        updated[index] = { ...updated[index], [field]: value };
        setSigners(updated);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f && f.type === "application/pdf") {
            setFile(f);
            setError("");
        } else {
            setError("Please select a PDF file");
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && f.type === "application/pdf") {
            setFile(f);
            setError("");
        } else {
            setError("Please drop a PDF file");
        }
    };

    const handleSubmit = async (asDraft: boolean) => {
        if (!title.trim()) {
            setError("Title is required");
            return;
        }
        if (!file) {
            setError("Please upload a PDF file");
            return;
        }

        const validSigners = signers.filter((s) => s.name.trim() && s.email.trim());
        if (!asDraft && validSigners.length === 0) {
            setError("At least one signer is required to send");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("title", title.trim());
            if (description.trim()) formData.append("description", description.trim());
            if (message.trim()) formData.append("message", message.trim());
            if (expiresAt) formData.append("expiresAt", expiresAt);
            formData.append("signers", JSON.stringify(validSigners));

            const res = await fetch("/api/contracts", {
                method: "POST",
                credentials: "include",
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to create contract");
            }

            const contract = await res.json();

            if (!asDraft) {
                // Send immediately
                await fetch(`/api/contracts/${contract.id}/send`, {
                    method: "POST",
                    credentials: "include",
                });
            }

            onCreated();
        } catch (err: any) {
            setError(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">New Contract</h2>
                        <p className="text-sm text-gray-500 mt-0.5">Upload a PDF and add signers</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="h-5 w-5 text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                            {error}
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Contract Title *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Service Agreement - Client Name"
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this contract..."
                            rows={2}
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                    </div>

                    {/* File Upload */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Contract PDF *
                        </label>
                        <div
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver
                                ? "border-blue-400 bg-blue-50"
                                : file
                                    ? "border-green-300 bg-green-50"
                                    : "border-gray-200 hover:border-gray-300"
                                }`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragOver(true);
                            }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                        >
                            {file ? (
                                <div className="flex items-center justify-center gap-3">
                                    <FileText className="h-8 w-8 text-green-500" />
                                    <div className="text-left">
                                        <p className="font-semibold text-gray-900 text-sm">{file.name}</p>
                                        <p className="text-xs text-gray-500">
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setFile(null)}
                                        className="p-1.5 hover:bg-red-50 rounded-lg"
                                    >
                                        <Trash2 className="h-4 w-4 text-red-400" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <Upload className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-sm text-gray-600 font-medium">
                                        Drag & drop your PDF here, or{" "}
                                        <label className="text-blue-600 cursor-pointer hover:underline">
                                            browse
                                            <input
                                                type="file"
                                                accept=".pdf"
                                                onChange={handleFileChange}
                                                className="hidden"
                                            />
                                        </label>
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">PDF files only</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Signers */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-semibold text-gray-700">Signers</label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={addMeAsSigner}
                                    disabled={isAlreadyAdded}
                                    className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${isAlreadyAdded
                                            ? "bg-green-50 text-green-600 cursor-default"
                                            : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                                        }`}
                                    title={isAlreadyAdded ? "You're already added as a signer" : "Add yourself as a signer"}
                                >
                                    <UserPlus className="h-3.5 w-3.5" />
                                    {isAlreadyAdded ? "Me ✓" : "Add Me"}
                                </button>
                                <button
                                    onClick={addSigner}
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Signer
                                </button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {signers.map((signer, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100"
                                >
                                    <input
                                        type="text"
                                        value={signer.name}
                                        onChange={(e) => updateSigner(index, "name", e.target.value)}
                                        placeholder="Full name"
                                        className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    />
                                    <input
                                        type="email"
                                        value={signer.email}
                                        onChange={(e) => updateSigner(index, "email", e.target.value)}
                                        placeholder="Email address"
                                        className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    />
                                    {signers.length > 1 && (
                                        <button
                                            onClick={() => removeSigner(index)}
                                            className="p-1.5 hover:bg-red-50 rounded-md"
                                        >
                                            <Trash2 className="h-4 w-4 text-red-400" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Message */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Message to Signers
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Optional message included in the signing invitation email..."
                            rows={2}
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                    </div>

                    {/* Expiration */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Expiration Date (optional)
                        </label>
                        <input
                            type="date"
                            value={expiresAt}
                            onChange={(e) => setExpiresAt(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => handleSubmit(true)}
                        disabled={loading}
                        className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save as Draft"}
                    </button>
                    <button
                        onClick={() => handleSubmit(false)}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                <Upload className="h-4 w-4" />
                                Create & Send
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
