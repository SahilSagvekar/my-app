"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";

interface FinalRevisionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
}

/**
 * Shown when a client chooses "Final Revision" instead of "Send Back".
 * Used by every client review screen (video, images, text posts) so the
 * wording stays identical everywhere.
 */
export function FinalRevisionConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: FinalRevisionConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Request a final revision?</AlertDialogTitle>
          <AlertDialogDescription>
            Thank you for your feedback. Once our editor has made these changes and our
            quality team has approved them, we&apos;ll move your content straight on to
            scheduling, so it won&apos;t return to your review queue. Before you continue,
            please make sure your notes include everything you&apos;d like changed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Go back</AlertDialogCancel>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? "Sending…" : "Yes, request final revision"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
