"use client";

import { Button } from "../../ui/button";
import { ArrowLeft } from "lucide-react";

// ---------------------------------------------------------------------------
// Shared shell for every Financials 2 module's full-page ("expanded") view.
// Each module page (Ledger, Contractors, Payroll, ...) wraps its content in
// this so the back button and header are consistent — same pattern as
// AdminPageHeader elsewhere in the app, plus a way back to the card grid.
// ---------------------------------------------------------------------------

interface Financials2ModulePageProps {
  title: string;
  description: string;
  onBack: () => void;
  children?: React.ReactNode;
}

export function Financials2ModulePage({
  title,
  description,
  onBack,
  children,
}: Financials2ModulePageProps) {
  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-2 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Financials 2
        </Button>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      {children ?? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          This module is being built next — check back soon.
        </div>
      )}
    </div>
  );
}