"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    ArrowLeft,
    Save,
    Type,
    Trash2,
    Loader2,
    ZoomIn,
    ZoomOut,
    PenLine,
    User,
    Calendar,
    Mail,
    Building2,
    Briefcase,
    CheckSquare,
    ChevronDown,
    Settings,
    LayoutGrid,
} from "lucide-react";

// 🔥 NO react-pdf imports - using iframe instead

interface Annotation {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string;
    fieldName: string;
    assignedTo: string;
    required: boolean;
    placeholder?: string;
    page: number;
}

interface ContractEditorProps {
    contract: any;
    onBack: () => void;
}

const FIELD_CATEGORIES = [
    {
        name: "Signature fields",
        fields: [
            { type: "signature", label: "Signature", icon: PenLine },
            { type: "initials", label: "Initials", icon: PenLine },
        ],
    },
    {
        name: "Auto-fill fields",
        fields: [
            { type: "date_signed", label: "Date signed", icon: Calendar },
            { type: "full_name", label: "Full name", icon: User },
            { type: "email_address", label: "Email address", icon: Mail },
            { type: "company", label: "Company", icon: Building2 },
            { type: "title", label: "Title", icon: Briefcase },
        ],
    },
    {
        name: "Standard fields",
        fields: [
            { type: "text", label: "Textbox", icon: Type },
            { type: "checkbox", label: "Checkbox", icon: CheckSquare },
            { type: "dropdown", label: "Dropdown", icon: ChevronDown },
        ],
    },
];

