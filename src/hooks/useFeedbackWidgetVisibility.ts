// src/hooks/useFeedbackWidgetVisibility.ts
//
// The floating "Report a Problem" button (ClientFeedbackWidget) is rendered
// once in LayoutShell so it shows on every screen — but that means it also
// floats on top of full-screen review modals (video/thumbnail review),
// covering the Approve/Send Back buttons and generally being in the way of
// a screen that's already reviewing content for problems.
//
// This is a tiny external store (no React Context/provider tree needed) that
// any full-screen modal can use to hide the widget while it's open. A
// counter (not a boolean) supports multiple modals nesting/overlapping
// without one closing early and re-showing the widget while another is
// still open.

import { useEffect, useSyncExternalStore } from 'react';

let hideCount = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return hideCount > 0;
}

// Increments the hide count. Returns the matching "show" function — always
// call it on cleanup/close, exactly once per hide() call.
function hide(): () => void {
  hideCount += 1;
  notify();
  let released = false;
  return () => {
    if (released) return; // guard against double-invoking the cleanup
    released = true;
    hideCount = Math.max(0, hideCount - 1);
    notify();
  };
}

// Used by ClientFeedbackWidget — true while at least one modal has hidden it.
export function useFeedbackWidgetHidden(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

// Used by full-screen review modals — pass their `open` boolean. Hides the
// feedback widget for exactly as long as this component reports open=true.
export function useHideFeedbackWidgetWhileOpen(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    const show = hide();
    return show;
  }, [open]);
}