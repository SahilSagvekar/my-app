"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type GuidelineRole = "editor" | "qc" | "scheduler";

interface GuidelineItem {
  id: string;
  title: string;
  content: string;
  category: string;
  clientName?: string | null;
}

interface ApiGuideline {
  id: string;
  title: string;
  content: string;
  category: string;
  client?: {
    name?: string | null;
    companyName?: string | null;
  } | null;
}

interface TaskGuidelinesButtonProps {
  clientId?: string | null;
  clientName?: string | null;
  role: GuidelineRole;
  buttonClassName?: string;
}

const DEFAULT_BUTTON_CLASSNAME =
  "h-5 w-5 rounded-full border border-dashed border-primary/60 text-[9px] font-semibold flex items-center justify-center text-primary hover:bg-primary/5";

export function TaskGuidelinesButton({
  clientId,
  clientName,
  role,
  buttonClassName = DEFAULT_BUTTON_CLASSNAME,
}: TaskGuidelinesButtonProps) {
  const [open, setOpen] = useState(false);
  const [guidelinesLoading, setGuidelinesLoading] = useState(false);
  const [guidelinesError, setGuidelinesError] = useState<string | null>(null);
  const [guidelines, setGuidelines] = useState<GuidelineItem[]>([]);

  const loadGuidelines = async () => {
    if (!clientId) {
      setGuidelines([]);
      setGuidelinesError("No client linked to this task.");
      setOpen(true);
      return;
    }

    try {
      setGuidelinesLoading(true);
      setGuidelinesError(null);

      const res = await fetch(
        `/api/guidelines?role=${encodeURIComponent(role)}&clientId=${encodeURIComponent(clientId)}`,
      );
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setGuidelinesError(data.message || "Failed to load guidelines");
        setGuidelines([]);
      } else {
        setGuidelines(
          ((data.guidelines || []) as ApiGuideline[]).map((g) => ({
            id: g.id,
            title: g.title,
            content: g.content,
            category: g.category,
            clientName: g.client?.companyName || g.client?.name || null,
          })),
        );
      }

      setOpen(true);
    } catch (error) {
      console.error("Failed to load guidelines for task:", error);
      setGuidelinesError("Failed to load guidelines");
      setGuidelines([]);
      setOpen(true);
    } finally {
      setGuidelinesLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          loadGuidelines();
        }}
        className={buttonClassName}
        aria-label="View guidelines"
        title="Guidelines - click to view"
      >
        G
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              Guidelines
              {clientName && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 font-medium">
                  {clientName}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {guidelinesLoading ? (
            <div className="py-6 text-sm text-muted-foreground">
              Loading guidelines...
            </div>
          ) : guidelinesError ? (
            <div className="py-6 text-sm text-destructive">
              {guidelinesError}
            </div>
          ) : guidelines.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">
              No guidelines found for this client.
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {guidelines.map((guideline) => (
                <div
                  key={guideline.id}
                  className="border rounded-md p-3 bg-muted/40 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm">{guideline.title}</div>
                    {guideline.clientName && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                        {guideline.clientName}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground whitespace-pre-wrap">
                    {guideline.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
