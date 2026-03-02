"use client";

import React, { useState, useRef, useEffect } from "react";
import { Pen, Type, RotateCcw, Check } from "lucide-react";

interface SignatureCaptureProps {
    onCapture: (signatureDataUrl: string, type: "draw" | "type") => void;
    signerName: string;
}

export function SignatureCapture({ onCapture, signerName }: SignatureCaptureProps) {
    const [mode, setMode] = useState<"draw" | "type">("draw");
    const [typedName, setTypedName] = useState(signerName);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Set canvas resolution
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 2.5;
    }, [mode]);

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();

        if ("touches" in e) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top,
            };
        }
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    };

    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx) return;

        setIsDrawing(true);
        setHasDrawn(true);
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx) return;

        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const endDraw = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    };

    const getDrawnSignature = (): string | null => {
        const canvas = canvasRef.current;
        if (!canvas || !hasDrawn) return null;
        return canvas.toDataURL("image/png");
    };

    const getTypedSignature = (): string => {
        // Render typed name as image
        const canvas = document.createElement("canvas");
        canvas.width = 400;
        canvas.height = 120;
        const ctx = canvas.getContext("2d");
        if (!ctx) return "";

        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = "italic 36px 'Georgia', serif";
        ctx.fillStyle = "#1e293b";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);

        return canvas.toDataURL("image/png");
    };

    const handleConfirm = () => {
        if (mode === "draw") {
            const sig = getDrawnSignature();
            if (sig) onCapture(sig, "draw");
        } else {
            if (typedName.trim()) {
                const sig = getTypedSignature();
                onCapture(sig, "type");
            }
        }
    };

    const isValid = mode === "draw" ? hasDrawn : typedName.trim().length > 0;

    return (
        <div className="space-y-4">
            {/* Mode Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-lg">
                <button
                    onClick={() => setMode("draw")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${mode === "draw"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    <Pen className="h-4 w-4" />
                    Draw
                </button>
                <button
                    onClick={() => setMode("type")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${mode === "type"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    <Type className="h-4 w-4" />
                    Type
                </button>
            </div>

            {/* Signature Area */}
            {mode === "draw" ? (
                <div className="relative">
                    <canvas
                        ref={canvasRef}
                        className="w-full h-[140px] border-2 border-dashed border-gray-300 rounded-xl bg-white cursor-crosshair touch-none"
                        onMouseDown={startDraw}
                        onMouseMove={draw}
                        onMouseUp={endDraw}
                        onMouseLeave={endDraw}
                        onTouchStart={startDraw}
                        onTouchMove={draw}
                        onTouchEnd={endDraw}
                    />
                    <button
                        onClick={clearCanvas}
                        className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-white rounded-md border border-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <p className="text-center text-xs text-gray-400 mt-2">
                        Draw your signature above
                    </p>
                </div>
            ) : (
                <div>
                    <input
                        type="text"
                        value={typedName}
                        onChange={(e) => setTypedName(e.target.value)}
                        placeholder="Type your full name"
                        className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-center text-2xl focus:outline-none focus:border-blue-500 bg-white"
                        style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}
                    />
                    <p className="text-center text-xs text-gray-400 mt-2">
                        This will be used as your signature
                    </p>
                    {/* Preview */}
                    {typedName.trim() && (
                        <div className="mt-3 p-4 bg-gray-50 rounded-lg text-center">
                            <p className="text-xs text-gray-400 mb-1">Preview:</p>
                            <p
                                className="text-3xl text-gray-800"
                                style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}
                            >
                                {typedName}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Confirm Button */}
            <button
                onClick={handleConfirm}
                disabled={!isValid}
                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
                <Check className="h-4 w-4" />
                Apply Signature
            </button>
        </div>
    );
}
