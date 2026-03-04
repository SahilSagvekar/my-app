"use client";

import React, { useState } from "react";
import { Loader2, PenLine } from "lucide-react";

interface Annotation {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    required?: boolean;
    placeholder?: string;
    fieldName?: string;
    value?: any;
    assignedTo?: string;
    pageNumber?: number;
}

interface SigningPDFViewerProps {
    pdfUrl: string;
    annotations: Annotation[];
    filledValues: Record<string, any>;
    onFieldFill: (id: string, value: any) => void;
    onSignatureClick: (fieldId?: string) => void;
    signerName: string;
    zoom: number;
}

/**
 * 🚀 Robust PDF Viewer for Next.js 15
 * 
 * Avoids 'Object.defineProperty' and 'pdfjs' crashes by using a stable <iframe> + transform: scale() 
 * approach. This is 100% reliable as it doesn't load complex PDF logic into the Main Thread.
 */
export default function SigningPDFViewer(props: SigningPDFViewerProps) {
    const {
        pdfUrl,
        annotations,
        filledValues,
        onFieldFill,
        onSignatureClick,
        signerName,
        zoom,
    } = props;

    const [loading, setLoading] = useState(true);
    const documentWidth = 800; // Standard A4 width base

    return (
        <div
            className="flex flex-col items-center"
            style={{
                /* Reserve the scaled height so the scroll container knows how tall the content is */
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
                width: `${documentWidth}px`,
                marginBottom: `${(1131 * (zoom / 100)) - 1131}px` // Scale height compensation
            }}
        >
            <div
                className="relative bg-white shadow-2xl overflow-hidden"
                style={{
                    width: `${documentWidth}px`,
                    height: '1131px', // Standard A4 height @ 96dpi
                }}
            >
                {/* PDF Loading Indicator */}
                {loading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                        <p className="text-gray-400 font-bold mt-4">Rendering document...</p>
                    </div>
                )}

                {/* PDF via iframe — Rock Solid Browser Native Rendering */}
                <iframe
                    src={pdfUrl}
                    className="w-full h-full border-none"
                    onLoad={() => setLoading(false)}
                    title="Contract PDF Viewer"
                />

                {/* Annotation Overlay Layer — Interactive fields scale with the container */}
                <div className="absolute inset-0 z-10 pointer-events-none">
                    {annotations.map((ann) => {
                        const isFilled = !!filledValues[ann.id];
                        const isUnfilledRequired = ann.required && !isFilled;

                        return (
                            <div
                                key={ann.id}
                                className="absolute pointer-events-auto cursor-pointer transition-shadow"
                                style={{
                                    left: `${ann.x}%`,
                                    top: `${ann.y}%`,
                                    width: `${ann.width}%`,
                                    height: `${ann.height}%`,
                                }}
                                onClick={() => {
                                    if (ann.type === 'signature' || ann.type === 'initials') {
                                        onSignatureClick(ann.id);
                                    }
                                }}
                            >
                                <div
                                    className={`w-full h-full flex flex-col items-center justify-center p-1 rounded-sm border-2 transition-all ${isFilled
                                            ? "bg-white border-green-500 shadow-sm"
                                            : isUnfilledRequired
                                                ? "bg-indigo-50 border-indigo-400 hover:bg-indigo-100 hover:border-indigo-500 shadow-md"
                                                : "bg-indigo-50/50 border-indigo-300 hover:bg-indigo-50 hover:border-indigo-400 shadow-sm"
                                        }`}
                                >
                                    {isUnfilledRequired && (
                                        <div className="absolute top-0 right-1 text-[8px] font-black text-indigo-600 bg-indigo-100 px-1.5 rounded-bl uppercase">REQUIRED</div>
                                    )}

                                    <div className="flex items-center gap-1.5 px-2 w-full">
                                        {ann.type === 'signature' || ann.type === 'initials' ? (
                                            isFilled ? (
                                                <div className="flex flex-col items-center w-full">
                                                    <span className="text-[14px] font-serif italic text-indigo-800 leading-tight">
                                                        {signerName}
                                                    </span>
                                                    <div className="h-[1px] w-full bg-indigo-800 mt-0.5 opacity-30" />
                                                    <span className="text-[7px] text-gray-400 font-mono mt-0.5">Signed by {signerName}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <PenLine className="h-4 w-4 text-indigo-400" />
                                                    <span className="text-[11px] font-black text-indigo-600 tracking-tight">Click to Sign</span>
                                                </div>
                                            )
                                        ) : ann.type === 'checkbox' ? (
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 accent-indigo-500 rounded border-gray-300 pointer-events-auto cursor-pointer"
                                                checked={!!filledValues[ann.id]}
                                                onChange={(e) => onFieldFill(ann.id, e.target.checked)}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                placeholder={ann.placeholder || ann.fieldName || ann.type}
                                                className="w-full bg-transparent border-none text-[12px] font-bold outline-none text-center placeholder:text-indigo-300 pointer-events-auto text-gray-800"
                                                value={filledValues[ann.id] || ""}
                                                onChange={(e) => onFieldFill(ann.id, e.target.value)}
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
    );
}
