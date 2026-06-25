"use client";

import React, { useState, useRef } from "react";
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
    const resolvedClientId = clientId || defaultClientId;
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [message, setMessage] = useState("");
    const [expiresInDays, setExpiresInDays] = useState(30);
    const [signers, setSigners] = useState<Signer[]>(
        defaultSigners && defaultSigners.length > 0
            ? defaultSigners
            : [{ name: "", email: "" }]
    );
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-50 rounded-lg">
                            <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                        New Contract
                    </DialogTitle>
                    <DialogDescription>
                        Upload a PDF and send for e-signatures via SignWell
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 space-y-4 py-2">
                    {/* Error */}
                    {error && (
                        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Title */}
                    <div className="space-y-1.5">
                        <Label htmlFor="contract-title">
                            Contract Title <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="contract-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Service Agreement — Acme Corp"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <Label htmlFor="contract-description">
                            Description <span className="text-gray-400 font-normal text-xs">(optional)</span>
                        </Label>
                        <Textarea
                            id="contract-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this contract..."
                            rows={2}
                            className="resize-none"
                        />
                    </div>

                    {/* Message to signers */}
                    <div className="space-y-1.5">
                        <Label htmlFor="contract-message">
                            Message to Signers <span className="text-gray-400 font-normal text-xs">(optional)</span>
                        </Label>
                        <Textarea
                            id="contract-message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Hi, please review and sign the attached document..."
                            rows={2}
                            className="resize-none"
                        />
                    </div>

                    {/* PDF Upload */}
                    <div className="space-y-1.5">
                        <Label>
                            PDF Document <span className="text-red-500">*</span>
                        </Label>
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
                                    onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
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
                    <div className="space-y-1.5">
                        <Label htmlFor="contract-expiry" className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                            Expires In (days)
                        </Label>
                        <Input
                            id="contract-expiry"
                            type="number"
                            min={1}
                            max={365}
                            value={expiresInDays}
                            onChange={(e) => setExpiresInDays(Number(e.target.value))}
                            className="w-32"
                        />
                    </div>

                    {/* Signers */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>
                                Signers <span className="text-red-500">*</span>
                            </Label>
                            <button
                                type="button"
                                onClick={addSigner}
                                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-50 rounded-md transition-colors"
                            >
                                <UserPlus className="h-3.5 w-3.5" />
                                Add Signer
                            </button>
                        </div>
                        <div className="space-y-2">
                            {signers.map((signer, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                        <Input
                                            value={signer.name}
                                            onChange={(e) => updateSigner(index, "name", e.target.value)}
                                            placeholder="Full name"
                                        />
                                        <Input
                                            type="email"
                                            value={signer.email}
                                            onChange={(e) => updateSigner(index, "email", e.target.value)}
                                            placeholder="Email address"
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

                <DialogFooter className="pt-4 border-t mt-2">
                    <p className="text-xs text-gray-400 mr-auto">
                        Sent via SignWell for e-signatures
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="gap-2"
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
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}