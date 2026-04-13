import React from 'react';
import { 
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "../../ui/dialog";
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Loader2, Clock } from 'lucide-react';
import { PlatformKey } from './types';
import { PLATFORMS } from './icons';

interface LinkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    linkDialog: any;
    linkUrl: string;
    setLinkUrl: (url: string) => void;
    linkPostedAt: string;
    setLinkPostedAt: (date: string) => void;
    submittingLink: boolean;
    onSave: () => void;
}

export function LinkDialog({
    open,
    onOpenChange,
    linkDialog,
    linkUrl,
    setLinkUrl,
    linkPostedAt,
    setLinkPostedAt,
    submittingLink,
    onSave
}: LinkDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {linkDialog && (() => {
                            const platform = PLATFORMS[linkDialog.platform as PlatformKey];
                            if (!platform) return null;
                            const Icon = platform.icon;
                            const isEdit = linkDialog.mode === 'edit';
                            return (
                                <>
                                    <div className={`p-1.5 rounded-md ${platform.bgColor}`}>
                                        <Icon className={`h-5 w-5 ${platform.color}`} />
                                    </div>
                                    {isEdit ? 'Edit' : 'Add'} {linkDialog.platform.charAt(0).toUpperCase() + linkDialog.platform.slice(1)} Link
                                </>
                            );
                        })()}
                    </DialogTitle>
                    <DialogDescription>
                        {linkDialog?.mode === 'edit' 
                            ? 'Update the URL for this post'
                            : 'Paste the URL of the published post'
                        }
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Post URL</label>
                        <Input
                            placeholder="https://..."
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            disabled={submittingLink}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            Posted / Scheduled Time
                        </label>
                        <Input
                            type="datetime-local"
                            value={linkPostedAt}
                            onChange={(e) => setLinkPostedAt(e.target.value)}
                            disabled={submittingLink}
                            className="text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">Leave empty to use the current time</p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submittingLink}>
                            Cancel
                        </Button>
                        <Button onClick={onSave} disabled={submittingLink || !linkUrl}>
                            {submittingLink ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save Link"
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
