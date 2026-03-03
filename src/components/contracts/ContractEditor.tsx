"use client";

import React, { useState, useRef, useCallback } from "react";
import {
    ArrowLeft,
    Save,
    RotateCcw,
    Type,
    Square,
    Trash2,
    Loader2,
    ZoomIn,
    ZoomOut,
    MousePointer,
} from "lucide-react";

interface Annotation {
    id: string;
    type: "text" | "rect" | "signature-field";
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string;
    color?: string;
    page: number;
}

interface ContractEditorProps {
    contractId: string;
    pdfUrl: string;
    onBack: () => void;
}

export function ContractEditor({ contractId, pdfUrl, onBack }: ContractEditorProps) {
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [activeTool, setActiveTool] = useState<"select" | "text" | "rect" | "signature-field">("select");
    const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [zoom, setZoom] = useState(100);
    const containerRef = useRef<HTMLDivElement>(null);

    const addAnnotation = (e: React.MouseEvent<HTMLDivElement>) => {
        if (activeTool === "select") return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        const newAnnotation: Annotation = {
            id: `ann-${Date.now()}`,
            type: activeTool,
            x,
            y,
            width: activeTool === "text" ? 20 : 25,
            height: activeTool === "text" ? 4 : activeTool === "signature-field" ? 8 : 5,
            text: activeTool === "text" ? "Click to edit text" : undefined,
            color: activeTool === "signature-field" ? "#3b82f6" : "#ef4444",
            page: 0,
        };

        setAnnotations([...annotations, newAnnotation]);
        setSelectedAnnotation(newAnnotation.id);
        setActiveTool("select");
    };

    const deleteSelected = () => {
        if (selectedAnnotation) {
            setAnnotations(annotations.filter((a) => a.id !== selectedAnnotation));
            setSelectedAnnotation(null);
        }
    };

    const updateAnnotationText = (id: string, text: string) => {
        setAnnotations(
            annotations.map((a) => (a.id === id ? { ...a, text } : a))
        );
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Download the current PDF via our proxy to avoid CORS issues
            const response = await fetch(`/api/contracts/${contractId}/preview`);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append("file", blob, "edited-contract.pdf");
            formData.append("annotations", JSON.stringify(annotations));

            const res = await fetch(`/api/contracts/${contractId}`, {
                method: "PUT",
                credentials: "include",
                body: formData,
            });

            if (res.ok) {
                alert("Contract saved successfully!");
                onBack();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to save");
            }
        } catch (err) {
            console.error("Save failed:", err);
            alert("Failed to save contract");
        } finally {
            setSaving(false);
        }
    };

    const tools = [
        { id: "select" as const, icon: MousePointer, label: "Select" },
        { id: "text" as const, icon: Type, label: "Add Text" },
        { id: "rect" as const, icon: Square, label: "Highlight" },
        { id: "signature-field" as const, icon: Square, label: "Signature Field" },
    ];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 text-gray-500" />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Edit Contract</h2>
                        <p className="text-xs text-gray-500">
                            Add text, highlights, and signature fields
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setAnnotations([])}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Reset
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Save Changes
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex items-center gap-1 border-r border-gray-200 pr-3 mr-1">
                    {tools.map((tool) => {
                        const Icon = tool.icon;
                        return (
                            <button
                                key={tool.id}
                                onClick={() => setActiveTool(tool.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTool === tool.id
                                    ? "bg-blue-100 text-blue-700 shadow-sm"
                                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                    }`}
                                title={tool.label}
                            >
                                <Icon className="h-4 w-4" />
                                <span className="hidden sm:inline">{tool.label}</span>
                            </button>
                        );
                    })}
                </div>

                {selectedAnnotation && (
                    <button
                        onClick={deleteSelected}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete
                    </button>
                )}

                <div className="flex items-center gap-1 ml-auto border-l border-gray-200 pl-3">
                    <button
                        onClick={() => setZoom(Math.max(50, zoom - 10))}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <ZoomOut className="h-4 w-4 text-gray-500" />
                    </button>
                    <span className="text-xs text-gray-500 font-medium w-10 text-center">
                        {zoom}%
                    </span>
                    <button
                        onClick={() => setZoom(Math.min(200, zoom + 10))}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <ZoomIn className="h-4 w-4 text-gray-500" />
                    </button>
                </div>
            </div>

            {/* PDF with Overlay */}
            <div className="bg-gray-100 rounded-xl border border-gray-200 p-6 overflow-auto">
                <div
                    ref={containerRef}
                    className="relative mx-auto bg-white shadow-lg rounded-lg overflow-hidden"
                    style={{ width: `${zoom}%`, maxWidth: "1000px" }}
                    onClick={addAnnotation}
                >
                    <iframe
                        src={`/api/contracts/${contractId}/preview#toolbar=0`}
                        className="w-full pointer-events-none"
                        style={{ height: "800px" }}
                        title="Contract PDF"
                    />

                    {/* Annotation Overlay */}
                    <div className="absolute inset-0">
                        {annotations.map((ann) => (
                            <div
                                key={ann.id}
                                className={`absolute cursor-pointer transition-all ${selectedAnnotation === ann.id
                                    ? "ring-2 ring-blue-500 ring-offset-1"
                                    : ""
                                    }`}
                                style={{
                                    left: `${ann.x}%`,
                                    top: `${ann.y}%`,
                                    width: `${ann.width}%`,
                                    height: `${ann.height}%`,
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAnnotation(ann.id);
                                }}
                            >
                                {ann.type === "text" && (
                                    <div
                                        className="w-full h-full bg-yellow-100/80 border border-yellow-300 rounded p-1 text-xs"
                                        suppressContentEditableWarning
                                        contentEditable
                                        onBlur={(e) =>
                                            updateAnnotationText(ann.id, e.currentTarget.textContent || "")
                                        }
                                    >
                                        {ann.text}
                                    </div>
                                )}
                                {ann.type === "rect" && (
                                    <div className="w-full h-full bg-red-200/30 border-2 border-red-400 rounded" />
                                )}
                                {ann.type === "signature-field" && (
                                    <div className="w-full h-full border-2 border-dashed border-blue-500 bg-blue-50/40 rounded flex items-center justify-center">
                                        <span className="text-[10px] text-blue-600 font-semibold">
                                            ✍️ Sign Here
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Info Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <div className="text-amber-500 mt-0.5">💡</div>
                <div className="text-sm text-amber-800">
                    <p className="font-semibold">Editor Tips</p>
                    <ul className="mt-1 space-y-0.5 text-amber-700 text-xs">
                        <li>• Select a tool from the toolbar, then click on the document to place it</li>
                        <li>• Click on placed items to select them, then use Delete to remove</li>
                        <li>• Text fields are editable — click on them to change the content</li>
                        <li>• Signature Fields mark where signers should place their signature</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
