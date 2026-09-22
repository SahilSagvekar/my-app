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

import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  ChevronDown,
  Plus,
  FileText,
  Camera,
  Monitor,
  CircleDollarSign,
  XCircle,
  Check,
  Loader2,
} from 'lucide-react';
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
  scriptAction?: ReactNode;
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
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={`w-full h-11 px-3.5 rounded-xl flex items-center justify-between text-left text-[14px] font-bold transition-colors cursor-pointer ${
        highlighted
          ? 'bg-black text-white hover:bg-black/90'
          : 'bg-white text-gray-900 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      {trailing && <div className="shrink-0 ml-2">{trailing}</div>}
    </button>
  );
}

export function TaskActionsMenu({
  task,
  onToggleSponsored,
  onTaskFieldsChange,
  scriptAction,
  showLinkLongForm = true,
  required = true,
}: TaskActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [lfExpanded, setLfExpanded] = useState(false);
  const [savingNoAction, setSavingNoAction] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const tags = (task.tags || []).map((t) => t.name);
  const actionCount = computeTaskActionCount(task);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

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
    <div ref={menuRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="w-full relative flex items-center justify-center px-4 py-2.5 text-[14px] font-bold text-gray-900 rounded-xl border border-gray-900 bg-white hover:bg-gray-50/80 transition-colors shadow-2xs"
      >
        <div className="flex items-center gap-1.5">
          <span>
            Task Actions<span className="text-red-500">*</span>
          </span>
          <span className="text-gray-500 font-normal text-xs">
            ({actionCount} action{actionCount !== 1 ? 's' : ''})
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform absolute right-4 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Floating Popover Overlay */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-2xl border border-gray-100 shadow-2xl p-2 space-y-1 animate-in fade-in-0 zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Add tag */}
          <ActionRow
            icon={<Plus className="h-4 w-4 stroke-[2.5]" />}
            label="Add tag"
            trailing={tags.length > 0 ? <span className="text-sm font-bold">{tags.length} Tag{tags.length !== 1 ? 's' : ''}</span> : undefined}
            onClick={() => setTagDialogOpen(true)}
            highlighted={tags.length > 0}
          />

          {/* 2. Link Script */}
          {scriptAction || (
            <ActionRow
              icon={<FileText className="h-4 w-4 stroke-[2]" />}
              label="Link Script"
              trailing={task.shootScriptRef ? <span className="text-sm font-bold">1</span> : undefined}
              highlighted={!!task.shootScriptRef}
              onClick={() => toast.info("Script linking is available for SF/LF tasks")}
            />
          )}

          {/* 3. Link Raw Footage */}
          <LinkRawFootageButton
            taskId={task.id}
            linkedPaths={task.linkedRawFootagePaths}
            onLinked={(paths) => onTaskFieldsChange(task.id, { linkedRawFootagePaths: paths })}
            renderTrigger={(count) => (
              <ActionRow
                icon={<Camera className="h-4 w-4 stroke-[2]" />}
                label="Link Raw Footage"
                trailing={count > 0 ? <span className="text-sm font-bold">{count} linked</span> : undefined}
                highlighted={count > 0}
              />
            )}
          />

          {/* 4. Link Long Form */}
          <ActionRow
            icon={<Monitor className="h-4 w-4 stroke-[2]" />}
            label="Link Long Form"
            trailing={task.relatedTaskId ? <span className="text-sm font-bold">1</span> : undefined}
            onClick={() => setLfExpanded((v) => !v)}
            highlighted={!!task.relatedTaskId}
          />
          {lfExpanded && (
            <div className="mx-1 mb-1 p-2.5 rounded-xl border bg-muted/20">
              <LinkLfTask
                sfTaskId={task.id}
                clientId={task.clientId}
                canEdit
                onLinkedChange={(relatedTaskId) => onTaskFieldsChange(task.id, { relatedTaskId })}
              />
            </div>
          )}

          {/* 5. Sponsored? */}
          <ActionRow
            icon={<CircleDollarSign className="h-4 w-4 stroke-[2]" />}
            label="Sponsored?"
            trailing={
              <div
                className={`w-5 h-5 rounded-[5px] border-2 flex items-center justify-center transition-colors ${
                  task.isSponsored ? 'border-white bg-transparent text-white' : 'border-gray-400 bg-white'
                }`}
              >
                {task.isSponsored && <Check className="h-3.5 w-3.5 stroke-[3.5] text-white" />}
              </div>
            }
            onClick={() => onToggleSponsored(task.id, !task.isSponsored)}
            highlighted={!!task.isSponsored}
          />

          {/* 6. No Action Required */}
          <ActionRow
            icon={savingNoAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 stroke-[2]" />}
            label="No Action Required"
            trailing={
              task.noActionRequired ? (
                <div className="w-5 h-5 rounded-[5px] border-2 border-white flex items-center justify-center text-white">
                  <Check className="h-3.5 w-3.5 stroke-[3.5] text-white" />
                </div>
              ) : undefined
            }
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