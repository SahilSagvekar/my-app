// src/components/client/ClientFeedbackWidget.tsx
//
// Dead-simple "Report a Problem" button, shown on every portal (client,
// editor, admin, etc). One tap: auto-captures a screenshot of the current
// screen, lets them type an optional note, and emails it straight to us.
// No categories, no priority pickers, nothing to configure — nothing
// saved in the app.
//
// Two capture modes: full screen (default, captured immediately on open)
// and area-select (drag a box over the already-captured full screenshot,
// cropped client-side via canvas — no re-capture, no server involvement).

"use client";

import { useRef, useState } from "react";
import { Camera, Crop, Maximize2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_SELECTION_PX = 10;

export function ClientFeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [croppedScreenshot, setCroppedScreenshot] = useState<string | null>(null);
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [dragRect, setDragRect] = useState<Rect | null>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const finalScreenshot = croppedScreenshot ?? screenshot;

  const handleOpen = async () => {
    setIsOpen(true);
    setIsCapturing(true);
    setScreenshot(null);
    setCroppedScreenshot(null);
    setIsSelectingArea(false);
    setDragRect(null);

    try {
      // Loaded dynamically so it never affects initial page load weight —
      // it's only needed the moment someone taps the button.
      // Using modern-screenshot rather than html2canvas: html2canvas
      // re-parses the page's raw CSS text to replicate it, and chokes
      // silently on modern syntax this app's Tailwind v4 setup uses
      // (oklch(), @property, @layer, etc.) — producing a fully unstyled
      // capture instead of erroring. modern-screenshot instead reads each
      // element's already-resolved computed style from the browser itself
      // and renders via an SVG foreignObject, so it can't hit that failure
      // mode, and it degrades a failed cross-origin image (e.g. an
      // R2-hosted thumbnail without CORS headers) to a placeholder instead
      // of breaking the whole capture.
      const { domToJpeg } = await import("modern-screenshot");

      // Capture only what's currently visible, not the full scrollable page —
      // a full-page capture of a long dashboard can run several MB and blow
      // past server body-size limits. A capped, viewport-only JPEG is plenty
      // for a bug report and keeps the payload small and fast to send.
      const dataUrl = await domToJpeg(document.body, {
        quality: 0.7,
        backgroundColor: "#ffffff",
        // Capped at 1: this is a bug-report thumbnail, not a print asset —
        // going higher roughly quadruples canvas rasterization cost for no
        // visible benefit at the JPEG quality/size we send.
        scale: 1,
        width: window.innerWidth,
        height: window.innerHeight,
        // Bug-report screenshots don't need pixel-exact type. Font embedding
        // was the single biggest lag source: it walks every font-family found
        // in the DOM and fetches + base64-encodes each weight/variant on the
        // main thread before the capture can even start.
        font: false,
        // Cap how long a single stuck image/video load can stall the capture.
        timeout: 4000,
        filter: (node) => {
          if (node instanceof Element) {
            if (node.hasAttribute("data-feedback-widget-ignore")) return false;
            // Video/iframe embeds (e.g. YouTube Studio) are expensive to
            // decode/clone and add nothing readable to a bug screenshot.
            const tag = node.tagName;
            if (tag === "VIDEO" || tag === "IFRAME") return false;
          }
          return true;
        },
      });
      setScreenshot(dataUrl);
    } catch (err) {
      console.error("Feedback screenshot capture failed:", err);
      toast.error("Couldn't grab a screenshot, but you can still send a note.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleClose = () => {
    if (isSending) return;
    setIsOpen(false);
    setScreenshot(null);
    setCroppedScreenshot(null);
    setIsSelectingArea(false);
    setDragRect(null);
    setMessage("");
  };

  const handleEnterSelectArea = () => {
    setDragRect(null);
    setIsSelectingArea(true);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - container.left;
    const y = e.clientY - container.top;
    dragStart.current = { x, y };
    setDragRect({ x, y, w: 0, h: 0 });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    const container = e.currentTarget.getBoundingClientRect();
    const curX = Math.min(Math.max(e.clientX - container.left, 0), container.width);
    const curY = Math.min(Math.max(e.clientY - container.top, 0), container.height);
    const { x: startX, y: startY } = dragStart.current;
    setDragRect({
      x: Math.min(startX, curX),
      y: Math.min(startY, curY),
      w: Math.abs(curX - startX),
      h: Math.abs(curY - startY),
    });
  };

  const handlePointerUp = () => {
    dragStart.current = null;
  };

  const handleCancelSelectArea = () => {
    setIsSelectingArea(false);
    setDragRect(null);
  };

  const handleConfirmSelectArea = () => {
    const img = imgRef.current;
    if (!img || !dragRect || dragRect.w < MIN_SELECTION_PX || dragRect.h < MIN_SELECTION_PX) {
      toast.error("Drag a bigger area to select.");
      return;
    }

    // Displayed image size can differ from its captured pixel resolution
    // (it's shown scaled to fit the modal) — scale the drag rect from
    // displayed coordinates back to the image's natural pixel coordinates
    // before cropping.
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;

    const canvas = document.createElement("canvas");
    canvas.width = dragRect.w * scaleX;
    canvas.height = dragRect.h * scaleY;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      img,
      dragRect.x * scaleX,
      dragRect.y * scaleY,
      dragRect.w * scaleX,
      dragRect.h * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    setCroppedScreenshot(canvas.toDataURL("image/jpeg", 0.7));
    setIsSelectingArea(false);
    setDragRect(null);
  };

  const handleUseFullScreen = () => {
    setCroppedScreenshot(null);
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      const res = await fetch("/api/client/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screenshot: finalScreenshot,
          message,
          pageUrl: typeof window !== "undefined" ? window.location.href : "",
        }),
      });
      if (!res.ok) throw new Error("Failed to send feedback");

      toast.success("Thanks! We've got it and will take a look.");
      setIsOpen(false);
      setScreenshot(null);
      setCroppedScreenshot(null);
      setMessage("");
    } catch (err) {
      console.error("Failed to send feedback:", err);
      toast.error("Couldn't send that — please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Floating trigger — always visible, bottom-right, every page */}
      <button
        type="button"
        data-feedback-widget-ignore
        onClick={handleOpen}
        aria-label="Report a problem"
        className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-[#0073EA] px-4 py-3 text-white shadow-lg hover:bg-[#0060C0] active:scale-95 transition-all"
      >
        <Camera className="h-5 w-5 shrink-0" />
        <span className="hidden sm:inline text-sm font-semibold whitespace-nowrap">
          Report a Problem
        </span>
      </button>

      {isOpen && (
        <div
          data-feedback-widget-ignore
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={isSelectingArea ? undefined : handleClose}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold">Report a Problem</h3>
              {!isSelectingArea && (
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSending}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {isSelectingArea && screenshot ? (
              <>
                <div
                  className="relative mb-3 select-none touch-none overflow-hidden rounded-lg border"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={screenshot}
                    alt="Select an area"
                    className="w-full h-auto block pointer-events-none"
                    draggable={false}
                  />
                  {dragRect && (
                    <div
                      // box-shadow spread dims everything outside the rect (clipped by
                      // the container's overflow-hidden) — a thin border alone was
                      // nearly invisible against screenshots that are mostly this same
                      // blue brand color.
                      className="absolute pointer-events-none border-2 border-white outline outline-2 outline-[#0073EA]"
                      style={{
                        left: dragRect.x,
                        top: dragRect.y,
                        width: dragRect.w,
                        height: dragRect.h,
                        boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                      }}
                    />
                  )}
                </div>
                <p className="mb-3 text-xs text-muted-foreground text-center">
                  Drag to select the area to include
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleCancelSelectArea}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleConfirmSelectArea}>
                    Use Selection
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Screenshot preview — always shown so they can see exactly what we'll get */}
                <div className="mb-2 overflow-hidden rounded-lg border bg-muted aspect-video flex items-center justify-center">
                  {isCapturing ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="text-xs">Capturing screenshot...</span>
                    </div>
                  ) : finalScreenshot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={finalScreenshot}
                      alt="Screenshot preview"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground px-4 text-center">
                      No screenshot — we'll still send your note.
                    </span>
                  )}
                </div>

                {screenshot && !isCapturing && (
                  <div className="mb-3 flex gap-2">
                    <Button
                      type="button"
                      variant={!croppedScreenshot ? "secondary" : "outline"}
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={handleUseFullScreen}
                      disabled={isSending}
                    >
                      <Maximize2 className="h-3.5 w-3.5 mr-1" />
                      Full Screen
                    </Button>
                    <Button
                      type="button"
                      variant={croppedScreenshot ? "secondary" : "outline"}
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={handleEnterSelectArea}
                      disabled={isSending}
                    >
                      <Crop className="h-3.5 w-3.5 mr-1" />
                      Select Area
                    </Button>
                  </div>
                )}

                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What went wrong? (optional)"
                  className="mb-4 min-h-[80px] text-base"
                  disabled={isSending}
                  autoFocus
                />

                <Button
                  onClick={handleSend}
                  disabled={isSending || isCapturing}
                  className="w-full h-11 text-base font-semibold"
                >
                  {isSending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {isSending ? "Sending..." : "Send"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
