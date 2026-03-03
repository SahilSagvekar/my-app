"use client";

import React, { useState, useEffect } from "react";
import {
    X, Upload, Plus, Trash2, Loader2, FileText, UserPlus,
    CheckCircle2, Calendar, Building2
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

interface Signer {
    name: string;
    email: string;
    role: string;
}

interface UploadCompletedContractDialogProps {
    onClose: () => void;
    onCreated: () => void;
}

export function UploadCompletedContractDialog({ onClose, onCreated }: UploadCompletedContractDialogProps) {
    const { user } = useAuth();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [signers, setSigners] = useState<Signer[]>([{ name: "", email: "", role: "signer" }]);
    const [signedDate, setSignedDate] = useState(new Date().toISOString().split("T")[0]);
    const [clientId, setClientId] = useState("");
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [dragOver, setDragOver] = useState(false);

    // Fetch clients for dropdown
    useEffect(() => {
        const fetchClients = async () => {
            try {
                const res = await fetch("/api/clients", { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    setClients(Array.isArray(data) ? data : data.clients || []);
                }
            } catch (err) {
                console.error("Failed to fetch clients:", err);
            }
        };
        fetchClients();
    }, []);

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

    const handleSubmit = async () => {
        if (!title.trim()) {
            setError("Title is required");
            return;
        }
        if (!file) {
            setError("Please upload the signed PDF");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("title", title.trim());
            if (description.trim()) formData.append("description", description.trim());
            if (clientId) formData.append("clientId", clientId);
            if (signedDate) formData.append("signedDate", signedDate);

            const validSigners = signers.filter((s) => s.name.trim() && s.email.trim());
            if (validSigners.length > 0) {
                formData.append("signers", JSON.stringify(validSigners));
            }

            const res = await fetch("/api/contracts/upload-completed", {
                method: "POST",
                credentials: "include",
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to upload document");
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
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Upload Signed Document</h2>
                            <p className="text-sm text-gray-500 mt-0.5">Upload an already-signed contract for record keeping</p>
                        </div>
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
                            Document Title *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Service Agreement - Client Name (Signed)"
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                    </div>

                    {/* Client Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            <Building2 className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5 text-gray-400" />
                            Link to Client
                        </label>
                        <select
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none bg-white cursor-pointer"
                        >
                            <option value="">— Select a client (optional) —</option>
                            {clients.map((client: any) => (
                                <option key={client.id} value={client.id}>
                                    {client.companyName || client.name} {client.email ? `(${client.email})` : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this document..."
                            rows={2}
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                        />
                    </div>

                    {/* File Upload */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Signed PDF *
                        </label>
                        <div
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver
                                ? "border-green-400 bg-green-50"
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
                                        Drag & drop the signed PDF here, or{" "}
                                        <label className="text-green-600 cursor-pointer hover:underline">
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

                    {/* Signed Date */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            <Calendar className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5 text-gray-400" />
                            Date Signed
                        </label>
                        <input
                            type="date"
                            value={signedDate}
                            onChange={(e) => setSignedDate(e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                    </div>

                    {/* Signers (for record-keeping) */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-semibold text-gray-700">
                                Signers <span className="font-normal text-gray-400">(for records)</span>
                            </label>
                            <button
                                onClick={addSigner}
                                className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add Signer
                            </button>
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
                                        className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                    />
                                    <input
                                        type="email"
                                        value={signer.email}
                                        onChange={(e) => updateSigner(index, "email", e.target.value)}
                                        placeholder="Email address"
                                        className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
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
                        <p className="text-[11px] text-gray-400 mt-2">
                            These signers will be shown as having signed on the recorded date above.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                Upload as Completed
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
