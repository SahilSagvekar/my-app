'use client';
// src/components/workflow/TaskActionsMenu.tsx
//
// Consolidated "Task Actions" dropdown for the editor portal redesign.
// Replaces what used to be scattered across the card: a tag popover, a
// script attach popover, a sponsor toggle button, and an always-visible
// LinkLfTask panel. Those pieces' underlying logic is untouched — this is
// a shell that relocates them into one accordion with a live "(N actions)"
// count, plus two things that are new: the modal-style Add Tag UI
// (AddTagDialog) and the "No Action Required" flag.
//
// Action count is one point per CATEGORY used (not per item) — tags,
// script, raw footage, long form, sponsored, no-action-required — matching
// the redesign mockup (2 tags + sponsored = "2 actions") and the
// server-side Submit-to-QC gate in /api/tasks/[id]/status, which must
// compute this identically.

import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, Plus, FolderSearch, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { LinkRawFootageButton } from '../shared/LinkRawFootageButton';
import { LinkLfTask } from '../tasks/LinkLfTask';
import { AddTagDialog } from './AddTagDialog';

export interface TaskActionsMenuTask {
  id: string;
  clientId: string;
  tags?: { id: string; name: string }[];
  shootScriptRef?: string | null;
  linkedRawFootagePaths?: string[] | null;
  relatedTaskId?: string | null;
  isSponsored?: boolean;
  noActionRequired?: boolean;
}

export function computeTaskActionCount(task: TaskActionsMenuTask): number {
  return (
    ((task.tags?.length ?? 0) > 0 ? 1 : 0) +
    (task.shootScriptRef ? 1 : 0) +
    ((task.linkedRawFootagePaths?.length ?? 0) > 0 ? 1 : 0) +
    (task.relatedTaskId ? 1 : 0) +
    (task.isSponsored ? 1 : 0) +
    (task.noActionRequired ? 1 : 0)
  );
}

interface TaskActionsMenuProps {
  task: TaskActionsMenuTask;
  onToggleSponsored: (taskId: string, value: boolean) => void;
  onTaskFieldsChange: (taskId: string, patch: Record<string, any>) => void;
  // Self-contained "Link Script" trigger + popover, passed in by TaskCard
  // (which owns the script attach/view state/handlers) — undefined when
  // the deliverable type doesn't support scripts (non-SF/LF).
  scriptAction?: ReactNode;
  // Long-form linking only applies to short-form tasks (mirrors the
  // original standalone LinkLfTask panel's condition — LF tasks don't
  // link to themselves). Undefined/false hides the row entirely.
  showLinkLongForm?: boolean;
  required?: boolean;
}

function ActionRow({
  icon,
  label,
  trailing,
  onClick,
  highlighted,
}: {
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
  onClick?: () => void;
  highlighted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // Only intercept the click when this row does its own thing. When
        // used as LinkRawFootageButton's renderTrigger, this row has no
        // onClick of its own — the actual handler lives on that button's
        // wrapping element (its Radix PopoverTrigger, an ancestor of this
        // button) and needs the click to bubble up to it uninterrupted.
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={`w-full flex items-center gap-2 px-2.5 py-2 text-left text-sm font-medium rounded transition-colors ${
        highlighted ? 'bg-foreground text-background' : 'hover:bg-muted'
      }`}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`shrink-0 h-4 w-4 rounded border flex items-center justify-center text-[10px] ${
        checked ? 'bg-current border-current text-background' : 'border-current'
      }`}
    >
      {checked ? '✓' : ''}
    </span>
  );
}

export function TaskActionsMenu({
  task,
  onToggleSponsored,
  onTaskFieldsChange,
  scriptAction,
  showLinkLongForm = false,
  required = true,
}: TaskActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [lfExpanded, setLfExpanded] = useState(false);
  const [savingNoAction, setSavingNoAction] = useState(false);

  const tags = (task.tags || []).map((t) => t.name);
  const actionCount = computeTaskActionCount(task);

  const handleToggleNoActionRequired = async () => {
    const next = !task.noActionRequired;
    const previous = task.noActionRequired;
    onTaskFieldsChange(task.id, { noActionRequired: next });
    setSavingNoAction(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/no-action-required`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noActionRequired: next }),
      });
      if (!res.ok) {
        onTaskFieldsChange(task.id, { noActionRequired: previous });
        toast.error('Failed to update');
      }
    } catch {
      onTaskFieldsChange(task.id, { noActionRequired: previous });
      toast.error('Network error');
    } finally {
      setSavingNoAction(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-900 bg-white overflow-hidden shadow-2xs transition-all">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold text-gray-900 hover:bg-gray-50/80 transition-colors"
      >
        <span>
          Task Actions<span className="text-red-500">*</span>
        </span>
        <span className="text-gray-500 font-normal text-xs">
          ({actionCount} action{actionCount !== 1 ? 's' : ''})
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ml-0.5 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t p-1 space-y-0.5" onClick={(e) => e.stopPropagation()}>
          <ActionRow
            icon={<Plus className="h-3.5 w-3.5" />}
            label="Add tag"
            trailing={tags.length > 0 ? <span className="text-xs opacity-70">{tags.length} Tag{tags.length !== 1 ? 's' : ''}</span> : undefined}
            onClick={() => setTagDialogOpen(true)}
          />

          {scriptAction}

          <LinkRawFootageButton
            taskId={task.id}
            linkedPaths={task.linkedRawFootagePaths}
            onLinked={(paths) => onTaskFieldsChange(task.id, { linkedRawFootagePaths: paths })}
            renderTrigger={(count) => (
              <ActionRow
                icon={<FolderSearch className="h-3.5 w-3.5" />}
                label="Link Raw Footage"
                trailing={count > 0 ? <span className="text-xs opacity-70">{count} linked</span> : undefined}
              />
            )}
          />

          {showLinkLongForm && (
            <>
              <ActionRow
                icon={<Link2 className="h-3.5 w-3.5" />}
                label="Link Long Form"
                trailing={task.relatedTaskId ? <span className="text-xs opacity-70">1</span> : undefined}
                onClick={() => setLfExpanded((v) => !v)}
              />
              {lfExpanded && (
                <div className="mx-1 mb-1 p-2.5 rounded border bg-muted/20">
                  <LinkLfTask
                    sfTaskId={task.id}
                    clientId={task.clientId}
                    canEdit
                    onLinkedChange={(relatedTaskId) => onTaskFieldsChange(task.id, { relatedTaskId })}
                  />
                </div>
              )}
            </>
          )}
          <ActionRow
            icon={<span className="text-[13px]">💰</span>}
            label="Sponsored?"
            trailing={<Checkbox checked={!!task.isSponsored} />}
            onClick={() => onToggleSponsored(task.id, !task.isSponsored)}
            highlighted={!!task.isSponsored}
          />

          <ActionRow
            icon={savingNoAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="text-[13px]">⊗</span>}
            label="No Action Required"
            trailing={<Checkbox checked={!!task.noActionRequired} />}
            onClick={handleToggleNoActionRequired}
            highlighted={!!task.noActionRequired}
          />
        </div>
      )}

      <AddTagDialog
        taskId={task.id}
        tags={tags}
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        onChange={(next) => onTaskFieldsChange(task.id, { tags: next.map((name) => ({ id: name, name })) })}
      />
    </div>
  );
}