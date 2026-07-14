// src/components/client/ClientFeedbackWidget.tsx
//
// Dead-simple "Report a Problem" button for the client role. One tap:
// auto-captures a screenshot of the current screen, lets them type an
// optional note, and emails it straight to us. No categories, no
// priority pickers, nothing to configure — nothing saved in the app.

"use client";

import { useState } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function ClientFeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleOpen = async () => {
    setIsOpen(true);
    setIsCapturing(true);
    setScreenshot(null);

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
        scale: Math.min(window.devicePixelRatio || 1, 1.5),
        width: window.innerWidth,
        height: window.innerHeight,
        filter: (node) => {
          if (node instanceof Element && node.hasAttribute("data-feedback-widget-ignore")) {
            return false;
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
    setMessage("");
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      const res = await fetch("/api/client/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screenshot,
          message,
          pageUrl: typeof window !== "undefined" ? window.location.href : "",
        }),
      });
      if (!res.ok) throw new Error("Failed to send feedback");

      toast.success("Thanks! We've got it and will take a look.");
      setIsOpen(false);
      setScreenshot(null);
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
      {/* Floating trigger — always visible, bottom-right, every client page */}
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
          onClick={handleClose}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold">Report a Problem</h3>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSending}
                className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Screenshot preview — always shown so they can see exactly what we'll get */}
            <div className="mb-3 overflow-hidden rounded-lg border bg-muted aspect-video flex items-center justify-center">
              {isCapturing ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-xs">Capturing screenshot...</span>
                </div>
              ) : screenshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={screenshot}
                  alt="Screenshot preview"
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <span className="text-xs text-muted-foreground px-4 text-center">
                  No screenshot — we'll still send your note.
                </span>
              )}
            </div>

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
          </div>
        </div>
      )}
    </>
  );
}