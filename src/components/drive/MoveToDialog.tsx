// src/components/drive/MoveToDialog.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ChevronRight, Folder, Home, Search } from 'lucide-react';

interface DriveItemLike {
    name: string;
    type: 'folder' | 'file';
    path?: string;
    s3Key?: string;
    children?: DriveItemLike[];
}

interface MoveToDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Root of the whole tree — the dialog browses this, independent of
     * wherever the explorer itself currently is. */
    root: DriveItemLike | null;
    /** The item(s) being moved — used to grey out invalid destinations:
     * the folder they're already in, and (for folder moves) themselves or
     * any of their own descendants. */
    itemsToMove: DriveItemLike[];
    /** The folder these items currently live in, so it can be disabled as
     * a destination (moving something into the folder it's already in is
     * a no-op). */
    currentParent: DriveItemLike | null;
    onConfirm: (destination: DriveItemLike) => void;
    isSubmitting?: boolean;
}

function isSameFolder(a: DriveItemLike | null, b: DriveItemLike | null): boolean {
    if (!a || !b) return false;
    if (a.s3Key && b.s3Key) return a.s3Key === b.s3Key;
    return a === b;
}

function isDescendantOrSelf(candidate: DriveItemLike, ancestor: DriveItemLike): boolean {
    if (isSameFolder(candidate, ancestor)) return true;
    if (candidate.s3Key && ancestor.s3Key) {
        const ancestorPrefix = ancestor.s3Key.endsWith('/') ? ancestor.s3Key : `${ancestor.s3Key}/`;
        return candidate.s3Key.startsWith(ancestorPrefix);
    }
    return false;
}

export function MoveToDialog({
    open,
    onOpenChange,
    root,
    itemsToMove,
    currentParent,
    onConfirm,
    isSubmitting = false,
}: MoveToDialogProps) {
    // Breadcrumb of folders browsed into, starting at root.
    const [stack, setStack] = useState<DriveItemLike[]>([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (open && root) setStack([root]);
        if (!open) setSearch('');
    }, [open, root]);

    const currentBrowseFolder = stack[stack.length - 1] ?? null;

    // Folders being moved can't be valid destinations for themselves or
    // their own descendants (can't move a folder into itself).
    const movingFolders = useMemo(
        () => itemsToMove.filter(i => i.type === 'folder'),
        [itemsToMove],
    );

    const isDisabledDestination = (folder: DriveItemLike): boolean => {
        if (isSameFolder(folder, currentParent)) return true; // already here
        return movingFolders.some(mf => isDescendantOrSelf(folder, mf));
    };

    const visibleFolders = useMemo(() => {
        const all = (currentBrowseFolder?.children ?? []).filter(c => c.type === 'folder');
        if (!search.trim()) return all;
        const q = search.trim().toLowerCase();
        return all.filter(f => f.name.toLowerCase().includes(q));
    }, [currentBrowseFolder, search]);

    const itemLabel = itemsToMove.length === 1
        ? `"${itemsToMove[0].name}"`
        : `${itemsToMove.length} items`;

    const canMoveHere = currentBrowseFolder && !isDisabledDestination(currentBrowseFolder);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Move {itemLabel}</DialogTitle>
                    <DialogDescription>
                        Pick a destination folder, then hit Move Here.
                    </DialogDescription>
                </DialogHeader>

                {/* Breadcrumb */}
                <div className="flex items-center gap-1 flex-wrap text-sm text-muted-foreground border-b pb-2">
                    {stack.map((folder, idx) => (
                        <span key={folder.s3Key || folder.name + idx} className="flex items-center gap-1">
                            {idx > 0 && <ChevronRight className="h-3.5 w-3.5" />}
                            <button
                                type="button"
                                onClick={() => setStack(stack.slice(0, idx + 1))}
                                className={`hover:underline flex items-center gap-1 ${idx === stack.length - 1 ? 'font-medium text-foreground' : ''}`}
                            >
                                {idx === 0 && <Home className="h-3.5 w-3.5" />}
                                {folder.name || 'Root'}
                            </button>
                        </span>
                    ))}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search folders here…"
                        className="pl-8 h-9"
                    />
                </div>

                {/* Folder list */}
                <div className="max-h-72 overflow-y-auto border rounded-md divide-y">
                    {visibleFolders.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">
                            No subfolders here
                        </p>
                    ) : (
                        visibleFolders.map(folder => {
                            const disabled = isDisabledDestination(folder);
                            return (
                                <button
                                    key={folder.s3Key || folder.name}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => { setStack([...stack, folder]); setSearch(''); }}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                    title={disabled ? "Can't move here" : undefined}
                                >
                                    <span className="flex items-center gap-2 truncate">
                                        <Folder className="h-4 w-4 text-blue-500 shrink-0" />
                                        <span className="truncate">{folder.name}</span>
                                    </span>
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                </button>
                            );
                        })
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => currentBrowseFolder && onConfirm(currentBrowseFolder)}
                        disabled={!canMoveHere || isSubmitting}
                    >
                        {isSubmitting ? 'Moving…' : `Move Here${currentBrowseFolder ? ` — ${currentBrowseFolder.name || 'Root'}` : ''}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}