export function ContractEditor({ contract, onBack }: ContractEditorProps) {
    const [annotations, setAnnotations] = useState<Annotation[]>(() => {
        if (contract.annotations && typeof contract.annotations === "string") {
            try {
                return JSON.parse(contract.annotations);
            } catch (e) {
                return [];
            }
        } else if (contract.annotations && Array.isArray(contract.annotations)) {
            return contract.annotations;
        }
        return [];
    });

    const [activeFieldType, setActiveFieldType] = useState<string | null>(null);
    const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
    const [activeSignerEmail, setActiveSignerEmail] = useState<string>(
        contract.signers?.[0]?.email || contract.createdBy?.email || "owner"
    );
    const [saving, setSaving] = useState(false);
    const [zoom, setZoom] = useState(100);
    const [pdfLoading, setPdfLoading] = useState(true);

    // Drag & Resize State
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0, annX: 0, annY: 0 });
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

    const pdfRef = useRef<HTMLDivElement>(null);

    const selectedAnnotation = annotations.find(a => a.id === selectedAnnotationId);

    const documentWidth = 800;

    const addAnnotation = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!activeFieldType) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        const fieldTypeInfo = FIELD_CATEGORIES.flatMap(c => c.fields).find(f => f.type === activeFieldType);

        const newAnnotation: Annotation = {
            id: `ann-${Date.now()}`,
            type: activeFieldType,
            x: Math.min(Math.max(x - 5, 0), 90),
            y: Math.min(Math.max(y - 1, 0), 96),
            width: activeFieldType === "signature" ? 20 : 12,
            height: activeFieldType === "signature" ? 4 : 2.5,
            fieldName: `${fieldTypeInfo?.label || "Field"} ${annotations.length + 1}`,
            assignedTo: activeSignerEmail,
            required: true,
            placeholder: fieldTypeInfo?.label || "",
            page: 0,
        };

        setAnnotations([...annotations, newAnnotation]);
        setSelectedAnnotationId(newAnnotation.id);
        setActiveFieldType(null);
    };

    const deleteSelected = useCallback(() => {
        if (selectedAnnotationId) {
            setAnnotations(annotations.filter((a) => a.id !== selectedAnnotationId));
            setSelectedAnnotationId(null);
        }
    }, [selectedAnnotationId, annotations]);

    const updateAnnotationProperty = (id: string, updates: Partial<Annotation>) => {
        setAnnotations(prev =>
            prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
        );
    };

    const handleMouseDown = (e: React.MouseEvent, ann: Annotation, mode: 'drag' | 'resize') => {
        e.stopPropagation();
        setSelectedAnnotationId(ann.id);

        if (mode === 'drag') {
            setIsDragging(true);
            setDragStart({ x: e.clientX, y: e.clientY, annX: ann.x, annY: ann.y });
        } else {
            setIsResizing(true);
            setResizeStart({ x: e.clientX, y: e.clientY, width: ann.width, height: ann.height });
        }
    };

    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        if (!selectedAnnotationId) return;

        if (isDragging) {
            const deltaX = ((e.clientX - dragStart.x) / (pdfRef.current?.getBoundingClientRect().width || 1)) * 100;
            const deltaY = ((e.clientY - dragStart.y) / (pdfRef.current?.getBoundingClientRect().height || 1)) * 100;

            updateAnnotationProperty(selectedAnnotationId, {
                x: Math.min(Math.max(dragStart.annX + deltaX, 0), 100),
                y: Math.min(Math.max(dragStart.annY + deltaY, 0), 100),
            });
        }

        if (isResizing) {
            const deltaX = ((e.clientX - resizeStart.x) / (pdfRef.current?.getBoundingClientRect().width || 1)) * 100;
            const deltaY = ((e.clientY - resizeStart.y) / (pdfRef.current?.getBoundingClientRect().height || 1)) * 100;

            updateAnnotationProperty(selectedAnnotationId, {
                width: Math.max(resizeStart.width + deltaX, 2),
                height: Math.max(resizeStart.height + deltaY, 0.5),
            });
        }
    }, [isDragging, isResizing, selectedAnnotationId, dragStart, resizeStart]);

    const handleGlobalMouseUp = useCallback(() => {
        setIsDragging(false);
        setIsResizing(false);
    }, []);

    useEffect(() => {
        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
        } else {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [isDragging, isResizing, handleGlobalMouseMove, handleGlobalMouseUp]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append("annotations", JSON.stringify(annotations));

            const res = await fetch(`/api/contracts/${contract.id}`, {
                method: "PUT",
                credentials: "include",
                body: formData,
            });

            if (res.ok) {
                alert("Contract fields updated successfully!");
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

    const getFieldColor = (assignedTo: string) => {
        const isOwner = assignedTo === contract.createdBy?.email || assignedTo === "owner";
        return isOwner ? "#3b82f6" : "#f97316";
    };

    return (
        <div className="flex flex-col h-screen bg-[#f8f9fa] overflow-hidden">
            {/* Tool Header */}
            <div className="flex items-center justify-between bg-white border-b border-gray-200 px-4 py-2 shrink-0 z-50 shadow-sm font-sans">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 text-gray-500" />
                    </button>
                    <div className="h-6 w-px bg-gray-200" />
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 leading-none">Prepare Contract</h2>
                        <p className="text-[10px] text-gray-500 mt-1">Place and assign fields to signers</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 border border-gray-200">
                        <button onClick={() => setZoom(Math.max(50, zoom - 10))} className="p-1 hover:bg-white rounded transition-all">
                            <ZoomOut className="h-4 w-4 text-gray-500" />
                        </button>
                        <span className="text-[10px] font-bold text-gray-600 w-10 text-center">{zoom}%</span>
                        <button onClick={() => setZoom(Math.min(200, zoom + 10))} className="p-1 hover:bg-white rounded transition-all">
                            <ZoomIn className="h-4 w-4 text-gray-500" />
                        </button>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-100"
                    >
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        Save Changes
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden font-sans">
                {/* Left Sidebar */}
                <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
                    <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <User className="h-3 w-3" />
                                Active Recipient
                            </label>
                            <div className="relative">
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs font-semibold appearance-none cursor-pointer focus:ring-2 focus:ring-blue-100 outline-none"
                                    value={activeSignerEmail}
                                    onChange={(e) => setActiveSignerEmail(e.target.value)}
                                >
                                    <optgroup label="You">
                                        <option value={contract.createdBy?.email || "owner"}>{contract.createdBy?.name || "Me"}</option>
                                    </optgroup>
                                    <optgroup label="Others">
                                        {contract.signers?.map((s: any) => (
                                            <option key={s.id} value={s.email}>{s.name} ({s.email})</option>
                                        ))}
                                    </optgroup>
                                </select>
                                <ChevronDown className="absolute right-2.5 top-3 h-3 w-3 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {FIELD_CATEGORIES.map((category) => (
                            <div key={category.name} className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{category.name}</label>
                                <div className="grid grid-cols-1 gap-1">
                                    {category.fields.map((field) => (
                                        <button
                                            key={field.type}
                                            onClick={() => setActiveFieldType(activeFieldType === field.type ? null : field.type)}
                                            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-all border ${activeFieldType === field.type ? "bg-blue-50 border-blue-300 text-blue-700 font-bold" : "bg-white border-transparent text-gray-600 hover:bg-gray-50"
                                                }`}
                                        >
                                            <field.icon className={`h-4 w-4 ${activeFieldType === field.type ? "text-blue-500" : "text-gray-400"}`} />
                                            {field.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Instructions */}
                        {activeFieldType && (
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-[11px] text-blue-700 font-medium">
                                    👆 Click anywhere on the document to place the field
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main PDF Workspace */}
                <div className="flex-1 overflow-auto bg-[#eef0f3] p-10 flex flex-col items-center custom-scrollbar">
                    <div
                        ref={pdfRef}
                        className="relative bg-white shadow-xl transition-all duration-200"
                        style={{
                            width: `${(documentWidth * zoom) / 100}px`,
                            minHeight: '1100px'
                        }}
                    >
                        {/* Loading indicator */}
                        {pdfLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-5">
                                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                                <p className="text-sm font-bold text-gray-500 mt-4">Loading document...</p>
                            </div>
                        )}

                        {/* PDF via iframe - NO react-pdf needed */}
                        <iframe
                            src={`/api/contracts/${contract.id}/preview`}
                            className="w-full border-0"
                            style={{
                                height: '1100px',
                                transform: `scale(${zoom / 100})`,
                                transformOrigin: 'top left',
                                width: `${100 * (100 / zoom)}%`,
                            }}
                            onLoad={() => setPdfLoading(false)}
                            title="Contract PDF"
                        />

                        {/* Click-to-add layer (Only active when a tool is selected) */}
                        <div
                            className={`absolute inset-0 z-10 ${activeFieldType ? 'cursor-crosshair bg-blue-500/5' : 'pointer-events-none'}`}
                            onClick={activeFieldType ? addAnnotation : undefined}
                        />

                        {/* Annotations Layer */}
                        <div className="absolute inset-0 z-20 pointer-events-none">
                            {annotations.map((ann) => {
                                const color = getFieldColor(ann.assignedTo);
                                const isSelected = selectedAnnotationId === ann.id;

                                return (
                                    <div
                                        key={ann.id}
                                        className={`absolute pointer-events-auto transition-all ${isSelected ? "z-30 ring-2 ring-white ring-offset-2 ring-offset-blue-500 shadow-lg" : "hover:shadow-md"
                                            }`}
                                        style={{
                                            left: `${ann.x}%`,
                                            top: `${ann.y}%`,
                                            width: `${ann.width}%`,
                                            height: `${ann.height}%`,
                                            cursor: isDragging ? 'grabbing' : 'grab',
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, ann, 'drag')}
                                    >
                                        <div
                                            className="w-full h-full flex flex-col items-center justify-center p-1 rounded border-2 relative overflow-hidden transition-colors"
                                            style={{
                                                backgroundColor: isSelected ? `${color}20` : `${color}10`,
                                                borderColor: color,
                                                borderStyle: 'dashed',
                                            }}
                                        >
                                            {/* Field Header / Label */}
                                            <div className="absolute top-0.5 left-1 flex items-center gap-1 opacity-80">
                                                {(() => {
                                                    const fieldInfo = FIELD_CATEGORIES.flatMap(c => c.fields).find(f => f.type === ann.type);
                                                    const IconComponent = fieldInfo?.icon;
                                                    return IconComponent ? <IconComponent className="h-2.5 w-2.5" style={{ color }} /> : null;
                                                })()}
                                                <span className="text-[9px] font-bold uppercase tracking-tight truncate" style={{ color }}>
                                                    {ann.fieldName || ann.type}
                                                </span>
                                            </div>

                                            {/* Placeholder Text */}
                                            <div className="mt-1 text-center">
                                                <span className="text-[11px] font-semibold truncate block px-1" style={{ color }}>
                                                    {ann.placeholder || "Click to sign"}
                                                </span>
                                            </div>

                                            {/* Selection UI */}
                                            {isSelected && (
                                                <>
                                                    {/* Resize Handle */}
                                                    <div
                                                        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-center justify-center bg-white rounded-tl border-l border-t"
                                                        style={{ borderColor: color }}
                                                        onMouseDown={(e) => handleMouseDown(e, ann, 'resize')}
                                                    >
                                                        <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                                                    </div>

                                                    {/* Delete Button */}
                                                    <div className="absolute -top-8 right-0 flex items-center gap-1 pointer-events-auto">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); deleteSelected(); }}
                                                            className="p-1.5 bg-white text-red-600 rounded-lg shadow-md border border-red-100 hover:bg-red-50 transition-colors"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Sidebar (Properties) */}
                <div className="w-72 bg-white border-l border-gray-200 flex flex-col shrink-0 shadow-xl overflow-y-auto custom-scrollbar">
                    {selectedAnnotation ? (
                        <div className="p-6 space-y-8">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <Settings className="h-4 w-4 text-gray-400" />
                                    Field Settings
                                </h3>
                                <button onClick={() => setSelectedAnnotationId(null)} className="p-1 hover:bg-gray-100 rounded">
                                    <ArrowLeft className="h-4 w-4 text-gray-400 rotate-180" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Field Label */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Field Identifier</label>
                                    <input
                                        type="text"
                                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                                        value={selectedAnnotation.fieldName}
                                        onChange={(e) => updateAnnotationProperty(selectedAnnotation.id, { fieldName: e.target.value })}
                                        placeholder="e.g. Signature_1"
                                    />
                                </div>

                                {/* Placeholder */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Placeholder Text</label>
                                    <input
                                        type="text"
                                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                                        value={selectedAnnotation.placeholder || ""}
                                        onChange={(e) => updateAnnotationProperty(selectedAnnotation.id, { placeholder: e.target.value })}
                                        placeholder="Display hint to signer"
                                    />
                                </div>

                                {/* Recipient */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assigned To</label>
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-xs font-semibold appearance-none cursor-pointer focus:ring-2 focus:ring-blue-100 outline-none"
                                        value={selectedAnnotation.assignedTo}
                                        onChange={(e) => updateAnnotationProperty(selectedAnnotation.id, { assignedTo: e.target.value })}
                                    >
                                        <option value={contract.createdBy?.email || "owner"}>Me (Blue)</option>
                                        {contract.signers?.map((s: any) => (
                                            <option key={s.id} value={s.email}>{s.name} (Orange)</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Required field switch */}
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <span className="text-xs font-bold text-gray-700">Required Field</span>
                                    <button
                                        onClick={() => updateAnnotationProperty(selectedAnnotation.id, { required: !selectedAnnotation.required })}
                                        className={`relative inline-flex h-5 w-10 cursor-pointer rounded-full transition-colors duration-200 ${selectedAnnotation.required ? 'bg-blue-600' : 'bg-gray-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 mt-0.5 ${selectedAnnotation.required ? 'translate-x-5' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {/* Delete button */}
                                <button
                                    onClick={deleteSelected}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-semibold transition-colors border border-red-200"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Delete Field
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full p-10 text-center space-y-4">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                                <LayoutGrid className="h-6 w-6 text-gray-300" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-900">Configure Fields</h4>
                                <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                                    Select a field type from the left panel, then click on the document to place it. Click any placed field to edit its properties.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 10px; height: 10px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; border: 3px solid #eef0f3; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </div>
    );
}