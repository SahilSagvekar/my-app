'use client';

// src/components/dashboards/EditorUploadHistory.tsx
//
// Editor's self-view of their own upload history. Thin wrapper around the
// shared UploadHistoryView — see that file for the grouping/search/pagination
// logic. Behavior and API endpoint here are unchanged from before the
// admin-facing view (in ProductionTracker's Editor Tracker tab) was added.

import { UploadHistoryView } from './UploadHistoryView';

export function EditorUploadHistory() {
  return (
    <UploadHistoryView
      apiUrl="/api/editor/upload-history"
      title="Upload History"
      subtitle="Every file you've uploaded, grouped by task"
      emptyTitle="No uploads yet"
      emptySubtitle="Files you upload to tasks will appear here"
      searchPlaceholder="Search task, client, or file name…"
    />
  );
}