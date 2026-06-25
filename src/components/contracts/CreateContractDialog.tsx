"use client";

import React, { useState } from "react";
import { X, Upload, Plus, Trash2, Loader2, FileText, UserPlus } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

interface Signer {
  name: string;
  email: string;
}

interface CreateContractDialogProps {
  onClose: () => void;
  onCreated: () => void;
  defaultClientId?: string;
  defaultSigners?: Signer[];
}

export function CreateContractDialog({
  onClose,
  onCreated,
  defaultClientId,
  defaultSigners,
}: CreateContractDialogProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [signers, setSigners] = useState<Signer[]>(
    defaultSigners || [{ name: "", email: "" }]
  );
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const addMeAsSigner = () => {
    if (!user) return;
    const already = signers.some((s) => s.email.toLowerCase() === user.email.toLowerCase());
    if (already) return;
    const emptyIndex = signers.findIndex((s) => !s.name.trim() && !s.email.trim());
    if (emptyIndex >= 0) {
      const updated = [...signers];
      updated[emptyIndex] = { name: user.name || "", email: user.email };
      setSigners(updated);
    } else {
      setSigners([...signers, { name: user.name || "", email: user.email }]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type === "application/pdf") {
      setFile(f);
      setError("");
    } else if (f) {
      setError("Only PDF files are supported");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type === "application/pdf") {
      setFile(f);
      setError("");
    } else {
      setError("Only PDF files are supported");
    }
  };

  const handleSubmit = async () => {
    setError("");

    if (!title.trim()) { setError("Title is required"); return; }
    if (!file) { setError("Please upload a PDF file"); return; }
    if (signers.some((s) => !s.name.trim() || !s.email.trim())) {
      setError("All signers need a name and email");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim());
      if (description.trim()) formData.append("description", description.trim());
      if (message.trim()) formData.append("message", message.trim());
      if (defaultClientId) formData.append("clientId", defaultClientId);
      formData.append("expiresInDays", String(expiresInDays));
      formData.append("signers", JSON.stringify(signers));

      const res = await fetch("/api/contracts", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create contract");

      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">New Contract</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contract Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Service Agreement — Combatica"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this contract"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* PDF Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contract PDF <span className="text-red-500">*</span>
            </label>
            {file ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-900 truncate">{file.name}</p>
                  <p className="text-xs text-blue-600">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="p-1 hover:bg-blue-100 rounded transition"
                >
                  <X className="h-4 w-4 text-blue-500" />
                </button>
              </div>
            ) : (
              <label
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition ${
                  dragOver
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <Upload className="h-7 w-7 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 font-medium">Drop PDF here or click to browse</p>
                <p className="text-xs text-gray-400 mt-0.5">PDF files only</p>
                <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFileChange} />
              </label>
            )}
          </div>

          {/* Signers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Signers <span className="text-red-500">*</span>
              </label>
              <button
                onClick={addMeAsSigner}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <UserPlus className="h-3.5 w-3.5" /> Add me
              </button>
            </div>
            <div className="space-y-2">
              {signers.map((signer, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={signer.name}
                    onChange={(e) => {
                      const updated = [...signers];
                      updated[i] = { ...updated[i], name: e.target.value };
                      setSigners(updated);
                    }}
                    placeholder="Full name"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="email"
                    value={signer.email}
                    onChange={(e) => {
                      const updated = [...signers];
                      updated[i] = { ...updated[i], email: e.target.value };
                      setSigners(updated);
                    }}
                    placeholder="Email address"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {signers.length > 1 && (
                    <button
                      onClick={() => setSigners(signers.filter((_, j) => j !== i))}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setSigners([...signers, { name: "", email: "" }])}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add signer
            </button>
          </div>

          {/* Message to signers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message to signers <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="Any specific instructions for signers..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Expires */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Expires in</label>
            <input
              type="number"
              min={1}
              max={365}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value) || 30)}
              className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500">days</span>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
            <p className="font-medium mb-0.5">Powered by SignWell</p>
            <p>The contract will be sent to signers via email. They can also sign directly inside the E8 portal.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
            ) : (
              "Send for Signing"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
